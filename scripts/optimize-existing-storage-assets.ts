import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import sharp from 'sharp';

const CACHE_CONTROL = '31536000, immutable';
const SUPPORTED_BUCKETS = new Set(['gallery-images', 'banners', 'patch-thumbnails', 'bukas-kaban-reports']);

type Category = 'officer' | 'gallery' | 'banner' | 'patch' | 'document-thumbnail';

interface CliOptions {
  apply: boolean;
  bucket: string;
  folder: string;
  limit: number;
  manifestPath: string;
}

interface StorageObjectEntry {
  name: string;
  id?: string | null;
  metadata?: { mimetype?: string; size?: number } | null;
}

interface OptimizedVariant {
  label: 'main' | 'thumbnail' | 'card' | 'mobile';
  path: string;
  sizeBytes: number;
  width: number;
  height: number;
  mimeType: 'image/webp';
}

interface ManifestRecord {
  oldPath: string;
  newPath: string | null;
  originalSizeBytes: number;
  optimizedSizeBytes: number | null;
  percentageSaved: number | null;
  category: Category;
  variants: OptimizedVariant[];
  updatedDatabaseRecords: Record<string, number>;
  verification: 'dry-run' | 'verified' | 'failed';
  error?: string;
}

const categoryPresets: Record<Category, { edge: number; target: number; hard: number; quality: number }> = {
  officer: { edge: 900, target: 150 * 1024, hard: 300 * 1024, quality: 82 },
  gallery: { edge: 1600, target: 350 * 1024, hard: 600 * 1024, quality: 82 },
  banner: { edge: 1920, target: 500 * 1024, hard: 1024 * 1024, quality: 82 },
  patch: { edge: 640, target: 150 * 1024, hard: 300 * 1024, quality: 80 },
  'document-thumbnail': { edge: 640, target: 120 * 1024, hard: 200 * 1024, quality: 78 },
};

