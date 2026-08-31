import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import sharp from 'sharp';

import { optimizeImageBuffer, type ServerOptimizationResult } from '../api/_lib/image-optimizer.ts';
import {
  assertAuthorizedMediaRequest,
  IMAGE_STAGING_BUCKET,
  MAX_IMAGE_INPUT_BYTES,
  MediaRequestError,
  parseOptimizeMediaRequest,
} from '../api/_lib/media-policy.ts';
import {
  processStagedImage,
  type MediaAssetInsert,
  type MediaPipelineGateway,
} from '../api/_lib/media-pipeline.ts';
import { getManagedImagePathsFromUrl } from '../src/lib/media/managedPaths.ts';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const SOURCE_PATH = `image-processing/${USER_ID}/${SOURCE_ID}.jpg`;

test('Sharp rotates images, strips metadata, and emits bounded WebP output', async () => {
  const input = await sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 3,
      background: { r: 18, g: 53, b: 36 },
    },
  })
    .withMetadata({ orientation: 6 })
    .jpeg({ quality: 95 })
    .toBuffer();

  const result = await optimizeImageBuffer(input, 'officer');
  const main = result.variants.find(variant => variant.label === 'main');
  assert.ok(main);
  assert.equal(main.mimeType, 'image/webp');
  assert.equal(main.width, 600);
  assert.equal(main.height, 900);
  assert.ok(main.sizeBytes <= 300 * 1024);

  const metadata = await sharp(main.buffer).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.xmp, undefined);
  assert.equal(metadata.orientation, undefined);
});

test('Sharp rejects malformed images and input beyond the upload limit', async () => {
  await assert.rejects(optimizeImageBuffer(Buffer.from('not-an-image'), 'gallery'), (error: unknown) =>
    error instanceof MediaRequestError && error.code === 'INVALID_IMAGE');
  await assert.rejects(
    optimizeImageBuffer(Buffer.alloc(MAX_IMAGE_INPUT_BYTES + 1), 'gallery'),
    (error: unknown) => error instanceof MediaRequestError && error.status === 413,
  );
});

test('PNG and existing WebP inputs are converted to optimized WebP with their aspect ratio intact', async () => {
  const source = sharp({
    create: { width: 1000, height: 500, channels: 3, background: { r: 245, g: 180, b: 0 } },
  });
  const [png, webp] = await Promise.all([
    source.clone().png().toBuffer(),
    source.clone().webp({ quality: 95 }).toBuffer(),
  ]);

  for (const input of [png, webp]) {
    const result = await optimizeImageBuffer(input, 'gallery');
    const main = result.variants.find(variant => variant.label === 'main');
    assert.ok(main);
    assert.equal((await sharp(main.buffer).metadata()).format, 'webp');
    assert.equal(main.width, 1000);
    assert.equal(main.height, 500);
    assert.equal(main.width / main.height, 2);
  }
});

test('small images are not enlarged and unnecessary responsive variants are skipped', async () => {
  const input = await sharp({
    create: { width: 200, height: 100, channels: 3, background: { r: 250, g: 247, b: 234 } },
  }).jpeg().toBuffer();
  const result = await optimizeImageBuffer(input, 'banner');

  assert.equal(result.variants.length, 1);
  assert.equal(result.variants[0].label, 'main');
  assert.equal(result.variants[0].width, 200);
  assert.equal(result.variants[0].height, 100);
});

test('images with an excessive dimension are rejected before variant encoding', async () => {
  const input = await sharp({
    create: { width: 17_000, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } },
  }).png().toBuffer();
  await assert.rejects(
    optimizeImageBuffer(input, 'banner'),
    (error: unknown) => error instanceof MediaRequestError && error.code === 'INVALID_IMAGE',
  );
});

test('managed URL cleanup resolves every sibling variant but ignores legacy paths', () => {
  const version = '44444444-4444-4444-8444-444444444444';
  const url = `https://example.supabase.co/storage/v1/object/public/banners/announcements/v2/${version}/main.webp`;
  const managed = getManagedImagePathsFromUrl(url, 'banners');
  assert.ok(managed);
  assert.deepEqual(managed.paths, ['main', 'thumbnail', 'card', 'mobile'].map(label =>
    `announcements/v2/${version}/${label}.webp`));
  assert.equal(
    getManagedImagePathsFromUrl(url.replace('/main.webp', '/card.webp'), 'banners')?.mainPath,
    `announcements/v2/${version}/main.webp`,
  );
  assert.equal(getManagedImagePathsFromUrl(url, 'gallery-images'), null);
  assert.equal(getManagedImagePathsFromUrl('https://example.supabase.co/storage/v1/object/public/banners/legacy/photo.jpg', 'banners'), null);
});

