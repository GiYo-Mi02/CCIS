import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';

type QueryResult<Row> = { rows: Row[] };
type PgClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<Row = Record<string, unknown>>(sql: string): Promise<QueryResult<Row>>;
};

const require = createRequire(import.meta.url);
const { Client } = require('pg') as {
  Client: new (config: Record<string, unknown>) => PgClient;
};

const AUDIENCE_SIZES = [50, 200, 500, 1_700] as const;

type BucketMetric = {
  bucket_id: string;
  object_count: string;
  total_bytes: string;
  average_bytes: string;
  maximum_bytes: string;
};

type FolderMetric = {
  bucket_id: string;
  folder: string;
  object_count: string;
  total_bytes: string;
};

type ObjectMetric = {
  bucket_id: string;
  name: string;
  bytes: string;
  mime_type: string;
  cache_control: string | null;
};

type CacheMetric = {
  bucket_id: string;
  cache_control: string | null;
  object_count: string;
};

type ReferenceMetric = {
  source: string;
  reference_count: string;
  matched_storage_count: string;
  referenced_bytes: string;
  average_bytes: string;
  maximum_bytes: string;
};

type PublicationMetric = { schemaname: string; tablename: string };
type CronMetric = { jobname: string; schedule: string; active: boolean };

type Audit = {
  capturedAt: string;
  databaseBytes: number;
  authUsers: number;
  buckets: BucketMetric[];
  folders: FolderMetric[];
  largeImages: ObjectMetric[];
  largeDocuments: ObjectMetric[];
  cacheControls: CacheMetric[];
  references: ReferenceMetric[];
  realtimeTables: PublicationMetric[];
  cronJobs: CronMetric[];
};

function redactObjectName(item: ObjectMetric): ObjectMetric {
  const parts = item.name.split('/');
  const originalName = parts.pop() || '';
  const folder = parts.join('/');
  const hash = createHash('sha256').update(`${item.bucket_id}/${item.name}`).digest('hex').slice(0, 12);
  const redactedName = `object-${hash}${extname(originalName).toLowerCase()}`;
  return { ...item, name: folder ? `${folder}/${redactedName}` : redactedName };
}

function bytes(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBytes(value: number): string {
  if (value === 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const unit = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** unit).toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}

function escapeCell(value: unknown): string {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function table(headers: string[], rows: unknown[][]): string {
  return [
    `| ${headers.map(escapeCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escapeCell).join(' | ')} |`),
  ].join('\n');
}

function connectionConfig(connectionString: string): Record<string, unknown> {
  const parsed = new URL(connectionString);
  const isLocal = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);
  return {
    connectionString,
    application_name: 'ccis-read-only-usage-audit',
    statement_timeout: 30_000,
    query_timeout: 35_000,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  };
}

