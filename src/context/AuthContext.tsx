import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, useReducer } from 'react';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile, isAdminRole } from '../types/database';
import { GraduationCap, ShieldAlert } from 'lucide-react';

const isInstitutionalEmailRequiredError = (error: unknown) =>
  typeof error === 'object'
  && error !== null
  && 'message' in error
  && typeof error.message === 'string'
  && error.message.includes('INSTITUTIONAL_EMAIL_REQUIRED');

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isPending: boolean;
  isApproved: boolean;
  isRejected: boolean;
  isUnverified: boolean;
  accountAgeHours: number;
  verificationCountdown: number;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  recordPrivacyConsent: () => Promise<void>;
  submitProfileForVerification: (details: {
    studentNumber: string;
    yearLevel: number;
    program: string;
    section: string;
    contactNumber?: string | null;
  }) => Promise<void>;
  setEmailPreferences: (subscribed: boolean) => Promise<void>;
  issueAttendancePass: (rotate?: boolean) => Promise<{
    attendance_qr_code: string;
    attendance_qr_generated_at: string;
  }>;
  banNotice: { bannedUntil: string | null } | null;
  clearBanNotice: () => void;
  emailValidationError: string | null;
  clearEmailValidationError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_FIELDS = 'id, email, full_name, avatar_url, student_number, year_level, program, section, role, position, committee_id, profile_complete, banned, banned_until, subscribe_announcements_events, email_subscription_decided, status, privacy_agreed_at, submitted_at, approved_at, approved_by, rejection_reason, contact_number, attendance_qr_code, attendance_qr_generated_at, last_ip, created_at, updated_at';
const PROFILE_CACHE_MS = 5 * 60_000;

type AuthState = { session: Session | null; user: User | null; profile: Profile | null; loading: boolean };
type AuthAction =
  | { type: 'sessionChanged'; session: Session; isNewUser: boolean }
  | { type: 'hydrated'; session: Session; profile: Profile | null }
  | { type: 'profileUpdated'; profile: Profile }
  | { type: 'clear' }
  | { type: 'failed' }
  | { type: 'loadingComplete' };

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'sessionChanged': return { ...state, session: action.session, user: action.session.user, ...(action.isNewUser ? { profile: null, loading: true } : {}) };
    case 'hydrated': return { session: action.session, user: action.session.user, profile: action.profile, loading: false };
    case 'profileUpdated': return { ...state, profile: action.profile };
    case 'clear': return { session: null, user: null, profile: null, loading: false };
    case 'failed': return { ...state, profile: null, loading: false };
    case 'loadingComplete': return { ...state, loading: false };
  }
};

