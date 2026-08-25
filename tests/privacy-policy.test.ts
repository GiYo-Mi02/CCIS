import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('../src/pages/PrivacyPolicyPage.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const footer = readFileSync(new URL('../src/components/Footer.tsx', import.meta.url), 'utf8');

test('privacy policy is public, linkable, and informational only', () => {
  assert.match(app, /window\.location\.pathname === '\/privacy'/);
  assert.match(app, /activeTab === 'privacy'/);
  assert.match(footer, /onNavClick\('privacy'\)/);
  assert.match(page, /Data Privacy Act of 2012/);
  assert.match(page, /Information we collect/);
  assert.match(page, /Your privacy rights/);
  assert.match(page, /dprms@umak\.edu\.ph/);
  assert.doesNotMatch(page, /<(input|select|textarea)\b/);
});
