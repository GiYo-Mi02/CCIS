import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const require = createRequire(import.meta.url);

test('email worker runtime dependencies are installed', () => {
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

  assert.equal(packageJson.dependencies.nodemailer, '9.0.5');
  assert.doesNotThrow(() => require.resolve('nodemailer'));
});

test('development coordinator launches Node services without a shell', () => {
  const source = readFileSync(join(root, 'dev.js'), 'utf8');

  assert.doesNotMatch(source, /shell\s*:\s*true/);
  assert.match(source, /spawn\(process\.execPath/);
  assert.match(source, /Vite remains available, but local email delivery is disabled/);
  assert.doesNotMatch(source, /workerProcess\.on\(['"]exit['"][\s\S]*?cleanup\(\)/);
});