async function collectAudit(client: PgClient): Promise<Audit> {
  await client.query('begin read only');
  try {
    const [summary, buckets, folders, largeImages, largeDocuments, cacheControls, references, realtimeTables, cronJobs] =
      await Promise.all([
        client.query<{ captured_at: string; database_bytes: string; auth_users: string }>(`
          select now()::text captured_at,
                 pg_database_size(current_database())::text database_bytes,
                 (select count(*) from auth.users)::text auth_users
        `),
        client.query<BucketMetric>(`
          with objects as (
            select bucket_id, coalesce(nullif(metadata->>'size', '')::bigint, 0) bytes
            from storage.objects
            where coalesce(is_delete_marker, false) = false
          )
          select bucket_id, count(*)::text object_count, sum(bytes)::text total_bytes,
                 round(avg(bytes))::bigint::text average_bytes, max(bytes)::text maximum_bytes
          from objects group by bucket_id order by bucket_id
        `),
        client.query<FolderMetric>(`
          with objects as (
            select bucket_id,
                   case when position('/' in name) > 0 then split_part(name, '/', 1) else '(root)' end folder,
                   coalesce(nullif(metadata->>'size', '')::bigint, 0) bytes
            from storage.objects
            where coalesce(is_delete_marker, false) = false
          )
          select bucket_id, folder, count(*)::text object_count, sum(bytes)::text total_bytes
          from objects group by bucket_id, folder order by bucket_id, folder
        `),
        client.query<ObjectMetric>(`
          select bucket_id, name, coalesce(nullif(metadata->>'size', '')::bigint, 0)::text bytes,
                 lower(coalesce(metadata->>'mimetype', '')) mime_type,
                 coalesce(metadata->>'cacheControl', metadata->>'cache-control') cache_control
          from storage.objects
          where coalesce(is_delete_marker, false) = false
            and (lower(coalesce(metadata->>'mimetype', '')) like 'image/%'
                 or name ~* '\\.(png|jpe?g|webp|avif|gif)$')
            and coalesce(nullif(metadata->>'size', '')::bigint, 0) > 500000
          order by coalesce(nullif(metadata->>'size', '')::bigint, 0) desc
        `),
        client.query<ObjectMetric>(`
          select bucket_id, name, coalesce(nullif(metadata->>'size', '')::bigint, 0)::text bytes,
                 lower(coalesce(metadata->>'mimetype', '')) mime_type,
                 coalesce(metadata->>'cacheControl', metadata->>'cache-control') cache_control
          from storage.objects
          where coalesce(is_delete_marker, false) = false
            and (lower(coalesce(metadata->>'mimetype', '')) = 'application/pdf' or name ~* '\\.pdf$')
            and coalesce(nullif(metadata->>'size', '')::bigint, 0) > 5000000
          order by coalesce(nullif(metadata->>'size', '')::bigint, 0) desc
        `),
        client.query<CacheMetric>(`
          select bucket_id,
                 nullif(coalesce(metadata->>'cacheControl', metadata->>'cache-control', ''), '') cache_control,
                 count(*)::text object_count
          from storage.objects
          where coalesce(is_delete_marker, false) = false
          group by bucket_id, cache_control order by bucket_id, cache_control
        `),
        client.query<ReferenceMetric>(`
          with refs as (
            select 'officers'::text source, photo_url url from public.officers where photo_url is not null
            union all select 'announcements', banner_url from public.announcements where banner_url is not null
            union all select 'events', banner_url from public.events where banner_url is not null
            union all select 'gallery_items', image_url from public.gallery_items where image_url is not null
            union all select 'gallery_item_thumbnails', u
              from public.gallery_items, unnest(coalesce(thumbnails, '{}'::text[])) u
            union all select 'photobooth_gallery', image_url
              from public.photobooth_gallery where image_url is not null
            union all select 'patch_videos', thumbnail_url
              from public.patch_videos where thumbnail_url is not null
            union all select 'transparency_report_pdf', pdf_url
              from public.transparency_reports where pdf_url is not null
            union all select 'transparency_report_thumbnail', thumbnail_url
              from public.transparency_reports where thumbnail_url is not null
          ), objects as (
            select bucket_id, name, coalesce(nullif(metadata->>'size', '')::bigint, 0) bytes
            from storage.objects where coalesce(is_delete_marker, false) = false
          ), matched as (
            select r.source, o.bucket_id, o.bytes
            from refs r left join objects o
              on r.url like '%/storage/v1/object/public/' || o.bucket_id || '/' || o.name
              or r.url like '%/storage/v1/object/public/' || o.bucket_id || '/' || replace(o.name, ' ', '%20')
          )
          select source, count(*)::text reference_count, count(bucket_id)::text matched_storage_count,
                 coalesce(sum(bytes), 0)::text referenced_bytes,
                 coalesce(round(avg(bytes))::bigint, 0)::text average_bytes,
                 coalesce(max(bytes), 0)::text maximum_bytes
          from matched group by source order by source
        `),
        client.query<PublicationMetric>(`
          select schemaname, tablename from pg_publication_tables
          where pubname = 'supabase_realtime' order by schemaname, tablename
        `),
        client.query<CronMetric>(`
          select jobname, schedule, active from cron.job order by jobname
        `),
      ]);

    const head = summary.rows[0];
    return {
      capturedAt: head.captured_at,
      databaseBytes: bytes(head.database_bytes),
      authUsers: bytes(head.auth_users),
      buckets: buckets.rows,
      folders: folders.rows,
      largeImages: largeImages.rows.map(redactObjectName),
      largeDocuments: largeDocuments.rows.map(redactObjectName),
      cacheControls: cacheControls.rows,
      references: references.rows,
      realtimeTables: realtimeTables.rows,
      cronJobs: cronJobs.rows,
    };
  } finally {
    await client.query('rollback');
  }
}

