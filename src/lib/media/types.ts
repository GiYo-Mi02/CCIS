export type MediaCategory = 'officer' | 'gallery' | 'banner' | 'patch' | 'document-thumbnail';

export interface MediaVariant {
  label: 'main' | 'thumbnail' | 'card' | 'mobile';
  path: string;
  publicUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
}

export interface MediaAsset {
  provider: 'supabase' | 'static';
  bucket: string;
  path: string;
  publicUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
  originalSizeBytes: number;
  variants: MediaVariant[];
}

export interface UploadOptions {
  bucket: string;
  path: string;
  contentType: string;
  cacheControl: string;
  width: number;
  height: number;
  originalSizeBytes: number;
}

export interface PublicMediaProvider {
  readonly kind: 'supabase' | 'static';
  upload(file: Blob, options: UploadOptions): Promise<MediaAsset>;
  delete(path: string, bucket?: string): Promise<void>;
  getPublicUrl(path: string, bucket?: string): string;
}

export interface MediaPreset {
  maxLongEdge: number;
  targetMaxBytes: number;
  hardMaxBytes: number;
  initialQuality: number;
  thumbnail?: Omit<MediaPreset, 'thumbnail'>;
  card?: Omit<MediaPreset, 'thumbnail' | 'card'>;
  mobile?: Omit<MediaPreset, 'thumbnail' | 'mobile'>;
}

export interface UploadOptimizedImageOptions {
  category: MediaCategory;
  bucket: string;
  folder: string;
  entityType?: string;
  entityId?: string;
}

export interface UploadOptimizedImageResult {
  asset: MediaAsset;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  percentageSaved: number;
}
