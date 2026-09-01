import type { MediaCategory } from '../../src/lib/media/types.ts';
import { MAX_UPLOAD_IMAGE_BYTES } from '../../src/lib/media/limits.ts';

export const IMAGE_STAGING_BUCKET = 'ccis-private-drafts';
export const MAX_IMAGE_INPUT_BYTES = MAX_UPLOAD_IMAGE_BYTES;
export const MAX_IMAGE_INPUT_PIXELS = 40_000_000;
export const MAX_IMAGE_DIMENSION = 16_384;

export type StaffRole =
  | 'devcom_head'
  | 'officer'
  | 'comm_content'
  | 'comm_registration'
  | 'comm_photobooth';

export interface OptimizeMediaRequest {
  sourcePath: string;
  category: MediaCategory;
  bucket: string;
  folder: string;
  entityType?: string;
  entityId?: string;
}

interface UploadPolicy {
  category: MediaCategory;
  bucket: string;
  entityType: string;
  folder: string | RegExp;
  roles: readonly StaffRole[];
}

const UPLOAD_POLICIES: readonly UploadPolicy[] = [
  {
    category: 'officer',
    bucket: 'gallery-images',
    entityType: 'officers',
    folder: 'officers',
    roles: ['devcom_head'],
  },
  {
    category: 'banner',
    bucket: 'banners',
    entityType: 'announcements',
    folder: 'announcements',
    roles: ['devcom_head', 'comm_content'],
  },
  {
    category: 'banner',
    bucket: 'banners',
    entityType: 'events',
    folder: 'events',
    roles: ['devcom_head', 'comm_content'],
  },
  {
    category: 'gallery',
    bucket: 'gallery-images',
    entityType: 'gallery_items',
    folder: /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/,
    roles: ['devcom_head', 'comm_photobooth'],
  },
  {
    category: 'patch',
    bucket: 'patch-thumbnails',
    entityType: 'patch_videos',
    folder: 'episodes',
    roles: ['devcom_head', 'comm_content'],
  },
  {
    category: 'document-thumbnail',
    bucket: 'bukas-kaban-reports',
    entityType: 'transparency_reports',
    folder: 'previews',
    roles: ['devcom_head', 'officer'],
  },
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCE_PATH_PATTERN = /^image-processing\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.(?:jpe?g|png|webp|avif)$/i;

export class MediaRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'MediaRequestError';
  }
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    throw new MediaRequestError(`Invalid ${field}.`, 400, 'INVALID_REQUEST');
  }
  return value;
}

export function parseOptimizeMediaRequest(value: unknown): OptimizeMediaRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MediaRequestError('A JSON request body is required.', 400, 'INVALID_REQUEST');
  }

  const body = value as Record<string, unknown>;
  const category = readRequiredString(body.category, 'category') as MediaCategory;
  const request: OptimizeMediaRequest = {
    sourcePath: readRequiredString(body.sourcePath, 'source path'),
    category,
    bucket: readRequiredString(body.bucket, 'bucket'),
    folder: readRequiredString(body.folder, 'folder'),
    entityType: readRequiredString(body.entityType, 'entity type'),
  };

  if (body.entityId !== undefined && body.entityId !== null && body.entityId !== '') {
    const entityId = readRequiredString(body.entityId, 'entity ID');
    if (!UUID_PATTERN.test(entityId)) {
      throw new MediaRequestError('Invalid entity ID.', 400, 'INVALID_REQUEST');
    }
    request.entityId = entityId;
  }

  return request;
}

export function assertAuthorizedMediaRequest(
  request: OptimizeMediaRequest,
  userId: string,
  role: string,
): void {
  const sourceMatch = SOURCE_PATH_PATTERN.exec(request.sourcePath);
  if (!sourceMatch || sourceMatch[1].toLowerCase() !== userId.toLowerCase() || !UUID_PATTERN.test(sourceMatch[2])) {
    throw new MediaRequestError('The staged image path is invalid.', 403, 'FORBIDDEN');
  }

  const policy = UPLOAD_POLICIES.find(candidate =>
    candidate.category === request.category
    && candidate.bucket === request.bucket
    && candidate.entityType === request.entityType
    && (typeof candidate.folder === 'string'
      ? candidate.folder === request.folder
      : candidate.folder.test(request.folder)),
  );

  if (!policy || !policy.roles.includes(role as StaffRole)) {
    throw new MediaRequestError('You are not authorized to upload this image.', 403, 'FORBIDDEN');
  }
}
