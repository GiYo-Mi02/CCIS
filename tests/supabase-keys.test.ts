import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveSupabasePublishableKey,
  resolveSupabaseSecretKey,
} from '../supabase/functions/_shared/supabase-keys.js';

const reader = (values: Record<string, string | undefined>) => (name: string) => values[name];

test('resolves migrated Supabase key maps by their default name', () => {
  assert.equal(
    resolveSupabaseSecretKey(reader({ SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_test' }) })),
    'sb_secret_test',
  );
  assert.equal(
    resolveSupabasePublishableKey(reader({ SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: 'sb_publishable_test' }) })),
    'sb_publishable_test',
  );
});

test('falls back to explicit and legacy Supabase environment variables', () => {
  assert.equal(resolveSupabaseSecretKey(reader({ SUPABASE_SECRET_KEY: 'server-secret' })), 'server-secret');
  assert.equal(resolveSupabaseSecretKey(reader({ SUPABASE_SERVICE_ROLE_KEY: 'legacy-service-role' })), 'legacy-service-role');
  assert.equal(resolveSupabasePublishableKey(reader({ SUPABASE_ANON_KEY: 'legacy-anon' })), 'legacy-anon');
});

test('ignores malformed or blank Supabase key maps', () => {
  assert.equal(
    resolveSupabaseSecretKey(reader({ SUPABASE_SECRET_KEYS: '{bad json', SUPABASE_SERVICE_ROLE_KEY: 'fallback' })),
    'fallback',
  );
  assert.equal(resolveSupabasePublishableKey(reader({ SUPABASE_PUBLISHABLE_KEYS: '{"default":""}' })), undefined);
});
