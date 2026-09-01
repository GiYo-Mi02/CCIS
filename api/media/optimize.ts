import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Buffer } from 'node:buffer';
import { processStagedImage, type MediaAssetInsert, type MediaPipelineGateway } from '../_lib/media-pipeline.ts';
import {
  assertAuthorizedMediaRequest,
  MediaRequestError,
  parseOptimizeMediaRequest,
} from '../_lib/media-policy.ts';

interface RequestWithBody extends IncomingMessage {
  body?: unknown;
}

interface ProfileAuthorization {
  role: string;
  status: string;
  banned: boolean;
  banned_until: string | null;
}

const MAX_JSON_BODY_BYTES = 16 * 1024;

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

function getBearerToken(request: IncomingMessage): string {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    throw new MediaRequestError('Authentication is required.', 401, 'UNAUTHORIZED');
  }
  const token = authorization.slice('Bearer '.length);
  if (token.length < 20 || token.length > 8192) {
    throw new MediaRequestError('Invalid authentication token.', 401, 'UNAUTHORIZED');
  }
  return token;
}

async function readJsonBody(request: RequestWithBody): Promise<unknown> {
  if (request.body !== undefined) {
    if (typeof request.body === 'string') {
      if (Buffer.byteLength(request.body) > MAX_JSON_BODY_BYTES) {
        throw new MediaRequestError('The request body is too large.', 413, 'REQUEST_TOO_LARGE');
      }
      return JSON.parse(request.body) as unknown;
    }
    return request.body;
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > MAX_JSON_BODY_BYTES) {
      throw new MediaRequestError('The request body is too large.', 413, 'REQUEST_TOO_LARGE');
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) {
    throw new MediaRequestError('A JSON request body is required.', 400, 'INVALID_REQUEST');
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function createUserClient(token: string): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new MediaRequestError('The image service is not configured.', 503, 'SERVICE_UNAVAILABLE');
  }

  return createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function createGateway(client: SupabaseClient): MediaPipelineGateway {
  return {
    async download(bucket, path) {
      const { data, error } = await client.storage.from(bucket).download(path);
      if (error || !data) throw new MediaRequestError('The staged image could not be read.', 422, 'STAGED_IMAGE_UNAVAILABLE');
      return Buffer.from(await data.arrayBuffer());
    },
    async upload(bucket, path, content, options) {
      const { error } = await client.storage.from(bucket).upload(path, content, options);
      if (error) throw new MediaRequestError('An optimized image could not be stored.', 502, 'STORAGE_UPLOAD_FAILED');
    },
    async remove(bucket, paths) {
      const { error } = await client.storage.from(bucket).remove(paths);
      if (error) throw new MediaRequestError('Temporary image cleanup failed.', 502, 'STORAGE_CLEANUP_FAILED');
    },
    getPublicUrl(bucket, path) {
      return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    },
    async insertMediaAsset(metadata: MediaAssetInsert) {
      const { error } = await client.from('media_assets').insert(metadata);
      if (error) throw new MediaRequestError('Image metadata could not be saved.', 502, 'METADATA_SAVE_FAILED');
    },
  };
}

function isActivelyBanned(profile: ProfileAuthorization): boolean {
  return profile.banned && (!profile.banned_until || new Date(profile.banned_until).getTime() > Date.now());
}

export default async function handler(request: RequestWithBody, response: ServerResponse): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported.' } });
    return;
  }

  try {
    const contentType = request.headers['content-type'];
    if (!contentType?.toLowerCase().startsWith('application/json')) {
      throw new MediaRequestError('Content-Type must be application/json.', 415, 'UNSUPPORTED_MEDIA_TYPE');
    }

    const token = getBearerToken(request);
    const body = parseOptimizeMediaRequest(await readJsonBody(request));
    const client = createUserClient(token);
    const { data: authData, error: authError } = await client.auth.getUser(token);
    if (authError || !authData.user) {
      throw new MediaRequestError('Your session is no longer valid.', 401, 'UNAUTHORIZED');
    }

    const { data: profileData, error: profileError } = await client
      .from('profiles')
      .select('role,status,banned,banned_until')
      .eq('id', authData.user.id)
      .single();
    if (profileError || !profileData) {
      throw new MediaRequestError('An approved staff profile is required.', 403, 'FORBIDDEN');
    }

    const profile = profileData as ProfileAuthorization;
    if (profile.status !== 'approved' || isActivelyBanned(profile)) {
      throw new MediaRequestError('An active approved staff profile is required.', 403, 'FORBIDDEN');
    }
    assertAuthorizedMediaRequest(body, authData.user.id, profile.role);

    const result = await processStagedImage(body, createGateway(client));
    sendJson(response, 200, { data: result });
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.' } });
      return;
    }
    if (error instanceof MediaRequestError) {
      sendJson(response, error.status, { error: { code: error.code, message: error.message } });
      return;
    }
    console.error('[media-optimize] unexpected failure', error instanceof Error ? error.name : 'UnknownError');
    sendJson(response, 500, { error: { code: 'INTERNAL_ERROR', message: 'The image could not be processed.' } });
  }
}
