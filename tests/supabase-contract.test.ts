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
  for (const name of ['process-email-queue', 'send-ticket-email', 'delete-user']) {
    const source = readFileSync(join(root, 'supabase', 'functions', name, 'index.ts'), 'utf8');
    assert.match(source, /req\.method\s*!==\s*["']POST["']/);
    assert.match(source, /MAX_BODY_BYTES/);
    assert.match(source, /content-type/i);
    assert.match(source, /PAYLOAD_TOO_LARGE/);
  }
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
