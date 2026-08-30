import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';

import { optimizeBuffer } from '../scripts/optimize-existing-storage-assets.ts';
import {
  buildVersionedMediaPath,
} from '../src/lib/media/imageOptimization.ts';
import { detectImageMimeType, validateImageFile } from '../src/lib/media/fileValidation.ts';
import { LONG_LIVED_CACHE_CONTROL, MEDIA_PRESETS } from '../src/lib/media/presets.ts';
import { resolveMediaProviderKind } from '../src/lib/media/providerSelection.ts';
import {
  getTrackedRealtimeChannelCount,
  mergeChatMessages,
  registerRealtimeChannel,
} from '../src/lib/chatLifecycle.ts';
import type { Message } from '../src/types/database.ts';

test('image signatures are validated independently of the file extension', async () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
  const disguised = new File([jpeg], 'portrait.png', { type: 'image/png' });

  assert.equal(detectImageMimeType(jpeg), 'image/jpeg');
  await assert.rejects(validateImageFile(disguised), /does not match/i);

  const valid = new File([jpeg], 'portrait.jpg', { type: 'image/jpeg' });
  const result = await validateImageFile(valid);
  assert.equal(result.mimeType, 'image/jpeg');
});

test('media presets enforce the required dimensions and hard size ceilings', () => {
  assert.equal(MEDIA_PRESETS.officer.maxLongEdge, 900);
  assert.equal(MEDIA_PRESETS.officer.hardMaxBytes, 300 * 1024);
  assert.equal(MEDIA_PRESETS.gallery.thumbnail?.hardMaxBytes, 200 * 1024);
  assert.equal(MEDIA_PRESETS.banner.hardMaxBytes, 1024 * 1024);
  assert.equal(MEDIA_PRESETS.patch.hardMaxBytes, 300 * 1024);
  assert.equal(LONG_LIVED_CACHE_CONTROL, '31536000, immutable');
});

test('storage optimizer generates bounded WebP main and thumbnail variants', async () => {
  const input = await sharp({
    create: {
      width: 2400,
      height: 1800,
      channels: 3,
      background: { r: 18, g: 53, b: 36 },
    },
  }).png().toBuffer();

  const main = await optimizeBuffer(input, 'gallery');
  const thumbnail = await optimizeBuffer(input, 'gallery', 480, {
    hard: 200 * 1024,
    quality: 78,
  });
  const [mainMetadata, thumbnailMetadata] = await Promise.all([
    sharp(main.buffer).metadata(),
    sharp(thumbnail.buffer).metadata(),
  ]);

  assert.equal(mainMetadata.format, 'webp');
  assert.ok(main.width <= 1600 && main.height <= 1600);
  assert.ok(main.buffer.length <= 600 * 1024);
  assert.equal(thumbnailMetadata.format, 'webp');
  assert.ok(thumbnail.width <= 480 && thumbnail.height <= 480);
  assert.ok(thumbnail.buffer.length <= 200 * 1024);
});

test('versioned paths are deterministic for the same optimized content', async () => {
  const first = await buildVersionedMediaPath('officers', 'Gio Portrait.JPG', new Blob(['same']));
  const second = await buildVersionedMediaPath('officers', 'renamed.png', new Blob(['same']));

  assert.match(first, /^officers\/v1\/[a-f0-9]{16}-gio-portrait\.webp$/);
  assert.equal(first.split('/').at(-1)?.split('-')[0], second.split('/').at(-1)?.split('-')[0]);
});

test('provider selection is safe and falls back to Supabase', () => {
  assert.equal(resolveMediaProviderKind(undefined, undefined), 'supabase');
  assert.equal(resolveMediaProviderKind('static', 'https://cdn.example.edu/'), 'static');
  assert.equal(resolveMediaProviderKind('static', undefined), 'supabase');
  assert.equal(resolveMediaProviderKind('unknown', 'https://cdn.example.edu'), 'supabase');
});

test('chat messages are deduplicated and Realtime registrations do not leak', () => {
  const base: Message = {
    id: '1',
    conversation_id: 'conversation',
    sender_id: 'student',
    sender_role: 'student',
    content: 'first',
    read_by_student: true,
    read_by_admin: false,
    created_at: '2026-08-28T00:00:00.000Z',
  };
  const merged = mergeChatMessages([base], [{ ...base, content: 'updated' }]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].content, 'updated');

  const before = getTrackedRealtimeChannelCount();
  const cleanup = registerRealtimeChannel('test-conversation');
  assert.equal(getTrackedRealtimeChannelCount(), before + 1);
  cleanup();
  cleanup();
  assert.equal(getTrackedRealtimeChannelCount(), before);
});

test('optimized image component is lazy, async-decoded, and dimension aware', async () => {
  const source = await readFile(new URL('../src/components/OptimizedImage.tsx', import.meta.url), 'utf8');
  assert.match(source, /loading=\{loading\}/);
  assert.match(source, /decoding="async"/);
  assert.match(source, /width=\{width\}/);
  assert.match(source, /height=\{height\}/);
});
