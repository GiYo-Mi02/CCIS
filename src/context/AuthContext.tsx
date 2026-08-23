import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile, isAdminRole } from '../types/database';
import { GraduationCap, ShieldAlert } from 'lucide-react';

const DEFAULT_BYPASS_EMAILS = [
  'ggiojoshua2006@gmail.com',
  'devcommgio2006@gmail.com',
  'cciscsc.dev@gmail.com',
];

const ADMIN_BYPASS_EMAILS: Set<string> = new Set([
  ...DEFAULT_BYPASS_EMAILS,
  ...(import.meta.env.VITE_ADMIN_BYPASS_EMAILS || '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean),
]);

const isAllowedEmail = (email: string) =>
  email.toLowerCase().endsWith('@umak.edu.ph') || ADMIN_BYPASS_EMAILS.has(email.toLowerCase());

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

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [banNotice, setBanNotice] = useState<{ bannedUntil: string | null } | null>(null);
  const [emailValidationError, setEmailValidationError] = useState<string | null>(null);
  const [accountAgeHours, setAccountAgeHours] = useState<number>(0);
  const [verificationCountdown, setVerificationCountdown] = useState<number>(0);
  // Login rate limiting — 5 attempts then 60s cooldown
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [loginCooldownUntil, setLoginCooldownUntil] = useState<number | null>(null);
  const MAX_LOGIN_ATTEMPTS = 5;
  const COOLDOWN_MS = 60_000; // 60 seconds


  const clearBanNotice = useCallback(() => setBanNotice(null), []);
  const clearEmailValidationError = useCallback(() => setEmailValidationError(null), []);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
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
      } catch (ensureEx) {
        console.warn('[AuthContext] ensure_user_profile notice:', ensureEx);
      }

      return null;
    } catch (err) {
      console.error('[AuthContext] Unexpected fetchProfile exception:', err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const p = await fetchProfile(user.id);
    if (p) setProfile(p);
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

  // Initialize auth on mount
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (currentSession?.user) {
          const email = currentSession.user.email || '';
          if (!isAllowedEmail(email)) {
            await supabase.auth.signOut();
            if (mounted) {
              setSession(null);
              setUser(null);
              setProfile(null);
              setLoading(false);
              setEmailValidationError('Only institutional email accounts (@umak.edu.ph) are allowed to access this platform.');
            }
            return;
          }
        }

        if (currentSession?.user) {
          const p = await fetchProfile(currentSession.user.id);

          const isBanned = p?.banned && (!p.banned_until || new Date(p.banned_until) > new Date());
          if (isBanned) {
            await supabase.auth.signOut();
            if (mounted) {
              setSession(null);
              setUser(null);
              setProfile(null);
              setBanNotice({ bannedUntil: p.banned_until });
              setLoading(false);
            }
            return;
          }
          if (mounted) {
            setProfile(p);
            setSession(currentSession);
            setUser(currentSession.user);
          }
        } else {
          if (mounted) {
            setSession(null);
            setUser(null);
            setProfile(null);
          }
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        if (newSession?.user) {
          const email = newSession.user.email || '';
          if (!isAllowedEmail(email)) {
            await supabase.auth.signOut();
            if (mounted) {
              setSession(null);
              setUser(null);
              setProfile(null);
              setLoading(false);
              setEmailValidationError('Only institutional email accounts (@umak.edu.ph) are allowed to access this platform.');
            }
            return;
          }

          let p = await fetchProfile(newSession.user.id);
          if (!p && event === 'SIGNED_IN') {
            await new Promise(r => setTimeout(r, 600));
            p = await fetchProfile(newSession.user.id);
          }

          const isBanned = p?.banned && (!p.banned_until || new Date(p.banned_until) > new Date());
          if (isBanned) {
            await supabase.auth.signOut();
            if (mounted) {
              setSession(null);
              setUser(null);
              setProfile(null);
              setBanNotice({ bannedUntil: p.banned_until });
              setLoading(false);
            }
            return;
          }

          if (mounted) {
            setProfile(p);
            setSession(newSession);
            setUser(newSession.user);
            setLoading(false);

            // Cleanly strip the ?code= query from the address bar after successful authentication
            if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
              const cleanUrl = window.location.origin + window.location.pathname;
              window.history.replaceState(null, '', cleanUrl);
            }
          }
        } else {
          if (mounted) {
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
        }
      }
    );

    // Safety timeout to prevent loading state from getting stuck forever
    const safetyTimer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 4000);

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
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
    if (loginCooldownUntil && Date.now() < loginCooldownUntil) {
      const secsLeft = Math.ceil((loginCooldownUntil - Date.now()) / 1000);
      throw new Error(`Too many login attempts. Please wait ${secsLeft}s before trying again.`);
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const next = loginAttempts + 1;
      setLoginAttempts(next);
      if (next >= MAX_LOGIN_ATTEMPTS) {
        setLoginCooldownUntil(Date.now() + COOLDOWN_MS);
        setLoginAttempts(0);
      }
      throw error;
    }
    // Reset on success
    setLoginAttempts(0);
    setLoginCooldownUntil(null);
  }, [loginAttempts, loginCooldownUntil]);

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
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  useEffect(() => {
    if (profile && profile.status === 'pending') {
      const updateTime = () => {
        const submittedTime = new Date(profile.submitted_at || profile.created_at).getTime();
        const now = new Date().getTime();
        const diffMs = now - submittedTime;
        const diffHours = diffMs / (1000 * 60 * 60);
        setAccountAgeHours(diffHours);
        
        const limitMs = 24 * 60 * 60 * 1000;
        const remainingMs = Math.max(0, limitMs - diffMs);
        setVerificationCountdown(Math.floor(remainingMs / 1000));
      };

      updateTime();
      const interval = setInterval(updateTime, 1000);
      return () => clearInterval(interval);
    } else {
      setAccountAgeHours(0);
      setVerificationCountdown(0);
    }
  }, [profile]);

  const isAdmin = Boolean((profile && isAdminRole(profile.role)) || (user?.email && ADMIN_BYPASS_EMAILS.has(user.email.toLowerCase())));
  const isPending = profile ? profile.status === 'pending' : false;
  const isApproved = profile ? profile.status === 'approved' : false;
  const isRejected = profile ? profile.status === 'rejected' : false;
  const isUnverified = profile ? (profile.status === 'pending' && accountAgeHours >= 24) : false;

  return (
    <AuthContext.Provider value={{
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
    }}>
      {children}
      {emailValidationError && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
          <div className="absolute inset-0 cursor-pointer" onClick={clearEmailValidationError} />
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
              className="w-full bg-[#1A3C2E] hover:bg-[#255541] text-white py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-98 cursor-pointer"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}
