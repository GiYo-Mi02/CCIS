import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const galleryPage = readFileSync(new URL('../src/pages/GalleryPage.tsx', import.meta.url), 'utf8');

test('only gallery administrators can use drag-to-reorder controls', () => {
  assert.match(galleryPage, /draggable=\{isAdmin\}/);
  assert.match(galleryPage, /onDragStart=\{isAdmin \? \(e\) => handleDragStart\(e, item\.id\) : undefined\}/);
  assert.match(galleryPage, /onDrop=\{isAdmin \? \(e\) => handleDrop\(e, item\.id\) : undefined\}/);
});
