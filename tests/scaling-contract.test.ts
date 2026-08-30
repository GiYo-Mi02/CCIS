import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('all administrative image uploads use the shared optimizer', async () => {
  const files = await Promise.all([
    read('../src/admin/sections/OfficersManager.tsx'),
    read('../src/admin/sections/AnnouncementsManager.tsx'),
    read('../src/admin/sections/EventCalendar.tsx'),
    read('../src/components/gallery/AdminForm.tsx'),
    read('../src/pages/PatchPage.tsx'),
  ]);
  for (const source of files) assert.match(source, /uploadOptimizedImage/);
  assert.doesNotMatch(files.join('\n'), /cacheControl:\s*['"]3600['"]/);
});

test('chat is lazy, scoped, paginated, and lifecycle tracked', async () => {
  const [widget, studentPage, account, sidebar] = await Promise.all([
    read('../src/components/SupportWidget.tsx'),
    read('../src/pages/MessagesPage.tsx'),
    read('../src/pages/AccountPage.tsx'),
    read('../src/admin/components/AdminSidebar.tsx'),
  ]);
  assert.match(widget, /!isOpen/);
  assert.match(widget, /conversation_id=eq\.\$\{conversation\.id\}/);
  assert.match(studentPage, /MESSAGE_PAGE_SIZE = 30/);
  assert.match(studentPage, /registerRealtimeChannel/);
  assert.match(studentPage, /removeChannel/);
  assert.match(account, /activeTab !== 'messages'/);
  assert.doesNotMatch(sidebar, /list_pending_verifications|postgres_changes|setInterval/);
});

test('the scaling migration is forward-only and keeps unused indexes', async () => {
  const migration = await read('../supabase/migrations/20260828055012_optimize_scaling_egress_and_rls.sql');
  assert.match(migration, /create table if not exists public\.media_assets/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /\(select auth\.uid\(\)\)/i);
  assert.match(migration, /create index if not exists messages_sender_id_idx/i);
  assert.match(migration, /drop index if exists public\.messages_conversation_created_idx/i);
  assert.doesNotMatch(migration, /drop index[^;]*(unused|email_queue_dequeue|idx_profiles_role)/i);
  assert.match(migration, /if not exists \([\s\S]*internal\.email_outbox[\s\S]*public\.email_queue/i);
});

test('development telemetry is not installed in production', async () => {
  const source = await read('../src/lib/developmentTelemetry.ts');
  assert.match(source, /if \(!import\.meta\.env\.DEV/);
  assert.doesNotMatch(source, /authorization|apikey|access_token/i);
});

test('storage migration defaults to dry-run and never deletes originals', async () => {
  const source = await read('../scripts/optimize-existing-storage-assets.ts');
  assert.match(source, /const apply = argv\.includes\('--apply'\)/);
  assert.match(source, /originalsDeleted: false/);
  assert.doesNotMatch(source, /storage\.from\([^)]*\)\.remove/);
  assert.doesNotMatch(source, /from\(['"]storage\.objects/);
});
