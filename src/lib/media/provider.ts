import { supabase } from '../supabase';
import type { MediaAsset, PublicMediaProvider, UploadOptions } from './types';
import { resolveMediaProviderKind } from './providerSelection';

export { resolveMediaProviderKind } from './providerSelection';

class SupabasePublicMediaProvider implements PublicMediaProvider {
  readonly kind = 'supabase' as const;

  async upload(file: Blob, options: UploadOptions): Promise<MediaAsset> {
    const { error } = await supabase.storage.from(options.bucket).upload(options.path, file, {
      cacheControl: options.cacheControl,
      contentType: options.contentType,
      upsert: false,
    });
    if (error) throw error;

    return {
      provider: this.kind,
      bucket: options.bucket,
      path: options.path,
      publicUrl: this.getPublicUrl(options.path, options.bucket),
      width: options.width,
      height: options.height,
      sizeBytes: file.size,
      mimeType: options.contentType,
      originalSizeBytes: options.originalSizeBytes,
      variants: [],
    };
  }

  async delete(path: string, bucket = 'gallery-images'): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
  }

  getPublicUrl(path: string, bucket = 'gallery-images'): string {
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }
}

class StaticPublicMediaProvider implements PublicMediaProvider {
  readonly kind = 'static' as const;

  constructor(private readonly baseUrl: string) {}

  async upload(): Promise<MediaAsset> {
    throw new Error('The static media provider is read-only. Configure a protected upload workflow before using it for administrative uploads.');
  }

  async delete(): Promise<void> {
    throw new Error('The static media provider does not support browser-side deletion.');
  }

  getPublicUrl(path: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }
}

const supabaseProvider = new SupabasePublicMediaProvider();

function getPublicMediaProvider(options: { forUpload?: boolean } = {}): PublicMediaProvider {
  // Dynamic administrative uploads remain on the RLS-protected Supabase path.
  // The static provider is for pre-provisioned public assets only.
  if (options.forUpload) return supabaseProvider;
  const kind = resolveMediaProviderKind(
    import.meta.env.VITE_PUBLIC_MEDIA_PROVIDER,
    import.meta.env.VITE_PUBLIC_MEDIA_BASE_URL,
  );
  if (kind === 'static') return new StaticPublicMediaProvider(import.meta.env.VITE_PUBLIC_MEDIA_BASE_URL);
  return supabaseProvider;
}