type VerificationState = { accountAgeHours: number; verificationCountdown: number };
type LoginState = { attempts: number; cooldownUntil: number | null };

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, dispatchAuth] = useReducer(authReducer, { session: null, user: null, profile: null, loading: true });
  const [banNotice, setBanNotice] = useState<{ bannedUntil: string | null } | null>(null);
  const [emailValidationError, setEmailValidationError] = useState<string | null>(null);
  const [verificationState, dispatchVerification] = useReducer(
    (state: VerificationState, update: VerificationState) => update,
    { accountAgeHours: 0, verificationCountdown: 0 },
  );
  // Login rate limiting — 5 attempts then 60s cooldown
  const [loginState, dispatchLogin] = useReducer(
    (state: LoginState, update: LoginState) => update,
    { attempts: 0, cooldownUntil: null },
  );
  const MAX_LOGIN_ATTEMPTS = 5;
  const COOLDOWN_MS = 60_000; // 60 seconds
  const profileCacheRef = useRef(new Map<string, { profile: Profile; expiresAt: number }>());
  const profileRequestsRef = useRef(new Map<string, Promise<Profile | null>>());
  const { session, user, profile, loading } = authState;
  const { accountAgeHours, verificationCountdown } = verificationState;


  const clearBanNotice = useCallback(() => setBanNotice(null), []);
  const clearEmailValidationError = useCallback(() => setEmailValidationError(null), []);

  const loadProfileFromServer = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_FIELDS)
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[AuthContext] Error fetching profile:', error.message);
      }

      if (data) {
        return data as Profile;
      }

      // Check tombstone if profile row is not present
      try {
        const { data: isTombstoned } = await supabase.rpc('is_account_deletion_tombstoned');
        if (isTombstoned === true) {
          await supabase.auth.signOut();
          return null;
        }
      } catch {
        // ignore tombstone check error
      }

      // 1. Try server-side auto-provisioning RPC
      try {
        const { data: ensuredProfile, error: ensureErr } = await supabase.rpc('ensure_user_profile');
        if (!ensureErr && ensuredProfile) {
          return ensuredProfile as Profile;
        }
        if (isInstitutionalEmailRequiredError(ensureErr)) throw ensureErr;
      } catch (ensureEx) {
        if (isInstitutionalEmailRequiredError(ensureEx)) throw ensureEx;
        console.warn('[AuthContext] ensure_user_profile notice:', ensureEx);
      }

      return null;
    } catch (err) {
      console.error('[AuthContext] Unexpected fetchProfile exception:', err);
      return null;
    }
  }, []);

  const fetchProfile = useCallback(async (userId: string, force = false): Promise<Profile | null> => {
    const cached = profileCacheRef.current.get(userId);
    if (!force && cached && cached.expiresAt > Date.now()) return cached.profile;

    const existing = profileRequestsRef.current.get(userId);
    if (existing) return existing;

    const request = loadProfileFromServer(userId).then(result => {
      if (result) profileCacheRef.current.set(userId, { profile: result, expiresAt: Date.now() + PROFILE_CACHE_MS });
      return result;
    }).finally(() => {
      profileRequestsRef.current.delete(userId);
    });
    profileRequestsRef.current.set(userId, request);
    return request;
  }, [loadProfileFromServer]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const p = await fetchProfile(user.id, true);
    if (p) dispatchAuth({ type: 'profileUpdated', profile: p });
  }, [user, fetchProfile]);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return;

    // All student self-updates are routed through the update_student_profile()
    // SECURITY DEFINER RPC. This enforces a strict column allowlist at the
    // database boundary — no privileged field (role, status, banned, committee_id,
    // etc.) can be written regardless of what the client sends.
    const { error } = await supabase.rpc('update_student_profile', {
      p_full_name:                      updates.full_name                      ?? null,
      p_avatar_url:                     updates.avatar_url                     ?? null,
      p_student_number:                 updates.student_number                 ?? null,
      p_year_level:                     updates.year_level                     ?? null,
      p_program:                        updates.program                        ?? null,
      p_section:                        updates.section                        ?? null,
      p_contact_number:                 updates.contact_number                 ?? null,
      p_clear_avatar_url:               updates.avatar_url === null,
      p_clear_contact_number:           updates.contact_number === null,
    });

    if (error) {
      console.error('Error updating profile:', error.message);
      throw error;
    }
    // Re-fetch the profile from the server so local state reflects the
    // authoritative DB values (including any server-side defaults).
    await refreshProfile();
  }, [user, refreshProfile]);

  const recordPrivacyConsent = useCallback(async () => {
    if (!user) throw new Error('Authentication required');
    const { error } = await supabase.rpc('record_privacy_consent');
    if (error) throw error;
    await refreshProfile();
  }, [user, refreshProfile]);

  const submitProfileForVerification = useCallback(async (details: {
    studentNumber: string;
    yearLevel: number;
    program: string;
    section: string;
    contactNumber?: string | null;
  }) => {
    if (!user) throw new Error('Authentication required');
    const { error } = await supabase.rpc('submit_profile_for_verification', {
      p_student_number: details.studentNumber,
      p_year_level: details.yearLevel,
      p_program: details.program,
      p_section: details.section,
      p_contact_number: details.contactNumber ?? null,
    });
    if (error) throw error;
    await refreshProfile();
  }, [user, refreshProfile]);

  const setEmailPreferences = useCallback(async (subscribed: boolean) => {
    if (!user) throw new Error('Authentication required');
    const { error } = await supabase.rpc('set_email_preferences', { p_subscribe: subscribed });
    if (error) throw error;
    await refreshProfile();
  }, [user, refreshProfile]);

  const issueAttendancePass = useCallback(async (rotate = false) => {
    if (!user) throw new Error('Authentication required');
    const { data, error } = await supabase.rpc('issue_attendance_pass', { p_rotate: rotate });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.attendance_qr_code || !result?.attendance_qr_generated_at) {
      throw new Error('Attendance pass could not be issued');
    }
    await refreshProfile();
    return result as { attendance_qr_code: string; attendance_qr_generated_at: string };
  }, [user, refreshProfile]);

  // Initialize auth on mount. Supabase auth callbacks must stay synchronous:
  // awaiting another Supabase request inside onAuthStateChange can hold the
  // auth lock and leave the OAuth return screen waiting until a hard refresh.
  useEffect(() => {
    let mounted = true;
    let authRevision = 0;
    let receivedAuthEvent = false;
    let hydratedUserId: string | null = null;
    let hydrationSafetyTimer: number | null = null;
    const deferredTimers = new Set<number>();

    const isCurrentRevision = (revision: number) => mounted && revision === authRevision;

    const clearHydrationSafetyTimer = () => {
      if (hydrationSafetyTimer !== null) {
        window.clearTimeout(hydrationSafetyTimer);
        hydrationSafetyTimer = null;
      }
    };

    const clearSessionState = () => {
      clearHydrationSafetyTimer();
      hydratedUserId = null;
      dispatchAuth({ type: 'clear' });
    };

    const processAuthSession = async (
      event: AuthChangeEvent,
      newSession: Session,
      revision: number,
    ) => {
      try {
        setEmailValidationError(null);
        let nextProfile = await fetchProfile(newSession.user.id);

        // A brand-new OAuth user can arrive a fraction of a second before the
        // auth.users provisioning trigger becomes visible through PostgREST.
        if (!nextProfile && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          await new Promise(resolve => window.setTimeout(resolve, 600));
          if (!isCurrentRevision(revision)) return;
          nextProfile = await fetchProfile(newSession.user.id);
        }

        if (!isCurrentRevision(revision)) return;

        const isBanned = nextProfile?.banned
          && (!nextProfile.banned_until || new Date(nextProfile.banned_until) > new Date());
        if (isBanned) {
          setBanNotice({ bannedUntil: nextProfile.banned_until });
          clearSessionState();
          await supabase.auth.signOut();
          return;
        }

        hydratedUserId = newSession.user.id;
        clearHydrationSafetyTimer();
        dispatchAuth({ type: 'hydrated', session: newSession, profile: nextProfile });

        // Strip the one-time PKCE code only after the session and profile have
        // completed their automatic transition.
        if (window.location.search.includes('code=')) {
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState(null, '', cleanUrl);
        }
      } catch (err) {
        if (!isCurrentRevision(revision)) return;
        if (isInstitutionalEmailRequiredError(err)) {
          setEmailValidationError('Only institutional email accounts (@umak.edu.ph) are allowed to access this platform.');
          clearSessionState();
          await supabase.auth.signOut();
          return;
        }
        console.error('[AuthContext] Auth session processing failed:', err);
        // Keep the valid session snapshot so AuthPage can offer an automatic
        // profile retry instead of trapping the student behind a global loader.
        dispatchAuth({ type: 'failed' });
        clearHydrationSafetyTimer();
      }
    };

    const scheduleSessionProcessing = (event: AuthChangeEvent, newSession: Session | null) => {
      const revision = ++authRevision;

      if (!newSession?.user) {
        clearSessionState();
        return;
      }

      // Make the authenticated session visible immediately. Profile hydration
      // happens after the auth callback has returned and released its lock.
      const isNewUser = hydratedUserId !== newSession.user.id;
      dispatchAuth({ type: 'sessionChanged', session: newSession, isNewUser });

      clearHydrationSafetyTimer();
      hydrationSafetyTimer = window.setTimeout(() => {
        hydrationSafetyTimer = null;
        if (isCurrentRevision(revision)) dispatchAuth({ type: 'loadingComplete' });
      }, 8000);

      const timer = window.setTimeout(() => {
        deferredTimers.delete(timer);
        void processAuthSession(event, newSession, revision);
      }, 0);
      deferredTimers.add(timer);
    };

    // Keep this callback synchronous. All database and auth work is deferred.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;
        receivedAuthEvent = true;
        scheduleSessionProcessing(event, newSession);
      },
    );

    // INITIAL_SESSION is expected from onAuthStateChange. getSession is only a
    // bounded fallback for browsers that fail to emit that first event.
    const fallbackTimer = window.setTimeout(() => {
      if (!mounted || receivedAuthEvent) return;

      void supabase.auth.getSession()
        .then(({ data: { session: currentSession } }) => {
          if (!mounted || receivedAuthEvent) return;
          scheduleSessionProcessing('INITIAL_SESSION', currentSession);
        })
        .catch((err) => {
          if (!mounted || receivedAuthEvent) return;
          console.error('[AuthContext] Session fallback failed:', err);
          dispatchAuth({ type: 'loadingComplete' });
        });
    }, 1500);

    return () => {
      mounted = false;
      authRevision += 1;
      clearTimeout(fallbackTimer);
      clearHydrationSafetyTimer();
      deferredTimers.forEach(timer => clearTimeout(timer));
      deferredTimers.clear();
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      console.error('Google sign-in error:', error.message);
      throw error;
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    // Rate limit check
    if (loginState.cooldownUntil && Date.now() < loginState.cooldownUntil) {
      const secsLeft = Math.ceil((loginState.cooldownUntil - Date.now()) / 1000);
      throw new Error(`Too many login attempts. Please wait ${secsLeft}s before trying again.`);
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const next = loginState.attempts + 1;
      if (next >= MAX_LOGIN_ATTEMPTS) {
        dispatchLogin({ attempts: 0, cooldownUntil: Date.now() + COOLDOWN_MS });
      } else {
        dispatchLogin({ attempts: next, cooldownUntil: loginState.cooldownUntil });
      }
      throw error;
    }
    // Reset on success
    dispatchLogin({ attempts: 0, cooldownUntil: null });
  }, [loginState]);

  const signUpWithEmail = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    if (error) {
      console.error('Email sign-up error:', error.message);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error.message);
      throw error;
    }
    dispatchAuth({ type: 'clear' });
    profileCacheRef.current.clear();
    profileRequestsRef.current.clear();
  }, []);

  useEffect(() => {
    if (profile && profile.status === 'pending') {
      const updateTime = () => {
        const submittedTime = new Date(profile.submitted_at || profile.created_at).getTime();
        const now = new Date().getTime();
        const diffMs = now - submittedTime;
        const diffHours = diffMs / (1000 * 60 * 60);
        const limitMs = 24 * 60 * 60 * 1000;
        const remainingMs = Math.max(0, limitMs - diffMs);
        dispatchVerification({ accountAgeHours: diffHours, verificationCountdown: Math.floor(remainingMs / 1000) });
      };

      updateTime();
      const interval = setInterval(updateTime, 1000);
      return () => clearInterval(interval);
    } else {
      dispatchVerification({ accountAgeHours: 0, verificationCountdown: 0 });
    }
  }, [profile]);

  const isAdmin = Boolean(profile && isAdminRole(profile.role));
  const isPending = profile ? profile.status === 'pending' : false;
  const isApproved = profile ? profile.status === 'approved' : false;
  const isRejected = profile ? profile.status === 'rejected' : false;
  const isUnverified = profile ? (profile.status === 'pending' && accountAgeHours >= 24) : false;
  const value = useMemo(() => ({
    session,
    user,
    profile,
    loading,
    isAdmin,
    isPending,
    isApproved,
    isRejected,
    isUnverified,
    accountAgeHours,
    verificationCountdown,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    refreshProfile,
    updateProfile,
    recordPrivacyConsent,
    submitProfileForVerification,
    setEmailPreferences,
    issueAttendancePass,
    banNotice,
    clearBanNotice,
    emailValidationError,
    clearEmailValidationError,
  }), [
    session,
    user,
    profile,
    loading,
    isAdmin,
    isPending,
    isApproved,
    isRejected,
    isUnverified,
    accountAgeHours,
    verificationCountdown,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    refreshProfile,
    updateProfile,
    recordPrivacyConsent,
    submitProfileForVerification,
    setEmailPreferences,
    issueAttendancePass,
    banNotice,
    clearBanNotice,
    emailValidationError,
    clearEmailValidationError,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {emailValidationError && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
          <button type="button" aria-label="Close institutional email notice" className="absolute inset-0 cursor-pointer" onClick={clearEmailValidationError} />
          <div className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-zinc-150 p-7 text-center space-y-5 animate-scale-up">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-100 shadow-sm">
              <ShieldAlert size={28} className="text-[#F5B400]" />
            </div>
            <div className="space-y-2 text-left">
              <h3 className="font-sans font-black text-xl text-amber-900 text-center">
                Institutional Email Required
              </h3>
              <p className="text-stone-600 text-sm leading-relaxed text-center">
                {emailValidationError}
              </p>
              <div className="bg-amber-50/50 border border-amber-100/80 p-3.5 rounded-2xl text-[11px] text-amber-800 leading-normal flex items-start gap-2 mt-2">
                <GraduationCap size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Please sign in using your official university Google account ending with <strong>@umak.edu.ph</strong>.
                </span>
              </div>
            </div>
            <button
              onClick={clearEmailValidationError}
               className="w-full bg-[#1A3C2E] hover:bg-[#255541] text-white py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-[background-color,transform] shadow-md active:scale-98 cursor-pointer"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}
