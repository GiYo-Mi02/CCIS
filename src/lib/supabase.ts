import { createClient } from '@supabase/supabase-js';

// --- CLIENT CLOCK SKEW AUTOCORRECTION WORKAROUND ---
// If the user's system clock is skewed (e.g. 1 hour behind due to timezone/DST issues),
// Supabase/GoTrue will reject session parsing with "Session as retrieved from URL was issued in the future".
// We detect this by decoding the JWT 'iat' claim from hash or localStorage, and syncing Date.now() if needed.
try {
  let token: string | null = null;

  // 1. Parse from URL hash if returning from OAuth
  const hash = window.location.hash;
  if (hash && hash.includes('access_token=')) {
    const params = new URLSearchParams(hash.substring(1));
    token = params.get('access_token');
  }

  // 2. Parse from localStorage session cache
  if (!token) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          token = parsed?.currentSession?.access_token || parsed?.access_token || null;
        }
        break;
      }
    }
  }

  // 3. Synchronize Date.now offset if token IAT is in the future
  if (token) {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payloadDecoded = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadDecoded);
      if (payload && payload.iat) {
        const iatMs = payload.iat * 1000;
        const nowMs = Date.now();
        if (iatMs > nowMs) {
          const offset = (iatMs - nowMs) + 5000; // 5s buffer to ensure it starts in the past
          const originalNow = Date.now;
          Date.now = () => originalNow() + offset;
          console.warn(`[Supabase Clock Sync] Local clock is behind. Compensating Date.now() offset: +${offset}ms`);
        }
      }
    }
  }
} catch (e) {
  console.error('[Supabase Clock Sync] Initialization error:', e);
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
