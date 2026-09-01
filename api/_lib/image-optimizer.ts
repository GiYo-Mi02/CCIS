import sharp, { type Metadata, type OutputInfo, type Sharp } from 'sharp';
import { MEDIA_PRESETS } from '../../src/lib/media/presets.ts';
import type { MediaCategory, MediaPreset, MediaVariant } from '../../src/lib/media/types.ts';
import {
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_INPUT_BYTES,
  MAX_IMAGE_INPUT_PIXELS,
  MediaRequestError,
} from './media-policy.ts';

export interface OptimizedVariantBuffer {
  label: MediaVariant['label'];
  buffer: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: 'image/webp';
}

export interface ServerOptimizationResult {
  originalSizeBytes: number;
  originalWidth: number;
  originalHeight: number;
  variants: OptimizedVariantBuffer[];
}

const SUPPORTED_INPUT_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif']);
const MIN_WEBP_QUALITY = 58;

async function renderVariant(
  source: Sharp,
  preset: MediaPreset,
  label: MediaVariant['label'],
): Promise<OptimizedVariantBuffer> {
  let maxLongEdge = preset.maxLongEdge;
  let quality = Math.round(preset.initialQuality * 100);
  let result: { data: Buffer; info: OutputInfo };

  for (let attempt = 0; ; attempt += 1) {
    result = await source
      .clone()
      .resize({
        width: maxLongEdge,
        height: maxLongEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 4, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });

    if (result.data.byteLength <= preset.targetMaxBytes) break;
    if (quality > MIN_WEBP_QUALITY) {
      quality = Math.max(MIN_WEBP_QUALITY, quality - 6);
      continue;
    }
    if (result.data.byteLength <= preset.hardMaxBytes) break;
    if (attempt >= 10 || maxLongEdge <= 320) {
      throw new MediaRequestError(
        `The optimized ${label} image is still larger than the allowed limit.`,
        422,
        'IMAGE_TOO_LARGE',
      );
    }
    maxLongEdge = Math.max(320, Math.floor(maxLongEdge * 0.88));
  }

  if (!result.info.width || !result.info.height || result.data.byteLength > preset.hardMaxBytes) {
    throw new MediaRequestError('The image could not be optimized within the media limits.', 422, 'IMAGE_TOO_LARGE');
  }

  return {
    label,
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
    sizeBytes: result.data.byteLength,
    mimeType: 'image/webp',
  };
}

export async function optimizeImageBuffer(input: Buffer, category: MediaCategory): Promise<ServerOptimizationResult> {
  if (input.byteLength === 0) {
    throw new MediaRequestError('The staged image is empty.', 400, 'EMPTY_IMAGE');
  }
  if (input.byteLength > MAX_IMAGE_INPUT_BYTES) {
    throw new MediaRequestError('Images must be 10 MB or smaller.', 413, 'IMAGE_TOO_LARGE');
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(input, {
      animated: false,
      failOn: 'warning',
      limitInputPixels: MAX_IMAGE_INPUT_PIXELS,
      sequentialRead: true,
    }).metadata();
  } catch {
    throw new MediaRequestError('The staged file is not a valid supported image.', 422, 'INVALID_IMAGE');
  }

  if (
    !metadata.format
    || !SUPPORTED_INPUT_FORMATS.has(metadata.format)
    || !metadata.width
    || !metadata.height
    || metadata.width > MAX_IMAGE_DIMENSION
    || metadata.height > MAX_IMAGE_DIMENSION
    || metadata.width * metadata.height > MAX_IMAGE_INPUT_PIXELS
    || (metadata.pages ?? 1) !== 1
  ) {
    throw new MediaRequestError('The image format, dimensions, or frame count is not supported.', 422, 'INVALID_IMAGE');
  }

  const preset = MEDIA_PRESETS[category];
  if (!preset) {
    throw new MediaRequestError('Unknown media category.', 400, 'INVALID_REQUEST');
  }

  const requested: Array<[MediaVariant['label'], MediaPreset | undefined]> = [
    ['main', preset],
    ['thumbnail', preset.thumbnail],
    ['card', preset.card],
    ['mobile', preset.mobile],
  ];
  const sourceLongEdge = Math.max(metadata.width, metadata.height);
  const source = sharp(input, {
    animated: false,
    failOn: 'warning',
    limitInputPixels: MAX_IMAGE_INPUT_PIXELS,
    sequentialRead: true,
  }).rotate();

  const variants = await Promise.all(requested.flatMap(([label, variantPreset]) => {
    if (!variantPreset || (label !== 'main' && sourceLongEdge <= variantPreset.maxLongEdge)) return [];
    return [renderVariant(source, variantPreset, label)];
  }));

  return {
    originalSizeBytes: input.byteLength,
    originalWidth: metadata.width,
    originalHeight: metadata.height,
    variants,
  };
}
