function slugifyFileName(name: string): string {
  const withoutExtension = name.replace(/\.[^.]+$/, '');
  const slug = withoutExtension
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'image';
}

export async function buildVersionedMediaPath(folder: string, originalName: string, blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('').slice(0, 16);
  const safeFolder = folder.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9/_-]/g, '-');
  return `${safeFolder}/v1/${hash}-${slugifyFileName(originalName)}.webp`;
}
