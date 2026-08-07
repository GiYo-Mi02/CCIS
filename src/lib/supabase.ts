import { createClient } from '@supabase/supabase-js';

// --- CLIENT CLOCK SKEW AUTOCORRECTION ---
// If the user's system clock is behind (e.g. due to timezone/DST issues), Supabase/GoTrue
// rejects session parsing. We detect the skew from the JWT 'iat' claim and pass it to
// Supabase's own clockSkewInSeconds option — scoped only to Supabase, not global Date.now.
let clockSkewSeconds = 0;
try {
  let token: string | null = null;

  // 1. Parse from URL hash if returning from OAuth
  const hash = window.location.hash;
  if (hash && hash.includes('access_token=')) {
    const params = new URLSearchParams(hash.substring(1));
    token = params.get('access_token');
  }

  // 2. Parse from sessionStorage/localStorage session cache
  if (!token) {
    for (const storage of [sessionStorage, localStorage]) {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          const val = storage.getItem(key);
          if (val) {
            const parsed = JSON.parse(val);
            token = parsed?.currentSession?.access_token || parsed?.access_token || null;
          }
          break;
        }
      }
      if (token) break;
    }
  }

  // 3. Compute skew in seconds from IAT claim
  if (token) {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payloadDecoded = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadDecoded);
      if (payload?.iat) {
        const iatMs = payload.iat * 1000;
        const nowMs = Date.now();
        if (iatMs > nowMs) {
          // Positive skew = local clock is behind server
          clockSkewSeconds = Math.round((iatMs - nowMs) / 1000) + 5; // 5s safety buffer
        }
      }
    }
  }
} catch (e) {
  // Non-critical — proceed with zero skew
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Store tokens in sessionStorage — cleared when the tab closes, reducing XSS theft window
    storage: window.sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Pass clock skew to Supabase only — does NOT mutate global Date.now
    ...(clockSkewSeconds > 0 ? { clockSkewInSeconds: clockSkewSeconds } : {}),
  },
});

/**
 * Triggers the cloud-hosted Supabase Edge Function 'process-email-queue'
 * to automatically dispatch pending emails in production without requiring local node worker.
 */
export async function triggerEmailWorker(): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('process-email-queue');
    if (error) {
      console.warn('[Cloud Email Worker] Edge function invocation notice:', error.message);
    }
  } catch (err: any) {
    console.warn('[Cloud Email Worker] Could not invoke edge function directly:', err.message || err);
  }
}


