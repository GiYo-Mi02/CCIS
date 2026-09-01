import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import type { MediaAsset, MediaVariant, UploadOptimizedImageResult } from '../../src/lib/media/types.ts';
import { LONG_LIVED_CACHE_CONTROL } from '../../src/lib/media/presets.ts';
import { optimizeImageBuffer, type ServerOptimizationResult } from './image-optimizer.ts';
import {
  IMAGE_STAGING_BUCKET,
  MAX_IMAGE_INPUT_BYTES,
  MediaRequestError,
  type OptimizeMediaRequest,
} from './media-policy.ts';

export interface MediaAssetInsert {
  provider: 'supabase';
  bucket: string;
  storage_path: string;
  public_url: string;
  thumbnail_path: string | null;
  width: number;
  height: number;
  optimized_size_bytes: number;
  original_size_bytes: number;
  mime_type: 'image/webp';
  category: OptimizeMediaRequest['category'];
  entity_type: string | null;
  entity_id: string | null;
  variants: MediaVariant[];
}

export interface MediaPipelineGateway {
  download(bucket: string, path: string): Promise<Buffer>;
  upload(
    bucket: string,
    path: string,
    content: Buffer,
    options: { contentType: 'image/webp'; cacheControl: string; upsert: false },
  ): Promise<void>;
  remove(bucket: string, paths: string[]): Promise<void>;
  getPublicUrl(bucket: string, path: string): string;
  insertMediaAsset(metadata: MediaAssetInsert): Promise<void>;
}

type Optimizer = (input: Buffer, category: OptimizeMediaRequest['category']) => Promise<ServerOptimizationResult>;

async function bestEffortRemove(gateway: MediaPipelineGateway, bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await gateway.remove(bucket, paths);
  } catch {
    console.error('[media-optimize] rollback cleanup failed');
  }
}

export async function processStagedImage(
  request: OptimizeMediaRequest,
  gateway: MediaPipelineGateway,
  optimizer: Optimizer = optimizeImageBuffer,
): Promise<UploadOptimizedImageResult> {
  const uploadedPaths: string[] = [];
  let metadataInserted = false;
  let metadataInsertAttempted = false;

  try {
    const input = await gateway.download(IMAGE_STAGING_BUCKET, request.sourcePath);
    if (input.byteLength > MAX_IMAGE_INPUT_BYTES) {
      throw new MediaRequestError('Images must be 10 MB or smaller.', 413, 'IMAGE_TOO_LARGE');
    }

    const optimized = await optimizer(input, request.category);
    const version = randomUUID();
    const uploadedVariants = await Promise.all(optimized.variants.map(async variant => {
      const path = `${request.folder}/v2/${version}/${variant.label}.webp`;
      await gateway.upload(request.bucket, path, variant.buffer, {
        contentType: 'image/webp',
        cacheControl: LONG_LIVED_CACHE_CONTROL,
        upsert: false,
      });
      uploadedPaths.push(path);
      return {
        label: variant.label,
        path,
        publicUrl: gateway.getPublicUrl(request.bucket, path),
        width: variant.width,
        height: variant.height,
        sizeBytes: variant.sizeBytes,
        mimeType: variant.mimeType,
      };
    }));

    const mainVariant = uploadedVariants.find(variant => variant.label === 'main');
    if (!mainVariant) {
      throw new MediaRequestError('The optimizer did not produce a primary image.', 500, 'OPTIMIZATION_FAILED');
    }

    const responsiveVariants = uploadedVariants.filter(variant => variant.label !== 'main');
    const metadata: MediaAssetInsert = {
      provider: 'supabase',
      bucket: request.bucket,
      storage_path: mainVariant.path,
      public_url: mainVariant.publicUrl,
      thumbnail_path: responsiveVariants.find(variant => variant.label === 'thumbnail')?.path ?? null,
      width: mainVariant.width,
      height: mainVariant.height,
      optimized_size_bytes: mainVariant.sizeBytes,
      original_size_bytes: optimized.originalSizeBytes,
      mime_type: 'image/webp',
      category: request.category,
      entity_type: request.entityType ?? null,
      entity_id: request.entityId ?? null,
      variants: responsiveVariants,
    };
    metadataInsertAttempted = true;
    await gateway.insertMediaAsset(metadata);
    metadataInserted = true;

    // Metadata is durable now; a failed staging cleanup must not roll it back.
    await bestEffortRemove(gateway, IMAGE_STAGING_BUCKET, [request.sourcePath]);

    const asset: MediaAsset = {
      provider: 'supabase',
      bucket: request.bucket,
      path: mainVariant.path,
      publicUrl: mainVariant.publicUrl,
      width: mainVariant.width,
      height: mainVariant.height,
      sizeBytes: mainVariant.sizeBytes,
      mimeType: 'image/webp',
      originalSizeBytes: optimized.originalSizeBytes,
      variants: responsiveVariants,
    };

    return {
      asset,
      originalSizeBytes: optimized.originalSizeBytes,
      optimizedSizeBytes: mainVariant.sizeBytes,
      percentageSaved: Math.max(0, (1 - mainVariant.sizeBytes / optimized.originalSizeBytes) * 100),
    };
  } catch (error) {
    await bestEffortRemove(gateway, request.bucket, uploadedPaths);
    if (!metadataInserted && !metadataInsertAttempted) {
      await bestEffortRemove(gateway, IMAGE_STAGING_BUCKET, [request.sourcePath]);
    }
    throw error;
  }
}

function toBuffer(value: ArrayBuffer): Buffer {
  return Buffer.from(value);
}
