import test from 'node:test';
import assert from 'node:assert/strict';
import { postgrestIlike, postgrestEquals } from '../src/lib/postgrest.js';

test('postgrestEquals safely quotes values', () => {
  assert.equal(postgrestEquals('hello'), '"hello"');
  assert.equal(postgrestEquals('CCIS-PASS-1234'), '"CCIS-PASS-1234"');
  assert.equal(postgrestEquals('quotes"and\\slashes'), '"quotes\\"and\\\\slashes"');
});

test('postgrestEquals rejects null bytes', () => {
  assert.throws(() => postgrestEquals('evil\0value'), /Filter value is invalid/);
});

test('postgrestIlike escapes wildcards and limits length', () => {
  assert.equal(postgrestIlike('student'), '"%student%"');
  assert.equal(postgrestIlike('100%_score'), '"%100\\\\%\\\\_score%"');
  assert.equal(postgrestIlike('   trimmed   '), '"%trimmed%"');
});

test('postgrestIlike rejects oversized input', () => {
  const longString = 'a'.repeat(250);
  assert.throws(() => postgrestIlike(longString), /Search value is invalid or too long/);
});
