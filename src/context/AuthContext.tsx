import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile, isAdminRole } from '../types/database';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
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

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error.message);
      return null;
    }
    return data as Profile;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const p = await fetchProfile(user.id);
    if (p) setProfile(p);
  }, [user, fetchProfile]);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating profile:', error.message);
      throw error;
    }
    await refreshProfile();
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
          if (!email.endsWith('@umak.edu.ph') && email !== 'ggiojoshua2006@gmail.com') {
            await supabase.auth.signOut();
            if (mounted) {
              setSession(null);
              setUser(null);
              setProfile(null);
              setLoading(false);
            }
            alert('Only institutional email accounts (@umak.edu.ph) are allowed to access this platform.');
            return;
          }
        }

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          const p = await fetchProfile(currentSession.user.id);
          if (mounted) setProfile(p);
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
          if (!email.endsWith('@umak.edu.ph') && email !== 'ggiojoshua2006@gmail.com') {
            await supabase.auth.signOut();
            if (mounted) {
              setSession(null);
              setUser(null);
              setProfile(null);
              setLoading(false);
            }
            alert('Only institutional email accounts (@umak.edu.ph) are allowed to access this platform.');
            return;
          }
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Small delay to let the trigger create the profile row for new users
          if (event === 'SIGNED_IN') {
            await new Promise(r => setTimeout(r, 500));
          }
          const p = await fetchProfile(newSession.user.id);
          if (mounted) setProfile(p);
        } else {
          setProfile(null);
        }

        if (mounted) setLoading(false);
      }
    );

    return () => {
      mounted = false;
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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      console.error('Email sign-in error:', error.message);
      throw error;
    }
  }, []);

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

  const isAdmin = profile ? isAdminRole(profile.role) : false;

  return (
    <AuthContext.Provider value={{
      session,
      user,
      profile,
      loading,
      isAdmin,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      refreshProfile,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
