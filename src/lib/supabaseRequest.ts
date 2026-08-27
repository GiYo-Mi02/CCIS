import { supabase } from './supabase';

interface SupabaseErrorLike {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

interface SupabaseResult<T> {
  data: T | null;
  error: SupabaseErrorLike | null;
}

const INVALID_SESSION_CODES = new Set(['PGRST301', 'PGRST303']);

export function isInvalidSessionError(error: SupabaseErrorLike | null): boolean {
  if (!error) return false;
  if (error.code && INVALID_SESSION_CODES.has(error.code)) return true;
  return /(?:invalid|expired).*(?:jwt|token)|(?:jwt|token).*(?:invalid|expired)/i.test(error.message);
}

export async function withSessionRefreshRetry<T>(
  request: () => PromiseLike<SupabaseResult<T>>,
): Promise<SupabaseResult<T>> {
  const firstResult = await request();
  if (!isInvalidSessionError(firstResult.error)) return firstResult;

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshData.session) {
    return {
      data: null,
      error: {
        code: 'SESSION_REFRESH_FAILED',
        message: 'Your admin session expired. Please sign out and sign in again.',
      },
    };
  }

  return await request();
}
