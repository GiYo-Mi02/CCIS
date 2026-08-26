import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const scannerSource = readFileSync(
  new URL('../src/admin/sections/TicketScanner.tsx', import.meta.url),
  'utf8',
);

test('ticket scanner keeps camera discovery stable and supports laptop webcams', () => {
  assert.match(scannerSource, /const refreshCameras = useCallback\(async \(\) => \{/);
  assert.match(scannerSource, /\}, \[\]\);/);
  assert.match(scannerSource, /facingMode: "environment"/);
  assert.match(scannerSource, /facingMode: "user"/);
  assert.match(scannerSource, /addEventListener\?\.\('devicechange'/);
  assert.doesNotMatch(scannerSource, /\}, \[selectedCameraId\]\);/);
});

test('ticket scanner uses the atomic registration check-in RPC', () => {
  assert.match(scannerSource, /\.rpc\('check_in_event_registration'/);
  assert.doesNotMatch(scannerSource, /\.from\('event_registrations'\)/);
});
