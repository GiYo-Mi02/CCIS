import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { EventRegistration, Conversation, Message } from '../types/database';
import {
  User, Mail, GraduationCap, Hash, Calendar, LogOut,
  Ticket, AlertCircle, CheckCircle2, Clock, ChevronDown, Shield, Layers
} from 'lucide-react';

interface AccountPageProps {
  onNavigate?: (tab: string) => void;
}

export default function AccountPage({ onNavigate }: AccountPageProps) {
  const { user, profile, signOut, updateProfile, isAdmin } = useAuth();

  // Editable profile state
  const [editing, setEditing] = useState(false);
  const [studentNumber, setStudentNumber] = useState('');
  const [yearLevel, setYearLevel] = useState(1);
  const [program, setProgram] = useState('BSCS');
  const [section, setSection] = useState('');
  const [saving, setSaving] = useState(false);

  // Data sections
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Verification states
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Navigation & Message preview states
  const [activeTab, setActiveTab] = useState<'registrations' | 'messages'>('registrations');
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [lastMessages, setLastMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

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

  // Sync edit fields from profile
  useEffect(() => {
    if (profile) {
      setStudentNumber(profile.student_number || '');
      setYearLevel(profile.year_level || 1);
      setProgram(profile.program || 'BSCS');
      setSection(profile.section || '');
    }
  }, [profile]);

  // Fetch user's registrations
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoadingData(true);
      const { data, error } = await supabase
        .from('event_registrations')
        .select('*, events(title, event_date, location)')
        .eq('profile_id', user.id)
        .order('registered_at', { ascending: false })
        .limit(20);

      if (!cancelled) {
        if (error) {
          console.error('Error fetching registrations:', error.message);
        } else {
          setRegistrations((data as EventRegistration[]) || []);
        }
        setLoadingData(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [user]);

  // Fetch conversation and latest 2 messages
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchConversationAndMessages = async () => {
      setMessagesLoading(true);
      try {
        const { data: con, error: conErr } = await supabase
          .from('conversations')
          .select('*')
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
            .select('*')
            .eq('conversation_id', con.id)
            .order('created_at', { ascending: false })
            .limit(2);

          if (cancelled) return;

          if (msgsErr) {
            console.error('Error fetching latest messages:', msgsErr.message);
          } else if (msgs) {
            setLastMessages([...msgs].reverse() as Message[]);
          }
        }
      } catch (err) {
        console.error('Unexpected error fetching conversation/messages:', err);
      } finally {
        if (!cancelled) {
          setMessagesLoading(false);
        }
      }
    };

    fetchConversationAndMessages();
    return () => { cancelled = true; };
  }, [user]);

  // Mark messages as read when the Messages tab is opened on AccountPage
  useEffect(() => {
    if (activeTab === 'messages' && conversation && user) {
      // Find the latest admin message ID and mark as dismissed in localStorage
      const latestAdminMsg = [...lastMessages].reverse().find(m => m.sender_role === 'admin');
      if (latestAdminMsg) {
        localStorage.setItem(`dismissed_msg_${user.id}`, latestAdminMsg.id);
      }

      const hasUnreadLocal = lastMessages.some(m => m.sender_role === 'admin' && !m.read_by_student);
      if (hasUnreadLocal) {
        // Optimistically clear the unread state locally
        setLastMessages(prev =>
          prev.map(m => m.sender_role === 'admin' ? { ...m, read_by_student: true } : m)
        );

        // Perform the Supabase update asynchronously for ALL unread admin messages in conversation
        supabase
          .from('messages')
          .update({ read_by_student: true })
          .eq('conversation_id', conversation.id)
          .eq('sender_role', 'admin')
          .eq('read_by_student', false)
          .then(({ error }) => {
            if (error) {
              console.error('Failed to update read status on Supabase:', error.message);
            }
          });
      }
    }
  }, [activeTab, conversation, lastMessages, user]);

  const handleSaveProfile = async () => {
    setSaving(true);
    const sectionTrimmed = section.trim().toUpperCase().replace(/\s/g, '');
    if (sectionTrimmed && !/^[A-Z0-9]+$/.test(sectionTrimmed)) {
      alert('Section must contain only uppercase letters and numbers, with no spaces (e.g. ACSAD).');
      setSaving(false);
      return;
    }

    try {
      await updateProfile({
        student_number: studentNumber.trim(),
        year_level: yearLevel,
        program,
        section: sectionTrimmed || null,
      });
      setEditing(false);
    } catch (err) {
      console.error(err);
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

  return (
    <div className="min-h-screen bg-[var(--color-bg-cream,#FAF7EA)] py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#5E6E64] font-bold font-semibold">Portal</span>
          <h1 className="font-sans font-black text-3xl tracking-tight text-[var(--color-primary-green,#1A3C2E)] mt-1">
            My Account
          </h1>
          <div className="h-1.5 w-16 bg-[var(--color-accent-gold,#F5B400)] mx-auto mt-3 rounded-full" />
        </div>

        {/* Two-Column Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* PROFILE SIDEBAR */}
          <div className="lg:col-span-4 lg:sticky lg:top-6 space-y-5 bg-white p-6 rounded-3xl border border-zinc-100 shadow-md">
            
            {/* Avatar & Info */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-20 h-20 rounded-full border-2 border-[var(--color-accent-gold,#F5B400)] overflow-hidden bg-zinc-100 flex-shrink-0 flex items-center justify-center relative shadow-sm">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-[var(--color-primary-green,#1A3C2E)] font-black text-2xl">
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
              {user.email_confirmed_at ? (
                <span 
                  className="group relative cursor-help inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full"
                  title={`Confirmed on ${new Date(user.email_confirmed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                >
                  ✓ Verified
                </span>
              ) : (
                <span 
                  className="group relative cursor-help inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full animate-pulse"
                  title="Verification email pending. Check your UMak inbox."
                >
                  ⏱ Pending
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
              <div className="flex items-center justify-between text-xs py-0.5">
                <span className="text-[#5E6E64] font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <Hash size={12} className="text-[var(--color-accent-gold,#F5B400)]" /> Student ID
                </span>
                {editing ? (
                  <input
                    type="text" 
                    value={studentNumber} 
                    onChange={(e) => setStudentNumber(e.target.value)}
                    className="w-1/2 bg-zinc-50 border border-zinc-200 rounded px-2 py-0.5 text-xs text-[var(--color-primary-green,#1A3C2E)] outline-none focus:border-[var(--color-accent-gold,#F5B400)] font-bold text-right"
                  />
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
                    <option value="BSDS">BSDS</option>
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
                {editing ? (
                  <input
                    type="text" 
                    value={section} 
                    onChange={(e) => setSection(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    className="w-1/2 bg-zinc-50 border border-zinc-200 rounded px-2 py-0.5 text-xs text-[var(--color-primary-green,#1A3C2E)] outline-none focus:border-[var(--color-accent-gold,#F5B400)] font-bold text-right"
                    placeholder="e.g. ACSAD"
                  />
                ) : (
                  <span className="font-bold text-[var(--color-primary-green,#1A3C2E)]">{profile.section || '—'}</span>
                )}
              </div>
            </div>

            {/* Sidebar Stacked Action Buttons */}
            <div className="pt-3 border-t border-zinc-100 flex flex-col gap-2">
              {editing ? (
                <>
                  <button 
                    onClick={handleSaveProfile} 
                    disabled={saving}
                    className="w-full bg-[var(--color-accent-gold,#F5B400)] hover:bg-[#ffc522] text-[var(--color-primary-green,#1A3C2E)] py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button 
                    onClick={() => setEditing(false)}
                    className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setEditing(true)}
                    className="w-full bg-[var(--color-primary-green,#1A3C2E)] hover:bg-[#255541] text-white py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Edit Profile
                  </button>
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
            
            {/* Pill Tabs Bar */}
            <div className="flex gap-2 border-b border-zinc-200 pb-3">
              <button
                onClick={() => setActiveTab('registrations')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs uppercase tracking-wider font-bold transition-all border ${
                  activeTab === 'registrations'
                    ? 'bg-[var(--color-primary-green,#1A3C2E)] text-white shadow-md border-transparent'
                    : 'bg-white text-[#5E6E64] border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                <Ticket size={14} />My Registrations ({registrations.length})
              </button>
              {onNavigate && (
                <button
                  onClick={() => setActiveTab('messages')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs uppercase tracking-wider font-bold transition-all border relative ${
                    activeTab === 'messages'
                      ? 'bg-[var(--color-primary-green,#1A3C2E)] text-white shadow-md border-transparent'
                      : 'bg-white text-[#5E6E64] border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  <Mail size={14} />Direct Messages
                  {lastMessages.some(m => m.sender_role === 'admin' && !m.read_by_student) && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse border-2 border-white" />
                  )}
                </button>
              )}
            </div>

            {/* Active Tab Panel Content */}
            {activeTab === 'registrations' ? (
              <div>
                {loadingData ? (
                  <div className="text-center py-16">
                    <div className="w-8 h-8 border-3 border-[var(--color-accent-gold,#F5B400)] border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in">
                    {registrations.length === 0 ? (
                      <div className="bg-white rounded-3xl border border-zinc-100 p-12 text-center text-zinc-400 space-y-4 shadow-sm">
                        <div className="space-y-2">
                          <Ticket size={32} className="mx-auto mb-2 opacity-30 text-[var(--color-primary-green,#1A3C2E)]" />
                          <p className="font-bold text-sm text-zinc-500">No event registrations yet</p>
                          <p className="text-xs leading-relaxed max-w-sm mx-auto">
                            You haven't registered for any events yet — check Announcements or Registration for upcoming events.
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
                        <div key={reg.id} className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                            <h3 className="font-sans font-bold text-base text-[var(--color-primary-green,#1A3C2E)]">
                              {reg.events?.title || 'Event'}
                            </h3>
                            <span className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full font-bold ${statusBadge(reg.status)}`}>
                              {reg.status === 'confirmed' || reg.status === 'pending' ? 'Not Attended' : reg.status === 'attended' ? 'Attended' : reg.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-[#5E6E64]">
                            <span className="flex items-center gap-1"><Calendar size={11} />{reg.events?.event_date}</span>
                            {reg.events?.location && <span className="flex items-center gap-1">📍 {reg.events.location}</span>}
                            <span className="flex items-center gap-1"><Clock size={11} />Registered: {new Date(reg.registered_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="animate-fade-in space-y-4">
                {messagesLoading ? (
                  <div className="text-center py-16">
                    <div className="w-8 h-8 border-3 border-[var(--color-accent-gold,#F5B400)] border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : !conversation ? (
                  <div className="bg-white rounded-3xl border border-zinc-100 p-12 text-center text-zinc-400 space-y-4 shadow-sm">
                    <div className="space-y-2">
                      <Mail size={32} className="mx-auto mb-2 opacity-30 text-[var(--color-primary-green,#1A3C2E)]" />
                      <p className="font-bold text-sm text-zinc-500">Have a question or concern?</p>
                      <p className="text-xs leading-relaxed max-w-sm mx-auto">
                        Message the student council directly to get live assistance.
                      </p>
                    </div>
                    <button
                      onClick={() => onNavigate && onNavigate('messages')}
                      className="bg-[var(--color-primary-green,#1A3C2E)] hover:bg-[#255541] text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs"
                    >
                      Open Messages
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lastMessages.length === 0 ? (
                      <div className="bg-white rounded-3xl border border-zinc-150 p-12 text-center text-zinc-400 shadow-sm">
                        <p className="text-xs">No messages yet. Have a question or concern?</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl border border-zinc-100 divide-y divide-zinc-100 overflow-hidden shadow-xs">
                        {lastMessages.map((msg) => {
                          const isAdminRole = msg.sender_role === 'admin';
                          return (
                            <div key={msg.id} className="p-4 flex items-start justify-between gap-3 hover:bg-zinc-50/50 transition-colors">
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full font-bold ${
                                    isAdminRole 
                                      ? 'bg-[var(--color-primary-green,#1A3C2E)] text-[var(--color-accent-gold,#F5B400)]' 
                                      : 'bg-zinc-100 text-zinc-600'
                                  }`}>
                                    {isAdminRole ? 'Admin' : 'You'}
                                  </span>
                                  <span className="text-[10px] text-zinc-400 font-mono">
                                    {new Date(msg.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {isAdminRole && !msg.read_by_student && (
                                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Unread message" />
                                  )}
                                </div>
                                <p className="text-xs text-stone-600 truncate">{msg.content}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <button
                      onClick={() => onNavigate && onNavigate('messages')}
                      className="bg-[var(--color-primary-green,#1A3C2E)] hover:bg-[#255541] text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs"
                    >
                      Open Messages
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
