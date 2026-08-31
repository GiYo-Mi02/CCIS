import React, { lazy, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { CHAT_MESSAGE_FIELDS, toChatMessages } from '../lib/chatLifecycle';
import { EventRegistration, Conversation, Message } from '../types/database';
import { Registration } from '../types';
import {
  User, Mail, GraduationCap, Hash, Calendar, LogOut,
  Ticket, AlertCircle, CheckCircle2, Clock, ChevronDown, Shield, Layers,
  Download, Printer, X, Lock, MapPin, AlertTriangle, QrCode, RefreshCw, Sparkles, Check
} from 'lucide-react';
import CouncilSeal from '../components/CouncilSeal';

const QRCodeCanvas = lazy(() => import('qrcode.react').then(({ QRCodeCanvas }) => ({ default: QRCodeCanvas })));

interface AccountPageProps {
  onNavigate?: (tab: string) => void;
}

const getDummyBarcode = (idStr: string) => {
  const hash = idStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const bars = [];
  for (let i = 0; i < 28; i++) {
    const width = ((hash * (i + 1)) % 3) + 1;
    const isGap = ((hash + i) % 4) === 0;
    bars.push(
      <div 
        key={i} 
        className={`${isGap ? 'w-[1px] bg-transparent' : 'bg-stone-800'}`} 
        style={{ width: `${width}px`, height: '18px' }}
      />
    );
  }
  return (
    <div className="flex items-center justify-center gap-[2px] opacity-75 overflow-hidden py-1">
      {bars}
    </div>
  );
};

export default function AccountPage({ onNavigate }: AccountPageProps) {
  const {
    user,
    profile,
    signOut,
    updateProfile,
    setEmailPreferences,
    issueAttendancePass,
    isAdmin,
  } = useAuth();

  // Editable profile state
  const [editing, setEditing] = useState(false);
  const [studentNumber, setStudentNumber] = useState('');
  const [yearLevel, setYearLevel] = useState(1);
  const [program, setProgram] = useState('BSCS');
  const [contactNumber, setContactNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [studentIdError, setStudentIdError] = useState('');
  const [activeTicket, setActiveTicket] = useState<EventRegistration | null>(null);

  // Audience Attendance Pass states
  const [passToken, setPassToken] = useState<string>(() => {
    return profile?.attendance_qr_code || '';
  });
  const [passGeneratedAt, setPassGeneratedAt] = useState<string>(() => {
    if (profile?.attendance_qr_generated_at) {
      return new Date(profile.attendance_qr_generated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    return '';
  });
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [passDownloadLoading, setPassDownloadLoading] = useState(false);
  const [regenerateSuccess, setRegenerateSuccess] = useState(false);

  // Attendance credentials are generated only by the server.
  useEffect(() => {
    if (!user || !profile) return;
    if (profile?.attendance_qr_code) {
      setPassToken(profile.attendance_qr_code);
      if (profile.attendance_qr_generated_at) {
        setPassGeneratedAt(new Date(profile.attendance_qr_generated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }));
      }
    } else if (profile.status === 'approved') {
      issueAttendancePass(false)
        .then((pass) => {
          setPassToken(pass.attendance_qr_code);
          setPassGeneratedAt(new Date(pass.attendance_qr_generated_at).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
          }));
        })
        .catch((error) => console.warn('Attendance pass could not be issued:', error));
    }
  }, [profile, user, issueAttendancePass]);

  // Data sections
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Verification states
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Navigation states
  const [activeTab, setActiveTab] = useState<'attendance-pass' | 'registrations' | 'messages'>('attendance-pass');
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [lastMessages, setLastMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Concern Ticket States
  const [concernMessage, setConcernMessage] = useState('');
  const [sendingConcern, setSendingConcern] = useState(false);
  const [concernStatus, setConcernStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleResendVerification = async () => {
    if (!user?.email) return;
    setResending(true);
    setResendStatus(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      if (error) throw error;
      setResendStatus({ type: 'success', message: 'Verification link has been resent! Please check your UMak inbox.' });
    } catch (err: any) {
      setResendStatus({ type: 'error', message: err?.message || 'Failed to resend. Please try again later.' });
    } finally {
      setResending(false);
    }
  };

  const handleConcernSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concernMessage.trim()) return;
    setSendingConcern(true);
    setConcernStatus(null);
    try {
      const { error } = await supabase
        .from('concerns')
        .insert({
          profile_id: user.id,
          category: 'Verification',
          subject: 'Account Verification Fallback Access Concern',
          message: concernMessage.trim(),
          status: 'new'
        });

      if (error) throw error;
      setConcernStatus({ type: 'success', message: 'Your concern ticket has been submitted successfully! The Student Council will review it.' });
      setConcernMessage('');
    } catch (err: any) {
      setConcernStatus({ type: 'error', message: err.message || 'Failed to submit concern. Please try again.' });
    } finally {
      setSendingConcern(false);
    }
  };

  // Sync edit fields from profile
  useEffect(() => {
    if (profile) {
      setStudentNumber(profile.student_number || '');
      setYearLevel(profile.year_level || 1);
      setProgram(profile.program || 'BSCS');
      setContactNumber(profile.contact_number || '');
    }
  }, [profile]);

  // Fetch user's registrations
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoadingData(true);
      try {
        const { data, error } = await supabase
          .from('event_registrations')
          .select('id, event_id, profile_id, status, registered_at, attended_at, attendance_origin, events(title, event_date, location)')
          .eq('profile_id', user.id)
          .order('registered_at', { ascending: false })
          .limit(20);

        if (!cancelled) {
          if (error) {
            console.error('Error fetching registrations:', error.message);
          } else {
            const normalized = (data || []).map(row => ({
              ...row,
              events: Array.isArray(row.events) ? (row.events[0] || null) : row.events,
            }));
            setRegistrations(normalized as unknown as EventRegistration[]);
          }
        }
      } catch (err) {
        console.error('Unexpected error fetching registrations:', err);
      }
    };

    void fetchData().finally(() => {
      setLoadingData((current) => cancelled ? current : false);
    });
    return () => { cancelled = true; };
  }, [user]);

  // Fetch conversation and latest 2 messages
  useEffect(() => {
    if (!user || activeTab !== 'messages') return;
    let cancelled = false;

    const fetchConversationAndMessages = async () => {
      setMessagesLoading(true);
      try {
        const { data: con, error: conErr } = await supabase
          .from('conversations')
          .select('id, profile_id, created_at, last_message_at')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (conErr) {
          console.error('Error fetching conversation:', conErr.message);
        }

        if (con) {
          setConversation(con as Conversation);

          const { data: msgs, error: msgsErr } = await supabase
            .from('messages')
            .select(CHAT_MESSAGE_FIELDS)
            .eq('conversation_id', con.id)
            .order('created_at', { ascending: false })
            .limit(2);

          if (cancelled) return;

          if (msgsErr) {
            console.error('Error fetching latest messages:', msgsErr.message);
          } else if (msgs) {
            setLastMessages([...toChatMessages(msgs)].reverse());
          }
        }
      } catch (err) {
        console.error('Unexpected error fetching conversation/messages:', err);
      }
    };

    void fetchConversationAndMessages().finally(() => {
      setMessagesLoading((current) => cancelled ? current : false);
    });
    return () => { cancelled = true; };
  }, [user?.id, activeTab]);

  // Mark messages as read when the Messages tab is opened on AccountPage
  useEffect(() => {
    if (activeTab === 'messages' && conversation && user) {
      const latestAdminMsg = [...lastMessages].reverse().find(m => m.sender_role === 'admin');
      const hasUnreadLocal = lastMessages.some(m => m.sender_role === 'admin' && !m.read_by_student);
      if (hasUnreadLocal) {
        supabase
          .rpc('mark_conversation_messages_read_by_student', {
            p_conversation_id: conversation.id,
          })
          .then(({ error }) => {
            if (error) {
              console.error('Failed to update read status on Supabase:', error.message);
              return;
            }

            if (latestAdminMsg) {
              localStorage.setItem(`dismissed_msg_${user.id}`, latestAdminMsg.id);
            }
            setLastMessages(prev =>
              prev.map(m => m.sender_role === 'admin' ? { ...m, read_by_student: true } : m)
            );
          });
      }
    }
  }, [activeTab, conversation, lastMessages, user]);

  const handleSaveProfileSubmit = () => {
    setStudentIdError('');

    const idClean = studentNumber.trim().toUpperCase();
    if (!/^[KA]\d{8}$/.test(idClean)) {
      setStudentIdError('Student ID must start with K or A followed by exactly 8 digits (e.g., K12345678).');
      return;
    }

    const sectionTrimmed = (profile.section || '').trim().toUpperCase().replace(/\s/g, '');
    if (!sectionTrimmed) {
      alert('Section is required.');
      return;
    }

    // Program-specific section validations
    if (program === 'DAD') {
      if (!/^[A-Z]-APPDEV$/.test(sectionTrimmed)) {
        alert('For Diploma in Application Development (DAD), section must start with a single uppercase letter, a dash, and "APPDEV" (e.g., A-APPDEV).');
        return;
      }
    } else if (program === 'DNA') {
      if (!/^[A-Z]-NETAD$/.test(sectionTrimmed)) {
        alert('For Diploma in Network Administration (DNA), section must start with a single uppercase letter, a dash, and "NETAD" (e.g., A-NETAD).');
        return;
      }
    } else if (program === 'BSCS') {
      const allowed = ['ACSAD', 'BCSAD', 'CCSAD', 'DCSAD', 'DCSADA', 'ECSAD', 'FCSAD'];
      if (!allowed.includes(sectionTrimmed)) {
        alert('For BSCS, section must be exactly one of: ACSAD, BCSAD, CCSAD, DCSAD, DCSADA, ECSAD, FCSAD.');
        return;
      }
    } else if (program === 'BSIT') {
      const allowed = ['AINS', 'BINS', 'CINS', 'DINS', 'EINS', 'FINS'];
      if (!allowed.includes(sectionTrimmed)) {
        alert('For BSIT, section must be exactly one of: AINS, BINS, CINS, DINS, EINS, FINS.');
        return;
      }
    } else if (program === 'BSIS') {
      if (!/^[A-Z0-9]+$/.test(sectionTrimmed)) {
        alert('For BSIS, section must contain only uppercase letters and numbers, with no spaces (e.g., ACSIS).');
        return;
      }
    } else {
      if (!/^[A-Z0-9-]+$/.test(sectionTrimmed)) {
        alert('Section must contain only uppercase letters, numbers, and hyphens with no spaces.');
        return;
      }
    }

    setShowConfirmModal(true);
  };

  const handleConfirmLock = async () => {
    setShowConfirmModal(false);
    setSaving(true);
    const sectionTrimmed = (profile?.section || '').trim().toUpperCase().replace(/\s/g, '');
    const idClean = studentNumber.trim().toUpperCase();
    const contactClean = contactNumber.trim();

    try {
      await updateProfile({
        student_number: idClean,
        year_level: yearLevel,
        program,
        section: sectionTrimmed,
        contact_number: contactClean || null,
      });
      setEditing(false);
    } catch (err) {
      console.error(err);
      alert('Failed to update profile: ' + (err as any).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    if (onNavigate) onNavigate('home');
  };

  if (!user || !profile) return null;

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      confirmed: 'bg-amber-100 text-amber-800',
      pending: 'bg-amber-100 text-amber-800',
      cancelled: 'bg-rose-100 text-rose-800',
      attended: 'bg-emerald-100 text-emerald-800',
      new: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-amber-100 text-amber-800',
      resolved: 'bg-emerald-100 text-emerald-800',
    };
    return map[status] || 'bg-zinc-100 text-zinc-600';
  };

  // Handler to regenerate audience attendance QR pass and SAVE to Supabase database
  const handleRegeneratePass = async () => {
    if (!user) return;
    setIsRegenerating(true);
    try {
      const pass = await issueAttendancePass(true);
      setPassToken(pass.attendance_qr_code);
      setPassGeneratedAt(new Date(pass.attendance_qr_generated_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      }));

      setRegenerateSuccess(true);
      setTimeout(() => setRegenerateSuccess(false), 3500);
    } catch (err: any) {
      console.error('Failed to regenerate pass:', err);
      alert('Could not update pass in database: ' + (err.message || err));
    } finally {
      setIsRegenerating(false);
    }
  };

  // Handler to download audience pass as crisp high-resolution PNG
  const downloadAudiencePass = async () => {
    const element = document.getElementById('audience-attendance-pass-card');
    if (!element) return;
    setPassDownloadLoading(true);
    try {
      // Ensure canvas elements are converted to high-DPI images before html2canvas capture
      const { default: html2canvas } = await import('html2canvas-pro');
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#FAF7EA',
        logging: false,
        onclone: (clonedDoc, clonedElement) => {
          const qrCanvases = clonedElement.querySelectorAll('canvas');
          qrCanvases.forEach((qrCanvas) => {
            const originalCanvas = element.querySelector('canvas');
            if (originalCanvas) {
              const img = clonedDoc.createElement('img');
              img.src = originalCanvas.toDataURL('image/png');
              img.style.width = `${originalCanvas.offsetWidth || 150}px`;
              img.style.height = `${originalCanvas.offsetHeight || 150}px`;
              img.style.display = 'block';
              qrCanvas.parentNode?.replaceChild(img, qrCanvas);
            }
          });
        }
      });
      const link = document.createElement('a');
      link.download = `CCIS_Attendance_Pass_${(profile?.student_number || profile?.full_name || 'Student').replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to download pass:', err);
    } finally {
      setPassDownloadLoading(false);
    }
  };

  const handlePrintAudiencePass = () => {
    window.print();
  };

  // Compact, high-contrast QR Code Payload structure (Easy & instant to scan)
  const audienceQrPayload = passToken || ('CCIS-AUDIENCE:' + (profile?.student_number || profile?.id));

  return (
    <div className="min-h-screen bg-[#FAF7EA] py-12 px-4 sm:px-6 lg:px-8 text-left font-sans">
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

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Page Header */}
        <div className="text-center space-y-1">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#5E6E64] font-bold">
            Portal Profile
          </span>
          <h1 className="font-marcellus text-3xl sm:text-5xl text-[#1A3C2E] tracking-tight">
            My Account
          </h1>
          <div className="h-1.5 w-16 bg-[#F5B400] mx-auto mt-3 rounded-full" />
        </div>

        {/* Two-Column Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* PROFILE SIDEBAR */}
          <div className="lg:col-span-4 lg:sticky lg:top-6 space-y-5 bg-white p-6 rounded-3xl border border-[#1A3C2E]/25 shadow-sm">
            
            {/* Avatar & Info */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-20 h-20 rounded-full border-2 border-[#F5B400] overflow-hidden bg-zinc-100 flex-shrink-0 flex items-center justify-center relative shadow-sm">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-[#1A3C2E] font-black text-2xl">
                    {(profile.full_name || 'U')[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                <h2 className="font-sans font-black text-lg text-[var(--color-primary-green,#1A3C2E)] leading-tight">
                  {profile.full_name || 'Student'}
                </h2>
                <p className="font-mono text-[11px] text-[#5E6E64] break-all">{profile.email}</p>
              </div>
            </div>

            {/* Badges Row (Consolidated Verification Info) */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1 border-t border-zinc-100">
              {/* Role badge */}
              <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--color-accent-gold,#F5B400)] bg-[var(--color-primary-green,#1A3C2E)] px-2.5 py-0.5 rounded-full font-bold">
                {profile.role.replace('_', ' ')}
              </span>

              {/* Verification badge */}
              {profile.status === 'approved' ? (
                <span 
                  className="group relative cursor-help inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full"
                  title="Your student profile has been verified and approved by the admin."
                >
                  ✓ Verified Account
                </span>
              ) : profile.status === 'rejected' ? (
                <span 
                  className="group relative cursor-help inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-700 bg-rose-100 border border-rose-200 px-2.5 py-0.5 rounded-full"
                  title={`Verification declined. Reason: ${profile.rejection_reason || 'Discrepancy in details'}`}
                >
                  ❌ Rejected Profile
                </span>
              ) : (
                <span 
                  className="group relative cursor-help inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full animate-pulse"
                  title="Your profile is pending admin evaluation."
                >
                  ⏱ Unverified Fallback
                </span>
              )}

              {/* Affiliation badge */}
              {user.email?.toLowerCase().endsWith('@umak.edu.ph') ? (
                <span 
                  className="group relative cursor-help inline-flex items-center gap-0.5 text-[9px] font-bold text-[var(--color-primary-green,#1A3C2E)] bg-[var(--color-accent-gold,#F5B400)]/25 border border-[var(--color-accent-gold,#F5B400)]/30 px-2.5 py-0.5 rounded-full"
                  title="Validated under the official @umak.edu.ph domain. Eligible for college events."
                >
                  Official Heron
                </span>
              ) : (
                <span 
                  className="group relative cursor-help inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-700 bg-rose-100 border border-rose-200 px-2.5 py-0.5 rounded-full"
                  title="External account domain. Some portal registrations may be limited."
                >
                  Guest / External
                </span>
              )}
            </div>

            {/* Verification resend block */}
            {!user.email_confirmed_at && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[10px] space-y-1.5 text-amber-800">
                <p className="leading-relaxed">Email verification is pending. Please check your UMak email inbox.</p>
                <button
                  onClick={handleResendVerification}
                  disabled={resending}
                  className="font-bold underline uppercase tracking-wider text-[9px] hover:text-amber-950 transition-colors disabled:opacity-60 block text-left"
                >
                  {resending ? 'Sending...' : 'Resend Verification Email'}
                </button>
                {resendStatus && (
                  <p className={`font-mono text-[8px] leading-tight ${resendStatus.type === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {resendStatus.message}
                  </p>
                )}
              </div>
            )}

            {/* Student Details Stack (Stacked Tightly) */}
            <div className="pt-2 border-t border-zinc-100 space-y-2.5">
              {/* Student ID */}
              <div className="flex items-start justify-between text-xs py-0.5">
                <span className="text-[#5E6E64] font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5 mt-1">
                  <Hash size={12} className="text-[var(--color-accent-gold,#F5B400)]" /> Student ID
                </span>
                {editing ? (
                  <div className="flex flex-col items-end w-1/2">
                    <input
                      type="text" 
                      value={studentNumber} 
                      onChange={(e) => {
                        setStudentNumber(e.target.value);
                        if (studentIdError) setStudentIdError('');
                      }}
                      className={`w-full bg-zinc-50 border ${studentIdError ? 'border-red-500' : 'border-zinc-200'} rounded px-2 py-0.5 text-xs text-[var(--color-primary-green,#1A3C2E)] outline-none focus:border-[var(--color-accent-gold,#F5B400)] font-bold text-right`}
                    />
                    {studentIdError && (
                      <span className="text-red-500 text-[8.5px] mt-0.5 text-right font-sans block leading-tight">
                        {studentIdError}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="font-bold text-[var(--color-primary-green,#1A3C2E)]">{profile.student_number || '—'}</span>
                )}
              </div>

              {/* Year Level */}
              <div className="flex items-center justify-between text-xs py-0.5">
                <span className="text-[#5E6E64] font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap size={12} className="text-[var(--color-accent-gold,#F5B400)]" /> Year Level
                </span>
                {editing ? (
                  <select 
                    value={yearLevel} 
                    onChange={(e) => setYearLevel(Number(e.target.value))}
                    className="bg-zinc-50 border border-zinc-200 rounded px-2 py-0.5 text-xs text-[var(--color-primary-green,#1A3C2E)] outline-none font-bold text-right"
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                ) : (
                  <span className="font-bold text-[var(--color-primary-green,#1A3C2E)]">Year {profile.year_level || '—'}</span>
                )}
              </div>

              {/* Program */}
              <div className="flex items-center justify-between text-xs py-0.5">
                <span className="text-[#5E6E64] font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <User size={12} className="text-[var(--color-accent-gold,#F5B400)]" /> Program
                </span>
                {editing ? (
                  <select 
                    value={program} 
                    onChange={(e) => setProgram(e.target.value)}
                    className="bg-zinc-50 border border-zinc-200 rounded px-2 py-0.5 text-xs text-[var(--color-primary-green,#1A3C2E)] outline-none font-bold text-right"
                  >
                    <option value="BSCS">BSCS</option>
                    <option value="BSIT">BSIT</option>
                    <option value="BSIS">BSIS</option>
                    <option value="DNA">DNA</option>
                    <option value="DAD">DAD</option>
                  </select>
                ) : (
                  <span className="font-bold text-[var(--color-primary-green,#1A3C2E)]">{profile.program || '—'}</span>
                )}
              </div>

              {/* Class Section */}
              <div className="flex items-center justify-between text-xs py-0.5">
                <span className="text-[#5E6E64] font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={12} className="text-[var(--color-accent-gold,#F5B400)]" /> Class Section
                </span>
                <span className="font-bold text-[var(--color-primary-green,#1A3C2E)] flex items-center gap-1">
                  {editing && <Lock size={10} className="text-stone-400 select-none inline-block mr-1" />}
                  {profile.section || '—'}
                </span>
              </div>

              {/* Contact Number */}
              <div className="flex items-center justify-between text-xs py-0.5">
                <span className="text-[#5E6E64] font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <User size={12} className="text-[var(--color-accent-gold,#F5B400)]" /> Contact Number
                </span>
                {editing ? (
                  <input 
                    type="tel"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="bg-zinc-50 border border-zinc-200 rounded px-2 py-0.5 text-xs text-[var(--color-primary-green,#1A3C2E)] outline-none font-bold text-right w-1/2"
                    placeholder="e.g. 09123456789"
                  />
                ) : (
                  <span className="font-bold text-[var(--color-primary-green,#1A3C2E)]">{profile.contact_number || '—'}</span>
                )}
              </div>

              {/* Email Notifications Subscription */}
              <div className="flex items-center justify-between text-xs py-1.5 border-t border-zinc-100/50 mt-1">
                <span className="text-[#5E6E64] font-mono text-[10px] uppercase tracking-wider flex flex-col">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Mail size={12} className="text-[var(--color-accent-gold,#F5B400)]" /> Email Updates
                  </span>
                  <span className="text-[9px] text-[#5E6E64]/60 ml-5 lowercase tracking-normal">announcements &amp; events</span>
                </span>
                <button
                  onClick={async () => {
                    try {
                      await setEmailPreferences(!profile.subscribe_announcements_events);
                    } catch (err) {
                      console.error("Failed to update email preferences:", err);
                    }
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                    profile.subscribe_announcements_events ? 'bg-[var(--color-primary-green,#1A3C2E)]' : 'bg-gray-200'
                  }`}
                  role="switch"
                  aria-checked={profile.subscribe_announcements_events}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                      profile.subscribe_announcements_events ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Sidebar Stacked Action Buttons */}
            <div className="pt-3 border-t border-zinc-100 flex flex-col gap-2">
              {editing ? (
                <>
                  <button 
                    onClick={handleSaveProfileSubmit} 
                    disabled={saving}
                    className="w-full bg-[var(--color-accent-gold,#F5B400)] hover:bg-[#ffc522] text-[var(--color-primary-green,#1A3C2E)] py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button 
                    onClick={() => { setEditing(false); setStudentIdError(''); }}
                    className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {!profile.profile_complete ? (
                    <button 
                      onClick={() => setEditing(true)}
                      className="w-full bg-[var(--color-primary-green,#1A3C2E)] hover:bg-[#255541] text-white py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                    >
                      Edit Profile
                    </button>
                  ) : (
                    <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-[10px] text-stone-500 space-y-1 shadow-xs">
                      <p className="font-bold flex items-center gap-1 text-[var(--color-primary-green,#1A3C2E)]">
                        <AlertCircle size={12} className="text-[var(--color-accent-gold,#F5B400)]" /> Profile Locked
                      </p>
                      <p className="leading-normal">
                        Your profile is locked. Please reach out to admin support for any changes.
                      </p>
                    </div>
                  )}
                  {isAdmin && onNavigate && (
                    <button 
                      onClick={() => onNavigate('admin')}
                      className="w-full bg-[var(--color-accent-gold,#F5B400)]/15 border border-[var(--color-accent-gold,#F5B400)]/30 text-[var(--color-primary-green,#1A3C2E)] py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:bg-[var(--color-accent-gold,#F5B400)]/25 flex items-center justify-center gap-1.5"
                    >
                      <Shield size={12} />Admin Panel
                    </button>
                  )}
                  <button 
                    onClick={handleSignOut}
                    className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                  >
                    <LogOut size={12} />Sign Out
                  </button>
                </>
              )}
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="lg:col-span-8 space-y-6">

            {/* Account Verification Support / Status Card */}
            {(profile.status === 'pending' || profile.status === 'rejected') && (
              <div className="bg-white border border-[#1A3C2E]/25 p-6 rounded-3xl shadow-sm space-y-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-full shrink-0 ${profile.status === 'rejected' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                    {profile.status === 'rejected' ? <X size={20} /> : <Clock size={20} />}
                  </div>
                  <div>
                    <h3 className="font-marcellus text-base text-stone-950 uppercase tracking-wide">
                      {profile.status === 'rejected' ? 'Verification Declined' : 'Account Verification Pending'}
                    </h3>
                    <div className="text-stone-500 text-xs mt-0.5 leading-relaxed font-sans">
                      {profile.status === 'rejected' ? (
                        <>
                          Your student verification request was declined. 
                          <span className="block font-bold text-rose-700 bg-rose-50 border border-rose-100 p-2.5 rounded-lg mt-2 mb-1 font-sans">
                            Reason: {profile.rejection_reason || 'Discrepancy in details'}
                          </span>
                          Please contact support or re-submit your details.
                        </>
                      ) : (
                        "Your student verification is currently under review by the student council. Since 24 hours have elapsed without approval, fallback access has been enabled so you can browse the portal. You can submit a support ticket concern below if you need help."
                      )}
                    </div>
                    {/* ERROR 8: Resubmit for verification button for rejected profiles */}
                    {profile.status === 'rejected' && (
                      <button
                        type="button"
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-[#1A3C2E] text-white text-xs font-bold rounded-xl hover:bg-[#1A3C2E]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={resending}
                        onClick={async () => {
                          setResending(true);
                          setResendStatus(null);
                          try {
                            const { error } = await supabase.rpc('resubmit_for_verification');
                            if (error) throw error;
                            setResendStatus({ type: 'success', message: 'Profile resubmitted for verification! You will be notified once reviewed.' });
                            // Refresh profile to reflect new 'pending' status
                            window.location.reload();
                          } catch (err: any) {
                            setResendStatus({ type: 'error', message: err.message || 'Failed to resubmit. Please try again.' });
                          } finally {
                            setResending(false);
                          }
                        }}
                      >
                        <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
                        {resending ? 'Resubmitting...' : 'Resubmit for Verification'}
                      </button>
                    )}
                    {resendStatus && (
                      <p className={`text-xs mt-2 ${resendStatus.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {resendStatus.message}
                      </p>
                    )}
                  </div>
                </div>

                <form onSubmit={handleConcernSubmit} className="pt-3 border-t border-zinc-100 space-y-3 font-sans">
                  <label className="block text-[#5E6E64] font-mono text-[9px] uppercase tracking-wider font-bold">
                    Submit Verification Concern / Support Ticket
                  </label>
                  <textarea
                    value={concernMessage}
                    onChange={(e) => setConcernMessage(e.target.value)}
                    rows={3}
                    placeholder="Describe your concern here (e.g. 'I submitted my profile but my COR verification email hasn't arrived' or 'Why was my profile rejected?')"
                    className="w-full bg-zinc-50 border border-[#1A3C2E]/30 focus:border-[#1A3C2E] focus:ring-1 focus:ring-[#1A3C2E] rounded-xl px-4 py-3 text-xs text-stone-800 placeholder-stone-400 outline-none transition-all resize-none"
                    required
                  />
                  {concernStatus && (
                    <div className={`p-3 rounded-lg text-xs leading-normal font-sans ${concernStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'}`}>
                      {concernStatus.message}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={sendingConcern || !concernMessage.trim()}
                    className="bg-[#1A3C2E] hover:bg-[#255541] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {sendingConcern ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Send Concern Ticket'
                    )}
                  </button>
                </form>
              </div>
            )}
            
            {/* Pill Tabs Bar (1 Row Only) */}
            <div className="flex flex-nowrap items-center gap-2 border-b border-[#1A3C2E]/20 pb-3 max-w-full overflow-x-auto">
              <button
                onClick={() => setActiveTab('attendance-pass')}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full text-xs uppercase tracking-wider font-bold transition-all border shrink-0 cursor-pointer select-none ${
                  activeTab === 'attendance-pass'
                    ? 'bg-[#1A3C2E] text-white shadow-md border-[#1A3C2E] ring-2 ring-[#F5B400]'
                    : 'bg-white text-[#5E6E64] border-[#1A3C2E]/25 hover:bg-zinc-50'
                }`}
                id="tab-attendance-pass"
              >
                <QrCode size={14} className={activeTab === 'attendance-pass' ? 'text-[#F5B400]' : ''} />
                <span>Attendance QR Pass</span>
              </button>

              <button
                onClick={() => setActiveTab('registrations')}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full text-xs uppercase tracking-wider font-bold transition-all border shrink-0 cursor-pointer select-none ${
                  activeTab === 'registrations'
                    ? 'bg-[#1A3C2E] text-white shadow-md border-[#1A3C2E] ring-2 ring-[#F5B400]'
                    : 'bg-white text-[#5E6E64] border-[#1A3C2E]/25 hover:bg-zinc-50'
                }`}
                id="tab-registrations"
              >
                <Ticket size={14} className={activeTab === 'registrations' ? 'text-[#F5B400]' : ''} />
                <span>Participant Registrations ({registrations.length})</span>
              </button>
            </div>

            {/* Active Tab Panel Content */}
            {/* 1. ATTENDANCE QR PASS TAB */}
            {activeTab === 'attendance-pass' && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Informational Role & Validation Guide Banner */}
                <div className="p-4 sm:p-5 bg-white rounded-2xl border border-[#1A3C2E]/25 shadow-xs flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-[#FAF7EA] border border-[#1A3C2E]/20 flex items-center justify-center text-[#1A3C2E] shrink-0 mt-0.5">
                    <QrCode size={18} className="text-[#1A3C2E]" />
                  </div>
                  <div className="text-xs space-y-1.5 flex-1 font-sans">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="font-marcellus text-base text-[#1A3C2E]">
                        Universal Audience Attendance Pass
                      </h4>
                      <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        profile.status === 'approved' 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : profile.status === 'rejected'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                      }`}>
                        {profile.status === 'approved' ? '✓ Valid & Active Pass' : profile.status === 'rejected' ? '✕ Profile Rejected' : '⏱ Pending Admin Approval'}
                      </span>
                    </div>
                    <p className="text-stone-600 leading-relaxed">
                      Present this digital pass for entrance and attendance verification across all CCIS assemblies and events without pre-registering.
                    </p>
                    <div className="p-2.5 bg-stone-50 rounded-xl border border-[#1A3C2E]/15 text-[11px] text-stone-600 space-y-1">
                      <p><strong>• Activation:</strong> Your pass is permanently active once your student profile is approved by the council.</p>
                      <p><strong>• Database Check-In:</strong> Scanning this QR code at the door logs your attendance directly into the college database.</p>
                      <p><strong>• Participants vs Audiences:</strong> Event registration on the Our Events page is reserved for active event participants/competitors.</p>
                    </div>
                  </div>
                </div>

                {/* Regenerate Toast Alert */}
                {regenerateSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-fade-in font-sans">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>Attendance QR Code refreshed and verified successfully!</span>
                  </div>
                )}

                {/* VISUAL DIGITAL ATTENDANCE PASS CARD */}
                <div 
                  id="audience-attendance-pass-card"
                  className="bg-white rounded-3xl border-2 border-[#1A3C2E]/30 shadow-md overflow-hidden flex flex-col md:flex-row relative"
                >
                  {/* Left Main Boarding Card Body */}
                  <div className="p-6 md:p-8 flex-1 bg-[#1A3C2E] text-[#FAF7EA] flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10 space-y-6">
                      
                      {/* Card Header: Logos and Identity */}
                      <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <div className="flex items-center gap-3">
                          <img src="/images/UMak_Logo.png" alt="UMak" className="w-10 h-10 object-contain drop-shadow" />
                          <CouncilSeal size={40} interactive={false} src="/images/CCIS-Logo.png" className="w-10 h-10 drop-shadow" />
                          <div>
                            <span className="block font-marcellus text-xs uppercase tracking-wider text-white">
                              University of Makati
                            </span>
                            <span className="block text-[10px] font-sans text-stone-300">
                              College of Computing and Information Sciences
                            </span>
                          </div>
                        </div>

                        <span className={`text-[9px] font-bold font-mono px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs shrink-0 ${
                          profile.status === 'approved' 
                            ? 'bg-[#F5B400] text-[#1A3C2E]' 
                            : 'bg-amber-400/90 text-stone-900'
                        }`}>
                          {profile.status === 'approved' ? 'AUDIENCE PASS • VALID' : 'AUDIENCE PASS • PENDING'}
                        </span>
                      </div>

                      {/* Student Information Grid */}
                      <div className="space-y-4">
                        <div>
                          <span className="text-[9px] font-mono text-[#F5B400] uppercase tracking-wider block font-bold">
                            Student Name
                          </span>
                          <h3 className="font-sans font-black text-xl sm:text-2xl text-white tracking-tight">
                            {profile.full_name || 'Student Attendee'}
                          </h3>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1 border-t border-white/10">
                          <div>
                            <span className="text-[9px] font-mono text-stone-400 uppercase tracking-wider block">
                              Student ID
                            </span>
                            <span className="font-mono text-sm font-bold text-white">
                              {profile.student_number || 'UNASSIGNED'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[9px] font-mono text-stone-400 uppercase tracking-wider block">
                              Program &amp; Section
                            </span>
                            <span className="font-sans text-sm font-bold text-white">
                              {profile.program || 'CCIS'} {profile.section ? `(${profile.section})` : ''}
                            </span>
                          </div>

                          <div>
                            <span className="text-[9px] font-mono text-stone-400 uppercase tracking-wider block">
                              Year Level
                            </span>
                            <span className="font-sans text-sm font-bold text-white">
                              {profile.year_level ? `${profile.year_level}${profile.year_level === 1 ? 'st' : profile.year_level === 2 ? 'nd' : profile.year_level === 3 ? 'rd' : 'th'} Year` : '1st Year'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Badge Row */}
                      <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between text-[10px] text-stone-300 font-mono">
                        <span>SECURITY TOKEN: {passToken.substring(0, 12)}</span>
                        <span>ISSUED: {passGeneratedAt}</span>
                        <span className={`font-bold ${profile.status === 'approved' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          STATUS: {profile.status === 'approved' ? '✓ APPROVED & VALID' : '⏱ PENDING APPROVAL'}
                        </span>
                      </div>

                    </div>
                  </div>

                  {/* Right QR Stub */}
                  <div className="bg-[#FAF7EA] p-6 md:p-8 flex flex-col justify-between items-center text-center md:w-[260px] shrink-0 border-t md:border-t-0 md:border-l border-stone-200/80 relative">
                    <div className="space-y-3 flex flex-col items-center">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-[#5E6E64] font-bold">
                        SCAN FOR AUDIENCE ENTRY
                      </span>
                      
                      <div className="bg-white p-2.5 rounded-2xl shadow-xs border border-stone-200 flex items-center justify-center">
                        <QRCodeCanvas 
                          value={audienceQrPayload} 
                          size={150} 
                          bgColor="#ffffff" 
                          fgColor="#1A3C2E" 
                          level="M"
                          includeMargin={true}
                        />
                      </div>

                      <span className="font-mono text-[9px] bg-[#1A3C2E] text-[#F5B400] px-3 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        AY 2026-2027 ACTIVE
                      </span>
                    </div>

                    <div className="w-full mt-4 space-y-1.5 font-mono text-[9px] text-stone-400">
                      {getDummyBarcode(passToken)}
                      <p className="text-[8px] text-stone-400">CCIS-STU-PASS-{passToken.substring(0, 8)}</p>
                    </div>
                  </div>
                </div>

                {/* Control Action Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                  <button
                    onClick={handleRegeneratePass}
                    disabled={isRegenerating}
                    className="bg-white hover:bg-stone-50 text-[#1A3C2E] border border-stone-300 px-4 py-2.5 rounded-xl font-sans font-bold text-xs uppercase tracking-wider transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-60"
                    id="btn-regenerate-qr"
                  >
                    <RefreshCw size={14} className={isRegenerating ? 'animate-spin' : ''} />
                    <span>{isRegenerating ? 'Regenerating...' : 'Regenerate QR'}</span>
                  </button>

                  <button
                    onClick={downloadAudiencePass}
                    disabled={passDownloadLoading}
                    className="bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] px-5 py-2.5 rounded-xl font-sans font-bold text-xs uppercase tracking-wider transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-60"
                    id="btn-download-pass"
                  >
                    {passDownloadLoading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-[#1A3C2E] border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        <span>Save Pass (PNG)</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handlePrintAudiencePass}
                    className="bg-[#1A3C2E] hover:bg-[#255541] text-[#FAF7EA] px-4 py-2.5 rounded-xl font-sans font-bold text-xs uppercase tracking-wider transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                    id="btn-print-pass"
                  >
                    <Printer size={14} />
                    <span>Print Pass</span>
                  </button>
                </div>

              </div>
            )}

            {/* 2. PARTICIPANT REGISTRATIONS TAB */}
            {activeTab === 'registrations' && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Registration History list header */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                    <h3 className="font-sans font-black text-xs uppercase tracking-wider text-[#5E6E64]">
                      Registration History
                    </h3>
                  </div>
 
                  {loadingData ? (
                    <div className="space-y-3 py-2 animate-pulse">
                      {[1, 2].map((i) => (
                        <div key={i} className="bg-white rounded-2xl border border-zinc-150 p-4 flex items-center justify-between">
                          <div className="space-y-1.5 flex-1">
                            <div className="h-4 w-1/3 bg-stone-200 rounded" />
                            <div className="h-3 w-1/4 bg-stone-100 rounded" />
                          </div>
                          <div className="h-8 w-20 bg-stone-200 rounded-xl" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4 animate-fade-in">
                      {registrations.length === 0 ? (
                        <div className="bg-white rounded-3xl border border-zinc-100 p-12 text-center text-zinc-400 space-y-4 shadow-sm">
                          <div className="space-y-2">
                            <Ticket size={32} className="mx-auto mb-2 opacity-30 text-[var(--color-primary-green,#1A3C2E)]" />
                            <p className="font-bold text-sm text-zinc-500">No event registrations yet</p>
                            <p className="text-xs leading-relaxed max-w-sm mx-auto">
                              You haven't registered for any participant events yet — check Announcements or Registration for upcoming events.
                            </p>
                          </div>
                          <button
                            onClick={() => onNavigate && onNavigate('registration')}
                            className="bg-[var(--color-accent-gold,#F5B400)] hover:bg-[#ffc522] text-[var(--color-primary-green,#1A3C2E)] px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs"
                          >
                            Explore Events
                          </button>
                        </div>
                      ) : (
                        registrations.map(reg => (
                          <div 
                            key={reg.id} 
                            onClick={() => setActiveTicket(reg)}
                            className="bg-white rounded-2xl border border-[#1A3C2E]/25 p-5 shadow-xs hover:shadow-md hover:border-[#1A3C2E]/60 cursor-pointer select-none transition-all duration-200"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                              <h3 className="font-marcellus text-base text-[#1A3C2E]">
                                {reg.events?.title || 'Event'}
                              </h3>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-sans font-bold text-[#1A3C2E] bg-[#F5B400]/20 border border-[#F5B400]/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Ticket size={11} className="shrink-0" /> View Pass
                                </span>
                                <span className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full font-bold ${statusBadge(reg.status)}`}>
                                  {reg.status === 'confirmed' || reg.status === 'pending' ? 'Not Attended' : reg.status === 'attended' ? 'Attended' : reg.status}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-4 text-xs text-[#5E6E64]">
                              <span className="flex items-center gap-1"><Calendar size={11} />{reg.events?.event_date}</span>
                              {reg.events?.location && <span className="flex items-center gap-1"><MapPin size={11} /> {reg.events.location}</span>}
                              <span className="flex items-center gap-1"><Clock size={11} />Registered: {new Date(reg.registered_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {activeTicket && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-scale-up font-sans">
          <div className="relative w-full max-w-2xl bg-[#FAF7EA] border border-zinc-200/80 rounded-3xl overflow-hidden shadow-2xl p-5">
            <button
              onClick={() => setActiveTicket(null)}
              className="absolute top-3 right-3 z-50 p-2 rounded-full bg-zinc-200/60 hover:bg-zinc-200 text-stone-600 transition-colors cursor-pointer"
              title="Close Ticket"
            >
              <X size={16} />
            </button>
            <div className="pt-2">
              <TicketDashboard 
                registration={{
                  id: activeTicket.id,
                  name: profile.full_name || 'Student',
                  email: profile.email || '',
                  studentNumber: profile.student_number || '',
                  courseYear: profile.program || 'CCIS',
                  college: profile.program || 'CCIS',
                  section: profile.section || '',
                  eventId: activeTicket.event_id,
                  eventTitle: activeTicket.events?.title || 'CCIS Event',
                  registeredAt: new Date(activeTicket.registered_at).toISOString().split('T')[0],
                  status: activeTicket.status,
                }} 
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Sub-component rendering official custom printable ticket 
function TicketDashboard({ registration }: { registration: Registration; key?: string }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const getDummyBarcode = (id: string) => {
    return (
      <div className="flex items-center h-12 w-full gap-[2px] bg-white p-1 rounded border border-zinc-200">
        {Array.from({ length: 42 }).map((_, i) => {
          const widthClass = (i % 3 === 0 || i % 7 === 0) ? 'w-[3px]' : 'w-[1px]';
          const opacityClass = (i % 2 === 0 || i % 5 === 0) ? 'bg-[#1A3C2E]' : 'bg-transparent';
          return (
            <div key={i} className={`h-full ${widthClass} ${opacityClass}`} />
          );
        })}
      </div>
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const downloadPng = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const element = document.getElementById(`ticket-pass-${registration.id}`);
      if (!element) {
        console.error('Ticket element not found:', `ticket-pass-${registration.id}`);
        return;
      }

      // Wait a tick to ensure QR code canvas is fully rendered
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const { default: html2canvas } = await import('html2canvas-pro');
      const canvas = await html2canvas(element, {
        backgroundColor: '#FAF7EA',
        useCORS: true,
        scale: 2,
        logging: false,
        onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
          // Find all canvas elements inside the cloned ticket
          const canvasElements = clonedElement.querySelectorAll('canvas');
          canvasElements.forEach((canvasEl) => {
            try {
              const dataUrl = (document.querySelector(
                `#ticket-pass-${registration.id} canvas`
              ) as HTMLCanvasElement)?.toDataURL('image/png');
              
              if (dataUrl) {
                const img = clonedDoc.createElement('img');
                img.src = dataUrl;
                img.style.width = canvasEl.style.width || `${canvasEl.width}px`;
                img.style.height = canvasEl.style.height || `${canvasEl.height}px`;
                img.style.display = 'block';
                canvasEl.parentNode?.replaceChild(img, canvasEl);
              }
            } catch (e) {
              console.warn('Failed to convert canvas to image in clone:', e);
            }
          });

          // Remove action buttons from the captured image
          const ignoreElements = clonedElement.querySelectorAll('[data-html2canvas-ignore]');
          ignoreElements.forEach(el => el.remove());
        },
      });
      
      await new Promise<void>((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            console.error('Failed to create blob from canvas');
            alert('Failed to download ticket. Please try the Print option instead.');
            resolve();
            return;
          }

          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `ticket-${registration.eventTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${registration.id.slice(0, 8)}.png`;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          resolve();
        }, 'image/png');
      });
    } catch (err) {
      console.error('Failed to export ticket as PNG:', err);
      alert('Failed to download ticket as PNG. Please try the Print option instead.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div 
      className="bg-white border rounded-3xl shadow-md border-zinc-200/80 overflow-hidden flex flex-col md:flex-row max-w-2xl mx-auto transform transition-transform hover:scale-[1.01] font-sans"
      id={`ticket-pass-${registration.id}`}
    >
      <div className="bg-[#1A3C2E] text-white p-5 md:p-6 flex flex-col justify-between items-start md:w-3/5 border-r border-dashed border-zinc-300 relative">
        <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#FAF7EA] hidden md:block" />
        <div className="w-full space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#F5B400] font-extrabold">
              CCIS BOARDING PASS
            </span>
            <span className="font-mono text-[9.5px] uppercase text-stone-300 bg-white/5 px-2 py-0.5 rounded">
              {registration.id}
            </span>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-wider">Event Title</span>
            <h3 className="font-sans font-black text-base sm:text-lg text-[#F5B400] leading-snug">
              {registration.eventTitle}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-stone-400 block tracking-wider">Attendee</span>
              <span className="font-sans font-extrabold text-sm block leading-tight text-white truncate max-w-full" title={registration.name}>
                {registration.name}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-stone-400 block tracking-wider">Student ID & Section</span>
              <span className="font-mono text-xs block text-stone-300">
                {registration.studentNumber} {registration.section ? `(${registration.section.toUpperCase()})` : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 w-full pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-stone-400">
          <span>BRANCH: {registration.college.toUpperCase()}</span>
          {registration.section && <span>SECTION: {registration.section.toUpperCase()}</span>}
          <span>DATE: {registration.registeredAt}</span>
        </div>
      </div>

      <div className="bg-zinc-50 p-5 md:p-6 flex flex-col justify-between items-center sm:w-full md:w-2/5 text-center relative">
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#FAF7EA] hidden md:block" />
        <div className="flex flex-col items-center space-y-2.5 w-full">
          <span className="font-mono text-[9px] uppercase tracking-wider text-[#5E6E64] font-bold">
            SCAN CODE FOR ENTRY
          </span>
          <div className="bg-white p-2.5 rounded-2xl shadow-inner border border-zinc-200 flex items-center justify-center">
            <QRCodeCanvas 
              value={registration.id} 
              size={85} 
              bgColor="#ffffff" 
              fgColor="#1A3C2E" 
              level="M"
            />
          </div>
          <span className="font-mono text-[8.5px] bg-zinc-200 text-[#1A3C2E] px-2 py-0.5 rounded font-extrabold">
            ACTIVE TICKET VERIFIED
          </span>
        </div>

        <div className="w-full mt-4 space-y-2">
          {getDummyBarcode(registration.id)}
          <div className="grid grid-cols-2 gap-2" data-html2canvas-ignore="true">
            <button
              onClick={handlePrint}
              className="bg-[#1A3C2E] hover:bg-neutral-800 text-white font-mono text-[9px] uppercase font-bold tracking-wider py-2 rounded transition-all shadow cursor-pointer flex items-center justify-center gap-1"
            >
              <Printer size={10} /> PRINT
            </button>
            <button
              onClick={downloadPng}
              disabled={isDownloading}
              className="bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] font-mono text-[9px] uppercase font-bold tracking-wider py-2 rounded transition-all shadow cursor-pointer flex items-center justify-center gap-1 disabled:opacity-60"
            >
              {isDownloading ? (
                <><div className="w-3 h-3 border-2 border-[#1A3C2E] border-t-transparent rounded-full animate-spin" /> SAVING...</>
              ) : (
                <><Download size={10} /> SAVE PNG</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