function toMarkdown(audit: Audit): string {
  const totalStorage = audit.buckets.reduce((total, item) => total + bytes(item.total_bytes), 0);
  const lines = [
    '# Supabase Scaling Baseline',
    '',
    `Captured: ${audit.capturedAt}`,
    '',
    `- Database size: ${formatBytes(audit.databaseBytes)}`,
    `- Storage size: ${formatBytes(totalStorage)}`,
    `- Auth users: ${audit.authUsers}`,
    '',
    '## Storage by bucket',
    '',
    table(
      ['Bucket', 'Objects', 'Total', 'Average', 'Maximum'],
      audit.buckets.map((item) => [
        item.bucket_id,
        item.object_count,
        formatBytes(bytes(item.total_bytes)),
        formatBytes(bytes(item.average_bytes)),
        formatBytes(bytes(item.maximum_bytes)),
      ]),
    ),
    '',
    '## Storage by folder',
    '',
    table(
      ['Bucket', 'Folder', 'Objects', 'Total'],
      audit.folders.map((item) => [item.bucket_id, item.folder, item.object_count, formatBytes(bytes(item.total_bytes))]),
    ),
    '',
    '## Cache-Control inventory',
    '',
    table(
      ['Bucket', 'Cache-Control', 'Objects'],
      audit.cacheControls.map((item) => [item.bucket_id, item.cache_control ?? '(missing)', item.object_count]),
    ),
    '',
    '## Images larger than 500 KB',
    '',
    table(
      ['Bucket', 'Path', 'Size', 'MIME type', 'Cache-Control'],
      audit.largeImages.map((item) => [
        item.bucket_id,
        item.name,
        formatBytes(bytes(item.bytes)),
        item.mime_type,
        item.cache_control ?? '(missing)',
      ]),
    ),
    '',
    '## Documents larger than 5 MB',
    '',
    table(
      ['Bucket', 'Path', 'Size', 'MIME type', 'Cache-Control'],
      audit.largeDocuments.map((item) => [
        item.bucket_id,
        item.name,
        formatBytes(bytes(item.bytes)),
        item.mime_type,
        item.cache_control ?? '(missing)',
      ]),
    ),
    '',
    '## Referenced page media and egress estimates',
    '',
    table(
      ['Surface', 'References', 'Matched', 'Per complete load', ...AUDIENCE_SIZES.map(String)],
      audit.references.map((item) => {
        const perLoad = bytes(item.referenced_bytes);
        return [
          item.source,
          item.reference_count,
          item.matched_storage_count,
          formatBytes(perLoad),
          ...AUDIENCE_SIZES.map((users) => formatBytes(perLoad * users)),
        ];
      }),
    ),
    '',
    'Estimates assume each referenced object is transferred once per complete surface load. Browser caching, lazy loading, and CDN hits can reduce actual transfer; repeat visits and cache misses can increase it.',
    '',
    '## Realtime publication',
    '',
    table(['Schema', 'Table'], audit.realtimeTables.map((item) => [item.schemaname, item.tablename])),
    '',
    '## Active cron schedules',
    '',
    table(['Job', 'Schedule', 'Active'], audit.cronJobs.map((item) => [item.jobname, item.schedule, item.active])),
    '',
  ];
  return lines.join('\n');
}

async function main(): Promise<void> {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error('SUPABASE_DB_URL is required. The audit never prints this value.');
  }

  const client = new Client(connectionConfig(connectionString));
  await client.connect();
  try {
    const audit = await collectAudit(client);
    if (process.argv.includes('--json')) {
      process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
    } else {
      process.stdout.write(`${toMarkdown(audit)}\n`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown audit error';
  process.stderr.write(`Supabase usage audit failed: ${message}\n`);
  process.exitCode = 1;
});
