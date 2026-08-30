export type MediaProviderKind = 'supabase' | 'static';

export function resolveMediaProviderKind(value?: string, staticBaseUrl?: string): MediaProviderKind {
  return value?.toLowerCase() === 'static' && Boolean(staticBaseUrl?.trim()) ? 'static' : 'supabase';
}
