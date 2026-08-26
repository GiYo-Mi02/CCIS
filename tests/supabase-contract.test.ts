import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const migrationsDir = join(root, 'supabase', 'migrations');
const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();

test('all SECURITY DEFINER migration definitions pin search_path', () => {
  for (const file of migrationFiles) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    const definitions = sql.split(/CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION/i).slice(1);
    for (const definition of definitions) {
      if (!/SECURITY\s+DEFINER/i.test(definition)) continue;
      assert.match(definition, /SET\s+search_path\s*=\s*''/i, `${file} contains a mutable SECURITY DEFINER search_path`);
    }
  }
});

test('legacy dequeue overload and anonymous gallery policy are absent from migrations', () => {
  const combined = migrationFiles
    .map((file) => readFileSync(join(migrationsDir, file), 'utf8'))
    .join('\n');
  assert.doesNotMatch(combined, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.dequeue_emails\s*\(\s*INTEGER\s*\)\s+TO\s+(?:anon|authenticated)/i);
  assert.doesNotMatch(combined, /FOR\s+INSERT\s+WITH\s+CHECK\s*\([^)]*profile_id\s+IS\s+NULL/i);
});

test('Edge Functions enforce POST and bounded request bodies', () => {
  for (const name of ['process-email-queue', 'send-ticket-email', 'delete-user', 'report-client-error']) {
    const source = readFileSync(join(root, 'supabase', 'functions', name, 'index.ts'), 'utf8');
    assert.match(source, /req\.method\s*!==\s*["']POST["']/);
    assert.match(source, /MAX_BODY_BYTES/);
    assert.match(source, /content-type/i);
    assert.match(source, /PAYLOAD_TOO_LARGE/);
  }
});

test('Edge Functions resolve migrated Supabase API key maps', () => {
  const sharedSource = readFileSync(join(root, 'supabase', 'functions', '_shared', 'supabase-keys.js'), 'utf8');
  assert.match(sharedSource, /SUPABASE_SECRET_KEYS/);
  assert.match(sharedSource, /SUPABASE_PUBLISHABLE_KEYS/);

  for (const name of ['process-email-queue', 'send-ticket-email', 'delete-user']) {
    const source = readFileSync(join(root, 'supabase', 'functions', name, 'index.ts'), 'utf8');
    assert.match(source, /resolveSupabaseSecretKey/);
  }

  const config = readFileSync(join(root, 'supabase', 'config.toml'), 'utf8');
  assert.match(config, /\[functions\.process-email-queue\]\s+verify_jwt\s*=\s*false/);
  assert.match(config, /\[functions\.send-ticket-email\]\s+verify_jwt\s*=\s*true/);
  assert.match(config, /\[functions\.delete-user\]\s+verify_jwt\s*=\s*true/);
  assert.match(config, /\[functions\.report-client-error\]\s+verify_jwt\s*=\s*false/);
});

test('the error boundary reports only a redacted reference event', () => {
  const source = readFileSync(join(root, 'src', 'components', 'ErrorBoundary.tsx'), 'utf8');
  assert.match(source, /functions\.invoke\('report-client-error'/);
  assert.match(source, /referenceId/);
  assert.doesNotMatch(source, /error\.message/);
});

test('client error reports use a bounded global rate limit', () => {
  const source = readFileSync(join(root, 'supabase', 'functions', 'report-client-error', 'index.ts'), 'utf8');
  assert.match(source, /p_subject:\s*"global"/);
  assert.match(source, /p_limit:\s*10/);
  assert.match(source, /p_window_seconds:\s*3600/);
  assert.doesNotMatch(source, /x-forwarded-for|cf-connecting-ip|x-real-ip/);
});

test('email worker alerts use an independent webhook', () => {
  const source = migrationFiles
    .map((file) => readFileSync(join(migrationsDir, file), 'utf8'))
    .join('\n');
  assert.match(source, /internal\.notify_email_worker_alerts/);
  assert.match(source, /email_worker_alert_webhook_url/);
  assert.match(source, /net\.http_post/);
});

test('browser code cannot invoke the internal email worker', () => {
  const sourceFiles = readdirSync(join(root, 'src'), { recursive: true })
    .filter((entry): entry is string => typeof entry === 'string' && /\.(?:ts|tsx)$/.test(entry));
  const combined = sourceFiles
    .map((file) => readFileSync(join(root, 'src', file), 'utf8'))
    .join('\n');
  assert.doesNotMatch(combined, /functions\.invoke\(['"]process-email-queue['"]\)/);
  assert.doesNotMatch(combined, /api\.ipify\.org/);
});

test('OAuth session hydration is deferred outside the auth callback', () => {
  const source = readFileSync(join(root, 'src', 'context', 'AuthContext.tsx'), 'utf8');

  assert.doesNotMatch(
    source,
    /onAuthStateChange\s*\(\s*async\s*\(/,
    'onAuthStateChange must not use an async callback',
  );
  assert.match(
    source,
    /onAuthStateChange\s*\(\s*\(event, newSession\)\s*=>\s*\{[\s\S]*?scheduleSessionProcessing\(event, newSession\);[\s\S]*?\}\s*,\s*\)/,
    'the auth callback should synchronously schedule session processing',
  );
  assert.match(
    source,
    /window\.setTimeout\(\(\)\s*=>\s*\{[\s\S]*?void processAuthSession\(event, newSession, revision\);[\s\S]*?\},\s*0\)/,
    'profile hydration must run after the auth callback releases its lock',
  );
});