function parseArgs(argv: string[]): CliOptions {
  const valueAfter = (flag: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const apply = argv.includes('--apply');
  const bucket = valueAfter('--bucket') || '';
  const folder = (valueAfter('--folder') || '').replace(/^\/+|\/+$/g, '');
  const limit = Number(valueAfter('--limit') || 25);
  const manifestPath = valueAfter('--manifest') || 'storage-optimization-manifest.json';

  if (argv.includes('--dry-run') && apply) throw new Error('Choose either --dry-run or --apply, not both.');
  if (!SUPPORTED_BUCKETS.has(bucket)) throw new Error(`--bucket must be one of: ${[...SUPPORTED_BUCKETS].join(', ')}`);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('--limit must be an integer from 1 to 500.');
  return { apply, bucket, folder, limit, manifestPath };
}

function inferCategory(bucket: string, path: string): Category {
  if (bucket === 'patch-thumbnails') return 'patch';
  if (bucket === 'banners') return 'banner';
  if (bucket === 'bukas-kaban-reports') return 'document-thumbnail';
  if (/(^|\/)officers(\/|$)/i.test(path)) return 'officer';
  return 'gallery';
}

function isImage(entry: StorageObjectEntry): boolean {
  return Boolean(entry.metadata?.mimetype?.startsWith('image/')) || /\.(jpe?g|png|webp|avif)$/i.test(entry.name);
}

async function listImages(
  client: SupabaseClient,
  bucket: string,
  folder: string,
  limit: number,
): Promise<Array<{ path: string; sizeBytes: number }>> {
  const found: Array<{ path: string; sizeBytes: number }> = [];
  const pending = [folder];

  while (pending.length > 0 && found.length < limit) {
    const current = pending.shift() || '';
    let offset = 0;
    while (found.length < limit) {
      const { data, error } = await client.storage.from(bucket).list(current, {
        limit: 100,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw error;
      const entries = (data || []) as StorageObjectEntry[];
      for (const entry of entries) {
        const path = current ? `${current}/${entry.name}` : entry.name;
        if (!entry.id && !entry.metadata) pending.push(path);
        else if (isImage(entry) && !path.includes('/optimized/v1/')) {
          found.push({ path, sizeBytes: Number(entry.metadata?.size || 0) });
          if (found.length >= limit) break;
        }
      }
      if (entries.length < 100) break;
      offset += 100;
    }
  }
  return found;
}

async function optimizeBuffer(
  input: Buffer,
  category: Category,
  edgeOverride?: number,
  limits?: { hard: number; quality: number },
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const preset = categoryPresets[category];
  const metadata = await sharp(input).metadata();
  if (!metadata.format || !['jpeg', 'png', 'webp', 'avif'].includes(metadata.format)) {
    throw new Error(`Unsupported decoded image format: ${metadata.format || 'unknown'}`);
  }

  let quality = limits?.quality ?? preset.quality;
  const hardLimit = limits?.hard ?? preset.hard;
  let output = await sharp(input, { failOn: 'warning' })
    .rotate()
    .resize({ width: edgeOverride || preset.edge, height: edgeOverride || preset.edge, fit: 'inside', withoutEnlargement: true })
    .webp({ quality, effort: 5 })
    .toBuffer({ resolveWithObject: true });
  while (output.data.length > hardLimit && quality > 50) {
    quality -= 7;
    output = await sharp(input, { failOn: 'warning' })
      .rotate()
      .resize({ width: edgeOverride || preset.edge, height: edgeOverride || preset.edge, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 5 })
      .toBuffer({ resolveWithObject: true });
  }
  if (output.data.length > hardLimit) {
    throw new Error(`Optimized output ${output.data.length} bytes exceeds hard limit ${hardLimit}.`);
  }
  return { buffer: output.data, width: output.info.width, height: output.info.height };
}

function optimizedPath(oldPath: string, buffer: Buffer, label = 'main'): string {
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  const segments = oldPath.split('/');
  const original = segments.pop() || 'image';
  const stem = original.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 48) || 'image';
  const folder = segments.join('/');
  return [folder, 'optimized', 'v1', label === 'main' ? `${hash}-${stem}.webp` : `${label}-${hash}-${stem}.webp`]
    .filter(Boolean)
    .join('/');
}

async function updateReferences(
  db: Client,
  oldUrl: string,
  mainUrl: string,
  thumbnailUrl: string | null,
  category: Category,
): Promise<Record<string, number>> {
  const statements = [
    ['officers.photo_url', 'update public.officers set photo_url = $2 where photo_url = $1', mainUrl],
    ['gallery_items.image_url', 'update public.gallery_items set image_url = $2 where image_url = $1', mainUrl],
    ['announcements.banner_url', 'update public.announcements set banner_url = $2 where banner_url = $1', mainUrl],
    ['events.banner_url', 'update public.events set banner_url = $2 where banner_url = $1', mainUrl],
    ['patch_videos.thumbnail_url', 'update public.patch_videos set thumbnail_url = $2 where thumbnail_url = $1', mainUrl],
    ['transparency_reports.thumbnail_url', 'update public.transparency_reports set thumbnail_url = $2 where thumbnail_url = $1', mainUrl],
  ] as const;
  const updated: Record<string, number> = {};
  await db.query('begin');
  try {
    for (const [label, sql, replacement] of statements) {
      const result = await db.query(sql, [oldUrl, replacement]);
      if ((result.rowCount || 0) > 0) updated[label] = result.rowCount || 0;
    }
    if (category === 'gallery' && thumbnailUrl) {
      const result = await db.query(
        'update public.gallery_items set thumbnails = array_replace(thumbnails, $1, $2) where $1 = any(thumbnails)',
        [oldUrl, thumbnailUrl],
      );
      if ((result.rowCount || 0) > 0) updated['gallery_items.thumbnails'] = result.rowCount || 0;
    }
    await db.query('commit');
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
  return updated;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.SUPABASE_DB_URL;
  if (!supabaseUrl || !secretKey) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
  if (options.apply && !databaseUrl) throw new Error('SUPABASE_DB_URL is required with --apply for transactional reference updates.');

  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const db = options.apply ? new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } }) : null;
  if (db) await db.connect();
  const records: ManifestRecord[] = [];

  try {
    const inventory = await listImages(admin, options.bucket, options.folder, options.limit);
    for (const object of inventory) {
      const category = inferCategory(options.bucket, object.path);
      const dryRecord: ManifestRecord = {
        oldPath: object.path,
        newPath: null,
        originalSizeBytes: object.sizeBytes,
        optimizedSizeBytes: null,
        percentageSaved: null,
        category,
        variants: [],
        updatedDatabaseRecords: {},
        verification: 'dry-run',
      };
      if (!options.apply) {
        records.push(dryRecord);
        continue;
      }

      try {
        const { data, error } = await admin.storage.from(options.bucket).download(object.path);
        if (error || !data) throw error || new Error('Download returned no data.');
        const input = Buffer.from(await data.arrayBuffer());
        const mainImage = await optimizeBuffer(input, category);
        const newPath = optimizedPath(object.path, mainImage.buffer);
        const { error: uploadError } = await admin.storage.from(options.bucket).upload(newPath, mainImage.buffer, {
          contentType: 'image/webp', cacheControl: CACHE_CONTROL, upsert: false,
        });
        if (uploadError) throw uploadError;

        const variants: OptimizedVariant[] = [{
          label: 'main', path: newPath, sizeBytes: mainImage.buffer.length,
          width: mainImage.width, height: mainImage.height, mimeType: 'image/webp',
        }];
        const variantEdges = category === 'gallery'
          ? [['thumbnail', 480, { hard: 200 * 1024, quality: 78 }] as const]
          : category === 'banner'
            ? [
                ['card', 960, { hard: 400 * 1024, quality: 78 }] as const,
                ['mobile', 720, { hard: 300 * 1024, quality: 76 }] as const,
              ]
            : [];
        for (const [label, edge, limits] of variantEdges) {
          const variantImage = await optimizeBuffer(input, category, edge, limits);
          const path = optimizedPath(object.path, variantImage.buffer, label);
          const { error: variantError } = await admin.storage.from(options.bucket).upload(path, variantImage.buffer, {
            contentType: 'image/webp', cacheControl: CACHE_CONTROL, upsert: false,
          });
          if (variantError) throw variantError;
          variants.push({ label, path, sizeBytes: variantImage.buffer.length, width: variantImage.width, height: variantImage.height, mimeType: 'image/webp' });
        }

        const { data: verified, error: verifyError } = await admin.storage.from(options.bucket).download(newPath);
        if (verifyError || !verified || verified.size !== mainImage.buffer.length) throw verifyError || new Error('Uploaded object size verification failed.');
        const oldUrl = admin.storage.from(options.bucket).getPublicUrl(object.path).data.publicUrl;
        const mainUrl = admin.storage.from(options.bucket).getPublicUrl(newPath).data.publicUrl;
        const thumbnailPath = variants.find(variant => variant.label === 'thumbnail')?.path;
        const thumbnailUrl = thumbnailPath
          ? admin.storage.from(options.bucket).getPublicUrl(thumbnailPath).data.publicUrl
          : null;
        const updatedDatabaseRecords = await updateReferences(db!, oldUrl, mainUrl, thumbnailUrl, category);
        records.push({
          ...dryRecord,
          newPath,
          originalSizeBytes: input.length,
          optimizedSizeBytes: mainImage.buffer.length,
          percentageSaved: Number(((1 - mainImage.buffer.length / input.length) * 100).toFixed(2)),
          variants,
          updatedDatabaseRecords,
          verification: 'verified',
        });
      } catch (error) {
        records.push({ ...dryRecord, verification: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  } finally {
    if (db) await db.end();
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    mode: options.apply ? 'apply' : 'dry-run',
    bucket: options.bucket,
    folder: options.folder,
    originalsDeleted: false,
    records,
  };
  const output = resolve(options.manifestPath);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  console.log(JSON.stringify({ mode: manifest.mode, inspected: records.length, verified: records.filter(record => record.verification === 'verified').length, failed: records.filter(record => record.verification === 'failed').length, manifest: output }));
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : 'Storage optimization failed.');
    process.exitCode = 1;
  });
}

export { inferCategory, optimizeBuffer, parseArgs };
