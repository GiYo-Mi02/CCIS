import { supabase } from '../supabase';
import { validateImageFile } from './fileValidation';
import { getManagedImagePathsFromUrl, isManagedImagePath } from './managedPaths';
import type {
  MediaAsset,
  UploadOptimizedImageOptions,
  UploadOptimizedImageResult,
} from './types';

const STAGING_BUCKET = 'ccis-private-drafts';
const PROCESSING_TIMEOUT_MS = 120_000;
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

interface OptimizeApiEnvelope {
  data?: UploadOptimizedImageResult;
  error?: { code?: string; message?: string };
}

function isUploadResult(value: unknown): value is UploadOptimizedImageResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<UploadOptimizedImageResult>;
  return Boolean(
    result.asset
    && typeof result.asset.publicUrl === 'string'
    && typeof result.asset.path === 'string'
    && typeof result.originalSizeBytes === 'number'
    && typeof result.optimizedSizeBytes === 'number',
  );
}

export async function uploadOptimizedImage(
  file: File,
  options: UploadOptimizedImageOptions,
): Promise<UploadOptimizedImageResult> {
  const { mimeType } = await validateImageFile(file);
  const extension = MIME_EXTENSIONS[mimeType];
  if (!extension) throw new Error('Unsupported image type.');

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (sessionError || !session?.user || !session.access_token) {
    throw new Error('Your session has expired. Sign in again before uploading an image.');
  }

  const sourcePath = `image-processing/${session.user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: stageError } = await supabase.storage.from(STAGING_BUCKET).upload(sourcePath, file, {
    contentType: mimeType,
    cacheControl: '60',
    upsert: false,
  });
  if (stageError) throw new Error(`The image could not be staged securely: ${stageError.message}`);

  const response = await fetch('/api/media/optimize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sourcePath, ...options }),
    signal: AbortSignal.timeout(PROCESSING_TIMEOUT_MS),
  });
  const payload = await response.json().catch(() => null) as OptimizeApiEnvelope | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'The image could not be optimized.');
  }
  if (!isUploadResult(payload?.data)) {
    throw new Error('The image service returned an invalid response.');
  }
  return payload.data;
}

export function getManagedImagePaths(asset: MediaAsset): string[] {
  const allPaths = [asset.path, ...asset.variants.map(variant => variant.path)];
  return [...new Set(allPaths.filter(isManagedImagePath))];
}

async function updateCleanupState(
  bucket: string,
  mainPath: string,
  cleanupStatus: 'pending' | 'failed',
  cleanupError: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('mark_media_asset_cleanup', {
    p_bucket: bucket,
    p_storage_path: mainPath,
    p_cleanup_status: cleanupStatus,
    p_cleanup_error: cleanupError,
  });
  if (error) throw error;
}

async function deleteManagedPaths(bucket: string, mainPath: string, paths: string[]): Promise<void> {
  await updateCleanupState(bucket, mainPath, 'pending', null);

  const { error: storageError } = await supabase.storage.from(bucket).remove(paths);
  if (storageError) {
    await updateCleanupState(bucket, mainPath, 'failed', storageError.message).catch(() => undefined);
    throw new Error(`Optimized image cleanup failed: ${storageError.message}`);
  }

  const { error: metadataError } = await supabase
    .from('media_assets')
    .delete()
    .eq('bucket', bucket)
    .eq('storage_path', mainPath);
  if (metadataError) {
    await updateCleanupState(bucket, mainPath, 'failed', metadataError.message).catch(() => undefined);
    throw new Error(`Image metadata cleanup failed: ${metadataError.message}`);
  }
}

export async function deleteManagedOptimizedImage(asset: MediaAsset): Promise<void> {
  if (asset.provider !== 'supabase') return;
  const paths = getManagedImagePaths(asset);
  if (paths.length === 0) return;

  await deleteManagedPaths(asset.bucket, asset.path, paths);
}

export async function deleteManagedOptimizedImageByUrl(publicUrl: string | null | undefined, bucket: string): Promise<void> {
  if (!publicUrl) return;
  const managed = getManagedImagePathsFromUrl(publicUrl, bucket);
  if (!managed) return;
  await deleteManagedPaths(bucket, managed.mainPath, managed.paths);
}
