import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

test('public anonymous policies do not invoke authenticated role helpers', () => {
  const migration = read(
    'supabase',
    'migrations',
    '20260825044618_production_release_readiness_fixes.sql',
  );

  for (const policy of [
    'faqs_anon_read',
    'announcements_anon_read',
    'themes_anon_read',
    'photobooth_anon_featured_read',
  ]) {
    const definition = migration.match(
      new RegExp(`CREATE POLICY ${policy}[\\s\\S]*?;`, 'i'),
    )?.[0];
    assert.ok(definition, `missing ${policy}`);
    assert.doesNotMatch(definition, /get_user_role/i);
  }
});

test('registration screens use scoped RPCs instead of unrestricted profile reads', () => {
  const registration = read('src', 'admin', 'sections', 'RegistrationManager.tsx');
  const scanner = read('src', 'admin', 'sections', 'TicketScanner.tsx');
  const verification = read('src', 'admin', 'sections', 'VerificationManager.tsx');

  assert.match(registration, /rpc\('list_registration_admin_rows'/);
  assert.match(scanner, /rpc\('lookup_attendance_profile'/);
  assert.match(scanner, /rpc\('check_in_audience'/);
  assert.match(scanner, /rpc\('check_in_event_registration'/);
  assert.match(verification, /rpc\('list_pending_verifications'/);

  for (const source of [registration, scanner, verification]) {
    assert.doesNotMatch(source, /from\('profiles'\)/);
    assert.doesNotMatch(source, /profiles\s*\([^)]*(?:attendance_qr_code|last_ip|banned)/);
  }
});

test('verification RPC repair and admin notification badge stay aligned', () => {
  const repairMigration = read(
    'supabase',
    'migrations',
    '20260826031821_repair_pending_verification_rpc.sql',
  );
  const verification = read('src', 'admin', 'sections', 'VerificationManager.tsx');
  const sidebar = read('src', 'admin', 'components', 'AdminSidebar.tsx');

  assert.match(repairMigration, /CREATE OR REPLACE FUNCTION public\.list_pending_verifications\(/);
  assert.match(repairMigration, /SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(repairMigration, /public\.get_user_role\(\)[\s\S]*comm_registration/);
  assert.match(repairMigration, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon/);
  assert.match(repairMigration, /GRANT EXECUTE ON FUNCTION[\s\S]*TO authenticated/);
  assert.match(repairMigration, /NOTIFY pgrst, 'reload schema'/);

  assert.match(sidebar, /rpc\('list_pending_verifications'/);
  assert.match(sidebar, /pendingVerifications/);
  assert.match(sidebar, /admin-verification-count-changed/);
  assert.match(verification, /dispatchEvent\(new Event\('admin-verification-count-changed'\)\)/);
});

test('registration RPC repair is scoped and admin reads retry invalid sessions once', () => {
  const repairMigration = read(
    'supabase',
    'migrations',
    '20260826050836_repair_registration_admin_rpc.sql',
  );
  const registration = read('src', 'admin', 'sections', 'RegistrationManager.tsx');
  const scanner = read('src', 'admin', 'sections', 'TicketScanner.tsx');
  const requestHelper = read('src', 'lib', 'supabaseRequest.ts');

  assert.match(repairMigration, /CREATE OR REPLACE FUNCTION public\.list_registration_admin_rows\(/);
  assert.match(repairMigration, /SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(repairMigration, /public\.get_user_role\(\)[\s\S]*comm_registration/);
  assert.match(repairMigration, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon/);
  assert.match(repairMigration, /GRANT EXECUTE ON FUNCTION[\s\S]*TO authenticated/);
  assert.match(repairMigration, /NOTIFY pgrst, 'reload schema'/);

  assert.match(requestHelper, /PGRST301/);
  assert.match(requestHelper, /PGRST303/);
  assert.match(requestHelper, /supabase\.auth\.refreshSession\(\)/);
  assert.match(registration, /withSessionRefreshRetry/);
  assert.match(scanner, /withSessionRefreshRetry/);
});

test('release configuration is pinned and excludes the retired IP service', () => {
  const workflow = read('.github', 'workflows', 'typecheck.yml');
  const vercel = read('vercel.json');
  const headers = read('public', '_headers');

  assert.match(workflow, /version:\s*2\.115\.0/);
  assert.doesNotMatch(workflow, /version:\s*latest/);
  assert.doesNotMatch(vercel, /api\.ipify\.org/);
  assert.doesNotMatch(headers, /api\.ipify\.org/);
});

test('all deployment policies allow approved Patch video sources', () => {
  const policies = [read('index.html'), read('vercel.json'), read('public', '_headers')];
  const approvedMediaSources = /media-src 'self' blob: https:\/\/\*\.supabase\.co https:\/\/res\.cloudinary\.com;/;

  for (const policy of policies) {
    assert.match(policy, approvedMediaSources);
  }
});

test('legacy queue rows without leases are quarantined and cannot auto-retry', () => {
  const migration = read(
    'supabase',
    'migrations',
    '20260825044618_production_release_readiness_fixes.sql',
  );

  assert.match(
    migration,
    /WHERE status = 'processing'\s+AND lease_expires_at IS NULL;/,
  );
  assert.match(migration, /SET status = 'delivery_unknown'/);
  assert.match(
    migration,
    /lease_expires_at IS NULL[\s\S]*THEN 'delivery_unknown'/,
  );
});
