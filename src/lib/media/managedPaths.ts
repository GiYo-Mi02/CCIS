const MANAGED_VARIANT_PATH = /^[a-z0-9][a-z0-9-]*\/v2\/[0-9a-f-]{36}\/(?:main|thumbnail|card|mobile)\.webp$/i;

export function isManagedImagePath(path: string): boolean {
  return MANAGED_VARIANT_PATH.test(path);
}

export function getManagedImagePathsFromUrl(publicUrl: string, bucket: string): { mainPath: string; paths: string[] } | null {
  try {
    const parsed = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    const mainPath = decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
    const match = /^([a-z0-9][a-z0-9-]*)\/v2\/([0-9a-f-]{36})\/(?:main|thumbnail|card|mobile)\.webp$/i.exec(mainPath);
    if (!match) return null;
    const basePath = `${match[1]}/v2/${match[2]}`;
    const canonicalMainPath = `${basePath}/main.webp`;
    return {
      mainPath: canonicalMainPath,
      paths: ['main', 'thumbnail', 'card', 'mobile'].map(label => `${basePath}/${label}.webp`),
    };
  } catch {
    return null;
  }
}
