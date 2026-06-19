import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, AlertTriangle, ShieldAlert, Clock, LogOut, RefreshCw, Check } from 'lucide-react';
import { getAdminNotificationEmail, getStudentReceiptEmail } from '../utils/verificationEmails';
import { supabase } from '../lib/supabase';

interface AuthPageProps {
  onNavigate?: (tab: string) => void;
}

export default function AuthPage({ onNavigate }: AuthPageProps) {
  const { 
    user, 
    profile, 
    loading, 
    signInWithGoogle, 
    signInWithEmail, 
    signUpWithEmail, 
    updateProfile,
    signOut,
    refreshProfile,
    isPending,
    isUnverified,
    verificationCountdown,
    banNotice,
    clearBanNotice
  } = useAuth();
  
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Profile completion state
  const [studentNumber, setStudentNumber] = useState('');
  const [yearLevel, setYearLevel] = useState<number>(1);
  const [program, setProgram] = useState('BSCS');
  const [section, setSection] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [completing, setCompleting] = useState(false);

  // Data privacy & confirmation states
  const [privacyAccepted, setPrivacyAccepted] = useState(!!profile?.privacy_agreed_at);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const privacyScrollRef = React.useRef<HTMLDivElement>(null);
  const [studentIdError, setStudentIdError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [justCompletedSetup, setJustCompletedSetup] = useState(false);

  // Portal transition states
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [transitionComplete, setTransitionComplete] = useState(false);

  useEffect(() => {
    // Only redirect to home if profile is complete AND they are either approved or fallback has kicked in
    const canAccessPublicSite = profile?.profile_complete && (!isPending || isUnverified);

    if (user && canAccessPublicSite) {
      if (justCompletedSetup) {
        if (!transitionComplete) {
          const duration = 2500; // 2.5 seconds
          const intervalTime = 30; // ms
          const step = 100 / (duration / intervalTime);
          
          const timer = setInterval(() => {
            setTransitionProgress((prev) => {
              if (prev >= 100) {
                clearInterval(timer);
                setTransitionComplete(true);
                if (onNavigate) {
                  onNavigate('home');
                }
                return 100;
              }
              return prev + step;
            });
          }, intervalTime);

          return () => clearInterval(timer);
        }
      } else {
        // Direct redirect without loader
        if (onNavigate) {
          onNavigate('home');
        }
      }
    }
  }, [user, profile?.profile_complete, isPending, isUnverified, transitionComplete, onNavigate, justCompletedSetup]);

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

  const handlePrivacyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 10;
    if (isBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAcceptPrivacy = async () => {
    if (!privacyChecked) return;
    setCompleting(true);
    setError('');
    try {
      await updateProfile({
        privacy_agreed_at: new Date().toISOString()
      });
      setPrivacyAccepted(true);
    } catch (err: any) {
      setError('Failed to record consent: ' + err.message);
    } finally {
      setCompleting(false);
    }
  };

  const handleCompleteProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStudentIdError('');

    const idClean = studentNumber.trim().toUpperCase();
    if (!/^[KA]\d{8}$/.test(idClean)) {
      setStudentIdError('Student ID must start with K or A followed by exactly 8 digits (e.g., K12345678 or A12345678).');
      return;
    }

    const sectionTrimmed = section.trim().toUpperCase().replace(/\s/g, '');
    if (!sectionTrimmed) {
      setError('Class Section is required.');
      return;
    }

    // Program-specific section validations
    if (program === 'DAD') {
      if (!/^[A-Z]-APPDEV$/.test(sectionTrimmed)) {
        setError('For Diploma in Application Development (DAD), section must start with a single uppercase letter, a dash, and "APPDEV" (e.g., A-APPDEV).');
        return;
      }
    } else if (program === 'DNA') {
      if (!/^[A-Z]-NETAD$/.test(sectionTrimmed)) {
        setError('For Diploma in Network Administration (DNA), section must start with a single uppercase letter, a dash, and "NETAD" (e.g., A-NETAD).');
        return;
      }
    } else if (program === 'BSCS') {
      const allowed = ['ACSAD', 'BCSAD', 'CCSAD', 'DCSAD', 'DCSADA', 'ECSAD', 'FCSAD'];
      if (!allowed.includes(sectionTrimmed)) {
        setError('For BSCS, section must be exactly one of: ACSAD, BCSAD, CCSAD, DCSAD, DCSADA, ECSAD, FCSAD.');
        return;
      }
    } else if (program === 'BSIT') {
      const allowed = ['AINS', 'BINS', 'CINS', 'DINS', 'EINS', 'FINS'];
      if (!allowed.includes(sectionTrimmed)) {
        setError('For BSIT, section must be exactly one of: AINS, BINS, CINS, DINS, EINS, FINS.');
        return;
      }
    } else if (program === 'BSIS') {
      if (!/^[A-Z0-9]+$/.test(sectionTrimmed)) {
        setError('For BSIS, section must contain only uppercase letters and numbers, with no spaces (e.g., ACSIS).');
        return;
      }
    } else {
      if (!/^[A-Z0-9-]+$/.test(sectionTrimmed)) {
        setError('Section must contain only uppercase letters, numbers, and hyphens with no spaces.');
        return;
      }
    }

    setShowConfirmModal(true);
  };

  const handleConfirmLock = async () => {
    setShowConfirmModal(false);
    setCompleting(true);
    setError('');
    setStudentIdError('');

    const sectionTrimmed = section.trim().toUpperCase().replace(/\s/g, '');
    const idClean = studentNumber.trim().toUpperCase();
    const contactClean = contactNumber.trim();

    try {
      const submittedAtISO = new Date().toISOString();
      await updateProfile({
        student_number: idClean,
        year_level: yearLevel,
        program,
        section: sectionTrimmed,
        contact_number: contactClean || null,
        profile_complete: true,
        status: 'pending',
        submitted_at: submittedAtISO,
      });

      const updatedProfileObj = {
        full_name: profile?.full_name || 'Student',
        email: profile?.email || '',
        student_number: idClean,
        year_level: yearLevel,
        program,
        section: sectionTrimmed,
        contact_number: contactClean || 'N/A'
      };

      // Queue admin notification email
      const adminHtml = getAdminNotificationEmail(updatedProfileObj);
      const { error: adminMailErr } = await supabase
        .from('email_queue')
        .insert({
          recipient_email: 'devcommgio2006@gmail.com',
          email_type: 'verification_admin',
          subject: `[Pending Verification] New User Profile Submitted: ${profile?.full_name || 'Student'}`,
          html_body: adminHtml
        });

      if (adminMailErr) {
        console.error('Failed to queue verification admin notification email:', adminMailErr.message);
      }

      // Queue student receipt email
      const studentHtml = getStudentReceiptEmail(updatedProfileObj);
      const { error: studentMailErr } = await supabase
        .from('email_queue')
        .insert({
          recipient_email: profile?.email || '',
          email_type: 'verification_student',
          subject: '[CCIS SC] Profile Submitted — Pending Verification',
          html_body: studentHtml
        });

      if (studentMailErr) {
        console.error('Failed to queue verification student receipt email:', studentMailErr.message);
      }

      setJustCompletedSetup(true);
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

  // Show initializing profile screen if signed in but profile is null
  if (user && !profile) {
    return (
      <div className="min-h-screen bg-[var(--color-primary-green,#1A3C2E)] flex items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border-[30px] border-[#F5B400] rounded-full animate-pulse" />
        </div>

        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl text-white text-center space-y-6 animate-scale-up">
          <div className="space-y-2">
            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto text-[#F5B400]">
              <RefreshCw size={28} className="animate-spin" />
            </div>
            <h2 className="font-sans font-black text-xl text-white tracking-tight">
              Initializing Profile
            </h2>
            <p className="text-[#FAF7EA]/60 text-xs font-mono uppercase tracking-widest">
              Please wait while we set up your CCIS profile
            </p>
          </div>

          <p className="text-stone-300 text-xs leading-relaxed">
            We are configuring your account records. This usually takes just a few seconds. If this screen persists, please check your network connection or try signing out.
          </p>

          <div className="pt-2">
            <button
              onClick={() => signOut()}
              className="w-full bg-rose-950/20 hover:bg-rose-900/40 border border-rose-500/20 text-rose-300 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show profile completion form if signed in but profile not complete
  if (user && profile && !profile.profile_complete) {
    if (!privacyAccepted) {
      return (
        <div className="min-h-screen bg-[var(--color-primary-green,#1A3C2E)] flex items-center justify-center p-4 relative overflow-hidden font-sans">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border-[30px] border-[var(--color-accent-gold,#F5B400)] rounded-full" />
          </div>

          <div className="w-full max-w-lg bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl text-white animate-scale-up space-y-6">
            <div className="text-center">
              <span className="text-3xl">🛡️</span>
              <h2 className="font-sans font-black text-xl text-white tracking-tight mt-2">
                Data Privacy Notice
              </h2>
              <p className="text-[var(--color-bg-cream,#FAF7EA)]/50 text-[10px] font-mono uppercase tracking-widest mt-0.5">
                Data Privacy Act of 2012
              </p>
            </div>

            <div 
              ref={privacyScrollRef}
              onScroll={handlePrivacyScroll}
              className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-3.5 text-xs md:text-sm leading-relaxed text-stone-200 overflow-y-auto max-h-64 scrollbar-thin"
            >
              <p>
                In compliance with the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>, the CCIS Student Council is committed to protecting your personal information.
              </p>
              <p className="font-bold text-white bg-[var(--color-accent-gold,#F5B400)]/15 border-l-2 border-[var(--color-accent-gold,#F5B400)] p-3 rounded-r-lg">
                ⚠️ All information provided will be used solely for student verification purposes.
              </p>
              <p>
                To complete your registration, we will collect your Name, Student ID, Course, Section, Email, and Contact Number. This data will be checked against official university records.
              </p>
              <p>
                Your data will be kept secure and confidential, and will not be shared with third parties without your explicit consent. By accepting, you consent to this verification process.
              </p>
              <div className="text-[#F5B400] text-[10px] font-black text-center pt-2">
                ✓ Scrolled to bottom
              </div>
            </div>

            <div className="space-y-4">
              {!hasScrolledToBottom && (
                <p className="text-[10px] text-amber-400 font-bold text-center animate-pulse">
                  📜 Please scroll to the bottom of the notice to unlock the agreement.
                </p>
              )}

              <label className={`flex items-start gap-3 cursor-pointer select-none ${!hasScrolledToBottom ? 'opacity-40 pointer-events-none' : ''}`}>
                <input
                  type="checkbox"
                  checked={privacyChecked}
                  disabled={!hasScrolledToBottom}
                  onChange={(e) => setPrivacyChecked(e.target.checked)}
                  className="mt-1 accent-[var(--color-accent-gold,#F5B400)] h-4 w-4 rounded border-gray-300 text-[var(--color-accent-gold,#F5B400)] focus:ring-[var(--color-accent-gold,#F5B400)]"
                />
                <span className="text-xs text-stone-300 leading-tight">
                  I explicitly acknowledge that I have read and accepted the Data Privacy notice and consent to the collection of my information for verification purposes.
                </span>
              </label>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-sans font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Disagree &amp; Sign Out
                </button>
                <button
                  type="button"
                  onClick={handleAcceptPrivacy}
                  disabled={!privacyChecked || completing}
                  className="flex-1 bg-[var(--color-accent-gold,#F5B400)] hover:bg-[#ffc522] text-[var(--color-primary-green,#1A3C2E)] py-3 rounded-xl font-sans font-black text-xs uppercase tracking-wider shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                >
                  {completing ? 'Logging consent...' : 'Accept & Proceed'}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[var(--color-primary-green,#1A3C2E)] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border-[30px] border-[var(--color-accent-gold,#F5B400)] rounded-full" />
        </div>

        {/* Confirmation Lock Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-scale-up font-sans">
            <div className="w-full max-w-sm bg-[#1A3C2E] border border-white/10 p-6 rounded-2xl shadow-2xl text-center space-y-4">
            <Lock size={36} className="mx-auto text-[#F5B400]" />
            <h3 className="text-white font-black text-lg">Confirm Account Details</h3>
            <p className="text-stone-300 text-xs leading-relaxed">
              Please double check your details. By locking your profile, you confirm all information entered is true and accurate.
            </p>
            <p className="text-[#F5B400] text-[10px] font-bold bg-[#F5B400]/10 border-l-2 border-[#F5B400] p-2.5 rounded text-left flex items-start gap-1.5">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>Once confirmed, your profile will be permanently locked and cannot be edited without contacting admin support.</span>
            </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                >
                  Go Back
                </button>
                <button
                  onClick={handleConfirmLock}
                  className="flex-1 bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                >
                  Confirm &amp; Lock
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-md relative z-10 animate-fade-in">
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 rounded-full border-2 border-[var(--color-accent-gold,#F5B400)] overflow-hidden shadow-2xl mb-4 bg-white flex items-center justify-center">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover animate-fade-in" referrerPolicy="no-referrer" />
              ) : (
                <img src="/images/ccis_logo.jpg" alt="CCIS Student Council Logo" className="w-full h-full object-cover select-none animate-fade-in" />
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
            <form onSubmit={handleCompleteProfileSubmit} className="space-y-5">
              <div>
                <label className="block text-[var(--color-bg-cream,#FAF7EA)]/70 text-xs font-bold uppercase tracking-wider mb-2">
                  Student ID Number
                </label>
                <input
                  type="text"
                  value={studentNumber}
                  onChange={(e) => {
                    setStudentNumber(e.target.value);
                    if (studentIdError) setStudentIdError('');
                  }}
                  className={`w-full bg-white/5 border ${studentIdError ? 'border-red-500 focus:ring-red-500' : 'border-white/10 focus:border-[var(--color-accent-gold,#F5B400)]'} focus:ring-1 focus:ring-[var(--color-accent-gold,#F5B400)] rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all`}
                  placeholder="e.g. K12345678"
                  required
                />
                {studentIdError && (
                  <p className="text-red-400 text-[10px] mt-1 font-sans font-medium">
                    {studentIdError}
                  </p>
                )}
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
                  <option value="DNA" className="text-black">Diploma in Network Administration (DNA)</option>
                  <option value="DAD" className="text-black">Diploma in Application Development (DAD)</option>
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
                  placeholder={program === 'DAD' ? 'e.g. A-APPDEV' : program === 'DNA' ? 'e.g. A-NETAD' : program === 'BSIT' ? 'e.g. AINS' : 'e.g. ACSAD'}
                  required
                />
              </div>

              <div>
                <label className="block text-[var(--color-bg-cream,#FAF7EA)]/70 text-xs font-bold uppercase tracking-wider mb-2">
                  Contact Number (Optional)
                </label>
                <input
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-[var(--color-accent-gold,#F5B400)] focus:ring-1 focus:ring-[var(--color-accent-gold,#F5B400)] rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all"
                  placeholder="e.g. 09123456789"
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

  // Transition Loader Page before homepage redirect (only for approved or fallback users who can access the public site)
  const canAccessPublicSite = profile?.profile_complete && (!isPending || isUnverified);
  if (user && canAccessPublicSite && !transitionComplete) {
    return (
      <div className="min-h-screen bg-[#1A3C2E] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border-[30px] border-[#F5B400] rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border-[2px] border-[#F5B400] rounded-full" />
        </div>

        <div className="w-full max-w-sm text-center relative z-10 space-y-8 animate-fade-in">
          {/* Logo container */}
          <div className="mx-auto w-24 h-24 rounded-full border-3 border-[#F5B400] overflow-hidden shadow-2xl bg-white flex items-center justify-center transition-transform duration-500 scale-105">
            <img 
              src="/images/ccis_logo.jpg" 
              alt="CCIS Student Council Logo" 
              className="w-full h-full object-cover select-none" 
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-white font-black text-xl tracking-wide uppercase">
              Setting up portal
            </h2>
            <p className="text-[#FAF7EA]/60 text-xs font-mono uppercase tracking-widest">
              Welcoming {profile.full_name || 'Tiger'} to CCIS Central
            </p>
          </div>

          {/* Progress bar container */}
          <div className="space-y-3">
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden border border-white/5 p-0.5">
              <div 
                className="h-full bg-[#F5B400] rounded-full transition-all duration-75 ease-out shadow-[0_0_8px_rgba(245,180,0,0.5)]"
                style={{ width: `${transitionProgress}%` }}
              />
            </div>
            <span className="block text-[#F5B400] font-mono text-xs font-bold">
              {Math.min(100, Math.floor(transitionProgress))}%
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Pending Verification Wait page (age < 24 hours)
  if (user && profile?.profile_complete && isPending && !isUnverified) {
    const formatCountdown = (secs: number) => {
      const h = Math.floor(secs / 3600).toString().padStart(2, '0');
      const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
      const s = (secs % 60).toString().padStart(2, '0');
      return `${h}:${m}:${s}`;
    };

    return (
      <div className="min-h-screen bg-[var(--color-primary-green,#1A3C2E)] flex items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border-[30px] border-[#F5B400] rounded-full animate-pulse" />
        </div>

        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl text-white text-center space-y-6 animate-scale-up">
          <div className="space-y-2">
            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto text-[#F5B400] animate-bounce">
              <Clock size={28} />
            </div>
            <h2 className="font-sans font-black text-xl text-white tracking-tight">
              Verification Pending
            </h2>
            <div className="inline-flex items-center gap-1.5 bg-[#F5B400]/20 border border-[#F5B400]/30 px-3 py-1 rounded-full text-[10px] font-bold text-[#F5B400] uppercase tracking-wider mx-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F5B400] animate-ping" />
              Under Evaluation
            </div>
          </div>

          <div className="bg-amber-500/10 border-l-2 border-[#F5B400] p-4 rounded-r-2xl text-left text-xs md:text-sm text-stone-200 leading-relaxed space-y-1">
            <p className="font-bold text-white">Advisory Notice:</p>
            <p>
              Please wait for your confirmation approval of the admin please comeback exactly 24 hours For the mean time check your email for further instruction.
            </p>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-5 text-center shadow-inner space-y-2">
            <span className="text-stone-400 text-[9px] font-mono uppercase tracking-widest block">Fallback Access Active In</span>
            <span className="text-3xl font-black text-[#F5B400] font-mono tracking-wider">
              {formatCountdown(verificationCountdown)}
            </span>
            <span className="text-[10px] text-stone-400 block leading-normal pt-1">
              If review takes longer than 24 hours, you will receive fallback access to browse portal updates.
            </span>
          </div>

          <div className="bg-white/5 border border-white/10 p-4 rounded-xl text-left text-xs space-y-1.5 text-stone-300">
            <div className="flex justify-between"><span className="text-stone-400">Student ID:</span><span className="font-mono text-white font-bold">{profile.student_number}</span></div>
            <div className="flex justify-between"><span className="text-stone-400">Program / Sec:</span><span className="text-white font-bold">{profile.program} - {profile.section}</span></div>
            <div className="flex justify-between"><span className="text-stone-400">Submitted at:</span><span className="text-white font-bold">{new Date(profile.submitted_at || profile.created_at).toLocaleDateString()}</span></div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={async () => {
                try {
                  const btn = document.getElementById('refresh-btn');
                  if (btn) btn.classList.add('animate-spin');
                  await refreshProfile();
                } catch {} finally {
                  const btn = document.getElementById('refresh-btn');
                  if (btn) btn.classList.remove('animate-spin');
                }
              }}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} id="refresh-btn" />
              Check Status
            </button>
            <button
              onClick={() => signOut()}
              className="flex-1 bg-rose-950/20 hover:bg-rose-900/40 border border-rose-500/20 text-rose-300 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default: Sign-in screen (Google OAuth only)
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
          <div className="mx-auto w-24 h-24 rounded-full border-3 border-[var(--color-accent-gold,#F5B400)] overflow-hidden shadow-2xl mb-5 bg-white flex items-center justify-center">
            <img 
              src="/images/ccis_logo.jpg" 
              alt="CCIS Student Council Logo" 
              className="w-full h-full object-cover select-none" 
            />
          </div>
          <h1 className="font-sans font-black text-2xl text-white tracking-tight uppercase">
            CCIS Student Portal
          </h1>
          <p className="text-[var(--color-bg-cream,#FAF7EA)]/50 text-xs font-mono uppercase tracking-widest mt-1">
            Sign in to access all features
          </p>
        </div>

        {/* Login card */}
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

        {/* BAN NOTICE POP-UP MODAL */}
        {banNotice && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-scale-up font-sans">
            <div className="absolute inset-0" onClick={clearBanNotice} />
            <div className="relative w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl border border-zinc-150 p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100 shadow-xs">
                <ShieldAlert size={24} />
              </div>
              <div className="space-y-1.5 text-left">
                <h3 className="font-sans font-black text-lg text-rose-900 text-center">Account Restricted</h3>
                <p className="text-stone-600 text-xs leading-relaxed text-center">
                  Your CCIS Student Portal account access has been suspended or restricted by the administrator.
                </p>
                {banNotice.bannedUntil ? (
                  <p className="text-amber-800 text-[10px] font-bold bg-amber-50 border border-amber-200 p-2.5 rounded text-left">
                    Suspension Expiration:<br />
                    <span className="font-mono text-xs font-black block mt-1">{new Date(banNotice.bannedUntil).toLocaleString()}</span>
                  </p>
                ) : (
                  <p className="text-rose-800 text-[10px] font-bold bg-rose-50 border border-rose-200 p-2.5 rounded text-left">
                    Permanent Restriction:<br />
                    <span className="font-sans block mt-1">If you believe this is an error, please contact the CCIS Student Council.</span>
                  </p>
                )}
              </div>
              <button
                onClick={clearBanNotice}
                className="w-full bg-[#1A3C2E] hover:bg-[#1A3C2E]/90 text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-xs"
              >
                Close Notice
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
