import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import CouncilSeal from '../components/CouncilSeal';

interface AuthPageProps {
  onNavigate?: (tab: string) => void;
}

type AuthMethod = 'google' | 'email';
type EmailMode = 'signin' | 'signup';

export default function AuthPage({ onNavigate }: AuthPageProps) {
  const { 
    user, 
    profile, 
    loading, 
    signInWithGoogle, 
    signInWithEmail, 
    signUpWithEmail, 
    updateProfile 
  } = useAuth();
  
  const [authMethod, setAuthMethod] = useState<AuthMethod>('google');
  const [emailMode, setEmailMode] = useState<EmailMode>('signin');
  const [signingIn, setSigningIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Email form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Profile completion state
  const [studentNumber, setStudentNumber] = useState('');
  const [yearLevel, setYearLevel] = useState<number>(1);
  const [program, setProgram] = useState('BSCS');
  const [section, setSection] = useState('');
  const [completing, setCompleting] = useState(false);

  // If user is logged in and profile is complete, redirect to account
  if (user && profile?.profile_complete && onNavigate) {
    setTimeout(() => onNavigate('account'), 0);
    return null;
  }

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setError('');
    setInfoMessage('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes('provider is not enabled') || err?.message?.includes('Unsupported provider')) {
        setError("Google Auth is not enabled on this Supabase project. Please use the 'Email Credentials' tab to log in or register.");
      } else {
        setError(err?.message || 'Failed to sign in with Google. Please try again.');
      }
      setSigningIn(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    
    if (!email.trim() || !password) {
      setError('Please fill in all credentials.');
      return;
    }

    setSubmitting(true);

    try {
      if (emailMode === 'signin') {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@umak\.edu\.ph$/i;
        if (email.trim().toLowerCase() !== 'ggiojoshua2006@gmail.com' && !emailRegex.test(email.trim())) {
          setError('Invalid login email. Only @umak.edu.ph accounts are acceptable.');
          setSubmitting(false);
          return;
        }
        await signInWithEmail(email.trim(), password);
      } else {
        // Full Name Validation
        if (!fullName.trim()) {
          setError('Please provide your full name.');
          setSubmitting(false);
          return;
        }
        if (fullName.trim().length > 255) {
          setError('Full name must not exceed 255 characters.');
          setSubmitting(false);
          return;
        }

        // Email Validation
        const emailRegex = /^[a-zA-Z0-9._%+-]+@umak\.edu\.ph$/i;
        if (email.trim().toLowerCase() !== 'ggiojoshua2006@gmail.com' && !emailRegex.test(email.trim())) {
          setError('Invalid email. Only @umak.edu.ph accounts are acceptable.');
          setSubmitting(false);
          return;
        }
        if (email.trim().length > 255) {
          setError('Email must not exceed 255 characters.');
          setSubmitting(false);
          return;
        }

        // Password Validation
        if (password.length < 8) {
          setError('Password must be at least 8 characters long.');
          setSubmitting(false);
          return;
        }
        if (password.length > 255) {
          setError('Password must not exceed 255 characters.');
          setSubmitting(false);
          return;
        }
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        if (!hasUpper || !hasLower) {
          setError('Password must contain at least one uppercase letter and one lowercase letter.');
          setSubmitting(false);
          return;
        }

        await signUpWithEmail(email.trim(), password, fullName.trim());
        setInfoMessage('Account created successfully! Check your inbox for a verification email if required, otherwise switch to Sign In and log in.');
        setEmailMode('signin');
        setPassword('');
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check your inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentNumber.trim()) return;

    setCompleting(true);
    setError('');
    setInfoMessage('');

    const sectionTrimmed = section.trim().toUpperCase().replace(/\s/g, '');
    if (sectionTrimmed && !/^[A-Z0-9]+$/.test(sectionTrimmed)) {
      setError('Section must contain only uppercase letters and numbers, with no spaces (e.g., ACSAD).');
      setCompleting(false);
      return;
    }

    try {
      await updateProfile({
        student_number: studentNumber.trim(),
        year_level: yearLevel,
        program,
        section: sectionTrimmed || null,
        profile_complete: true,
      });
      if (onNavigate) onNavigate('account');
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-cream,#FAF7EA)] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[var(--color-accent-gold,#F5B400)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show profile completion form if signed in but profile not complete
  if (user && profile && !profile.profile_complete) {
    return (
      <div className="min-h-screen bg-[var(--color-primary-green,#1A3C2E)] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border-[30px] border-[var(--color-accent-gold,#F5B400)] rounded-full" />
        </div>

        <div className="w-full max-w-md relative z-10 animate-fade-in">
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 rounded-full border-2 border-[var(--color-accent-gold,#F5B400)] overflow-hidden shadow-2xl mb-4 bg-white/10 backdrop-blur-sm flex items-center justify-center">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <CouncilSeal size={60} interactive={false} />
              )}
            </div>
            <h1 className="font-sans font-black text-xl text-white tracking-tight">
              Welcome, {profile.full_name || 'Tiger'}!
            </h1>
            <p className="text-[var(--color-bg-cream,#FAF7EA)]/50 text-xs font-mono uppercase tracking-widest mt-1">
              Complete your CCIS profile to continue
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl">
            <form onSubmit={handleCompleteProfile} className="space-y-5">
              <div>
                <label className="block text-[var(--color-bg-cream,#FAF7EA)]/70 text-xs font-bold uppercase tracking-wider mb-2">
                  Student ID Number
                </label>
                <input
                  type="text"
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-[var(--color-accent-gold,#F5B400)] focus:ring-1 focus:ring-[var(--color-accent-gold,#F5B400)] rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all"
                  placeholder="e.g. 2024-10512"
                  required
                />
              </div>

              <div>
                <label className="block text-[var(--color-bg-cream,#FAF7EA)]/70 text-xs font-bold uppercase tracking-wider mb-2">
                  Year Level
                </label>
                <select
                  value={yearLevel}
                  onChange={(e) => setYearLevel(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 focus:border-[var(--color-accent-gold,#F5B400)] rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
                >
                  <option value={1} className="text-black">1st Year</option>
                  <option value={2} className="text-black">2nd Year</option>
                  <option value={3} className="text-black">3rd Year</option>
                  <option value={4} className="text-black">4th Year</option>
                </select>
              </div>

              <div>
                <label className="block text-[var(--color-bg-cream,#FAF7EA)]/70 text-xs font-bold uppercase tracking-wider mb-2">
                  Program
                </label>
                <select
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-[var(--color-accent-gold,#F5B400)] rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
                >
                  <option value="BSCS" className="text-black">B.S. in Computer Science (BSCS)</option>
                  <option value="BSIT" className="text-black">B.S. in Information Technology (BSIT)</option>
                  <option value="BSIS" className="text-black">B.S. in Information Systems (BSIS)</option>
                  <option value="BSDS" className="text-black">B.S. in Data Science & Informatics</option>
                </select>
              </div>

              <div>
                <label className="block text-[var(--color-bg-cream,#FAF7EA)]/70 text-xs font-bold uppercase tracking-wider mb-2">
                  Class Section
                </label>
                <input
                  type="text"
                  value={section}
                  onChange={(e) => setSection(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  className="w-full bg-white/5 border border-white/10 focus:border-[var(--color-accent-gold,#F5B400)] focus:ring-1 focus:ring-[var(--color-accent-gold,#F5B400)] rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all"
                  placeholder="e.g. ACSAD"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-500/15 border border-red-500/30 text-red-300 text-xs px-4 py-2.5 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={completing}
                className="w-full bg-[var(--color-accent-gold,#F5B400)] hover:bg-[#ffc522] text-[var(--color-primary-green,#1A3C2E)] py-3 rounded-xl font-sans font-black text-sm uppercase tracking-wider shadow-lg transition-all disabled:opacity-60"
              >
                {completing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-[var(--color-primary-green,#1A3C2E)]/30 border-t-[var(--color-primary-green,#1A3C2E)] rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : (
                  'Complete Profile & Continue'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Default: Sign-in screen
  return (
    <div className="min-h-screen bg-[var(--color-primary-green,#1A3C2E)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border-[30px] border-[var(--color-accent-gold,#F5B400)] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border-[2px] border-[var(--color-accent-gold,#F5B400)] rounded-full" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo & branding */}
        <div className="text-center mb-6">
          <div className="mx-auto w-24 h-24 rounded-full border-3 border-[var(--color-accent-gold,#F5B400)] overflow-hidden shadow-2xl mb-5 bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <CouncilSeal size={80} interactive={false} />
          </div>
          <h1 className="font-sans font-black text-2xl text-white tracking-tight uppercase">
            CCIS Student Portal
          </h1>
          <p className="text-[var(--color-bg-cream,#FAF7EA)]/50 text-xs font-mono uppercase tracking-widest mt-1">
            Sign in to access all features
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl mb-4 font-sans">
          <button
            onClick={() => { setAuthMethod('google'); setError(''); }}
            className={`flex-1 text-center py-2.5 rounded-lg text-xs font-bold transition-all ${
              authMethod === 'google'
                ? 'bg-white text-[var(--color-primary-green,#1A3C2E)] shadow-sm'
                : 'text-white/70 hover:text-white'
            }`}
          >
            Google OAuth
          </button>
          <button
            onClick={() => { setAuthMethod('email'); setError(''); }}
            className={`flex-1 text-center py-2.5 rounded-lg text-xs font-bold transition-all ${
              authMethod === 'email'
                ? 'bg-white text-[var(--color-primary-green,#1A3C2E)] shadow-sm'
                : 'text-white/70 hover:text-white'
            }`}
          >
            Email Credentials
          </button>
        </div>

        {/* Login/Signup card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl">
          {error && (
            <div className="mb-5 bg-red-500/15 border border-red-500/30 text-red-300 text-xs px-4 py-2.5 rounded-lg whitespace-pre-wrap leading-relaxed">
              {error}
            </div>
          )}

          {infoMessage && (
            <div className="mb-5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-2.5 rounded-lg">
              {infoMessage}
            </div>
          )}

          {/* GOOGLE METHOD */}
          {authMethod === 'google' && (
            <div className="space-y-4">
              <button
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                className="w-full bg-white hover:bg-gray-50 text-gray-800 py-3.5 rounded-xl font-sans font-bold text-sm tracking-wide shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-3 cursor-pointer"
              >
                {signingIn ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
                    Redirecting...
                  </span>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>
              
              <div className="mt-6 pt-5 border-t border-white/5 text-center">
                <p className="text-[var(--color-bg-cream,#FAF7EA)]/30 text-[10px] font-mono uppercase tracking-wider">
                  Use your institutional Google account
                </p>
              </div>
            </div>
          )}

          {/* EMAIL METHOD */}
          {authMethod === 'email' && (
            <form onSubmit={handleEmailAuthSubmit} className="space-y-4 font-sans text-left">
              {emailMode === 'signup' && (
                <div>
                  <label className="block text-[var(--color-bg-cream,#FAF7EA)]/70 text-xs font-bold uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-[var(--color-accent-gold,#F5B400)] focus:ring-1 focus:ring-[var(--color-accent-gold,#F5B400)] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-all"
                    placeholder="e.g. Juan dela Cruz"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-[var(--color-bg-cream,#FAF7EA)]/70 text-xs font-bold uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-[var(--color-accent-gold,#F5B400)] focus:ring-1 focus:ring-[var(--color-accent-gold,#F5B400)] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-all"
                  placeholder="e.g. student@ccis-council.org"
                  required
                />
              </div>

              <div>
                <label className="block text-[var(--color-bg-cream,#FAF7EA)]/70 text-xs font-bold uppercase tracking-wider mb-1.5">
                  Secret Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-[var(--color-accent-gold,#F5B400)] focus:ring-1 focus:ring-[var(--color-accent-gold,#F5B400)] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[var(--color-accent-gold,#F5B400)] hover:bg-[#ffc522] text-[var(--color-primary-green,#1A3C2E)] py-3 rounded-xl font-sans font-black text-sm uppercase tracking-wider shadow-lg transition-all disabled:opacity-60 flex items-center justify-center"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-[var(--color-primary-green,#1A3C2E)]/30 border-t-[var(--color-primary-green,#1A3C2E)] rounded-full animate-spin" />
                    Working...
                  </span>
                ) : (
                  emailMode === 'signin' ? 'Sign In with Email' : 'Create Student Account'
                )}
              </button>

              <div className="mt-4 pt-3 border-t border-white/5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode(emailMode === 'signin' ? 'signup' : 'signin');
                    setError('');
                    setInfoMessage('');
                  }}
                  className="text-white/60 hover:text-white hover:underline text-xs"
                >
                  {emailMode === 'signin' 
                    ? "Don't have a login? Create account" 
                    : "Already have an account? Sign In"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Back to home */}
        {onNavigate && (
          <div className="mt-6 text-center">
            <button
              onClick={() => onNavigate('home')}
              className="text-white/40 hover:text-white/70 text-xs font-mono uppercase tracking-wider transition-colors"
            >
              ← Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