test('media request policy binds user path, role, destination, and entity type', () => {
  const request = parseOptimizeMediaRequest({
    sourcePath: SOURCE_PATH,
    category: 'banner',
    bucket: 'banners',
    folder: 'announcements',
    entityType: 'announcements',
  });
  assert.doesNotThrow(() => assertAuthorizedMediaRequest(request, USER_ID, 'comm_content'));
  assert.throws(
    () => assertAuthorizedMediaRequest(request, USER_ID, 'student'),
    (error: unknown) => error instanceof MediaRequestError && error.status === 403,
  );
  assert.throws(
    () => assertAuthorizedMediaRequest({ ...request, sourcePath: `image-processing/33333333-3333-4333-8333-333333333333/${SOURCE_ID}.jpg` }, USER_ID, 'comm_content'),
    /staged image path/i,
  );
  assert.throws(
    () => assertAuthorizedMediaRequest({ ...request, bucket: 'gallery-images' }, USER_ID, 'comm_content'),
    /not authorized/i,
  );
});

class FakeGateway implements MediaPipelineGateway {
  uploaded: string[] = [];
  removed: Array<{ bucket: string; paths: string[] }> = [];
  events: string[] = [];
  metadata: MediaAssetInsert | null = null;
  failUploadAt = 0;
  failMetadata = false;

  async download(bucket: string, path: string): Promise<Buffer> {
    assert.equal(bucket, IMAGE_STAGING_BUCKET);
    assert.equal(path, SOURCE_PATH);
    return Buffer.from('source');
  }

  async upload(bucket: string, path: string): Promise<void> {
    assert.equal(bucket, 'banners');
    if (this.failUploadAt > 0 && this.uploaded.length + 1 === this.failUploadAt) {
      throw new Error('upload failed');
    }
    this.uploaded.push(path);
  }

  async remove(bucket: string, paths: string[]): Promise<void> {
    this.events.push(`remove:${bucket}`);
    this.removed.push({ bucket, paths: [...paths] });
  }

  getPublicUrl(bucket: string, path: string): string {
    return `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}`;
  }

  async insertMediaAsset(metadata: MediaAssetInsert): Promise<void> {
    if (this.failMetadata) throw new Error('metadata failed');
    this.events.push('insert-metadata');
    this.metadata = metadata;
  }
}

const fakeOptimization: ServerOptimizationResult = {
  originalSizeBytes: 1000,
  originalWidth: 1200,
  originalHeight: 800,
  variants: [
    { label: 'main', buffer: Buffer.from('main'), width: 1200, height: 800, sizeBytes: 4, mimeType: 'image/webp' },
    { label: 'card', buffer: Buffer.from('card'), width: 960, height: 640, sizeBytes: 4, mimeType: 'image/webp' },
  ],
};

const pipelineRequest = parseOptimizeMediaRequest({
  sourcePath: SOURCE_PATH,
  category: 'banner',
  bucket: 'banners',
  folder: 'announcements',
  entityType: 'announcements',
});

test('pipeline persists metadata before removing the staged original', async () => {
  const gateway = new FakeGateway();
  const result = await processStagedImage(pipelineRequest, gateway, async () => fakeOptimization);

  assert.equal(result.asset.variants.length, 1);
  assert.match(result.asset.path, /^announcements\/v2\/[0-9a-f-]{36}\/main\.webp$/);
  assert.equal(gateway.metadata?.storage_path, result.asset.path);
  assert.equal(gateway.removed[0].bucket, IMAGE_STAGING_BUCKET);
  assert.ok(gateway.metadata);
  assert.deepEqual(gateway.events, ['insert-metadata', `remove:${IMAGE_STAGING_BUCKET}`]);
});

test('pipeline cleans partial outputs and staging after an upload failure', async () => {
  const gateway = new FakeGateway();
  gateway.failUploadAt = 2;
  await assert.rejects(processStagedImage(pipelineRequest, gateway, async () => fakeOptimization), /upload failed/);

  assert.equal(gateway.uploaded.length, 1);
  assert.ok(gateway.removed.some(entry => entry.bucket === 'banners' && entry.paths[0] === gateway.uploaded[0]));
  assert.ok(gateway.removed.some(entry => entry.bucket === IMAGE_STAGING_BUCKET && entry.paths[0] === SOURCE_PATH));
});

test('pipeline removes every generated variant when metadata insertion fails', async () => {
  const gateway = new FakeGateway();
  gateway.failMetadata = true;
  await assert.rejects(processStagedImage(pipelineRequest, gateway, async () => fakeOptimization), /metadata failed/);

  assert.equal(gateway.uploaded.length, 2);
  assert.ok(gateway.removed.some(entry =>
    entry.bucket === 'banners' && gateway.uploaded.every(path => entry.paths.includes(path))));
  assert.ok(!gateway.removed.some(entry => entry.bucket === IMAGE_STAGING_BUCKET && entry.paths[0] === SOURCE_PATH));
});
