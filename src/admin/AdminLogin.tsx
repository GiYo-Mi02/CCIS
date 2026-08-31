import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CouncilSeal from '../components/CouncilSeal';

export default function AdminLogin() {
  const { signInWithGoogle, loading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in with Google. Please try again.');
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A3C2E] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#F5B400] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1A3C2E] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border-[30px] border-[#F5B400] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border-[2px] border-[#F5B400] rounded-full" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo & branding */}
        <div className="text-center mb-8">
          <div className="mx-auto w-24 h-24 rounded-full border-3 border-[#F5B400] overflow-hidden shadow-2xl mb-5 bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <CouncilSeal size={80} interactive={false} />
          </div>
          <h1 className="font-sans font-black text-2xl text-white tracking-tight uppercase">
            CCIS DevCom Admin
          </h1>
          <p className="text-[#FAF7EA]/50 text-xs font-mono uppercase tracking-widest mt-1">
            Internal Management Portal
          </p>
        </div>

        {/* Login card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-[#F5B400]/10 border border-[#F5B400]/20 px-4 py-2 rounded-full mb-4">
              <Shield size={14} className="text-[#F5B400]" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#F5B400] font-bold">Admin Access Required</span>
            </div>
            <p className="text-white/40 text-xs">
              Sign in with your Google account. Only accounts with admin privileges can access this portal.
            </p>
          </div>

          {error && (
            <div className="mb-5 bg-[#fdecea] border border-[#c0392b] text-[#c0392b] text-xs px-4 py-2.5 rounded-lg font-sans">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="w-full bg-white hover:bg-gray-50 text-gray-800 py-3.5 rounded-xl font-sans font-bold text-sm tracking-wide shadow-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-3"
            id="admin-login-google"
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
                <span className="text-zinc-900 font-bold">Continue with Google</span>
              </>
            )}
          </button>

          <div className="mt-6 pt-5 border-t border-white/5 text-center">
            <p className="text-[#FAF7EA]/30 text-[10px] font-mono uppercase tracking-wider">
              Use your institutional Google account
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
