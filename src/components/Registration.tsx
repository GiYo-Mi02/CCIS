import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Ticket, Calendar, MapPin, Clock, ArrowRight, Shield, X, Lock, CheckCircle2, Info, Trophy, QrCode, Sparkles, GraduationCap } from 'lucide-react';
import { EventItem, Registration } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Pagination from '../admin/components/Pagination';
import { RegistrationGridSkeleton } from './common/Skeleton';

const YEAR_LEVELS: Record<number, string> = {
  1: '1st Year',
  2: '2nd Year',
  3: '3rd Year',
  4: '4th Year',
};

const PROGRAM_NAMES: Record<string, string> = {
  BSCS: 'B.S. in Computer Science (BSCS)',
  BSIT: 'B.S. in Information Technology (BSIT)',
  BSIS: 'B.S. in Information Systems (BSIS)',
  DNA: 'Diploma in Network Administration (DNA)',
  DAD: 'Diploma in Application Development (DAD)',
};

interface RegistrationSectionProps {
  onNavigate?: (tab: string, eventId?: string) => void;
  preselectedEventId?: string | null;
  onClearPreselected?: () => void;
}

export default function RegistrationSection({ onNavigate, preselectedEventId, onClearPreselected }: RegistrationSectionProps) {
  const { user, profile, signInWithGoogle } = useAuth();
  
  const [events, setEvents] = useState<EventItem[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  
  // Grid filters & pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<'all' | 'general' | 'priority'>('all');

  // Registration Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [localSelectedEventId, setLocalSelectedEventId] = useState<string>('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [studentNum, setStudentNum] = useState('');
  const [section, setSection] = useState('');
  
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Prefill identity info from profile
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setEmail(profile.email || '');
      setStudentNum(profile.student_number || '');
      setSection(profile.section || '');
    }
  }, [profile]);

  const selectedEventId = preselectedEventId ?? localSelectedEventId;
  const closeModal = () => {
    setIsModalOpen(false);
    onClearPreselected?.();
  };

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setRegistrationError(null);
    try {
      if (selectedEventId) {
        localStorage.setItem('ccis_auth_redirect_tab', 'registration');
        localStorage.setItem('ccis_auth_redirect_event', selectedEventId);
      }
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Google Sign-in Error:', err);
      setRegistrationError(err?.message || 'Failed to sign in with Google. Please try again.');
      setSigningIn(false);
    }
  };

  // Fetch events and registrations from Supabase
  const fetchData = useCallback(async () => {
    setLoading(true);
    setRegistrationError(null);
    const today = new Date().toISOString().split('T')[0];

    try {
      // The view uses the same non-cancelled capacity rule as register_for_event.
      let eventsQuery = supabase
        .from('events_with_slots')
        .select('*', { count: 'exact' })
        .gte('event_date', today);

      if (filter !== 'all') {
        eventsQuery = eventsQuery.eq('category', filter);
      }

      eventsQuery = eventsQuery.order('event_date', { ascending: true });

      const offset = (currentPage - 1) * 9;
      const { data: eventsData, error: eventsError, count } = await eventsQuery
        .range(offset, offset + 8);

      if (eventsError) {
        setRegistrationError('Failed to load upcoming events.');
        console.error('Error fetching events:', eventsError.message);
        setLoading(false);
        return;
      }

      if (count !== null) {
        setTotalPages(Math.max(1, Math.ceil(count / 9)));
      }

      const mappedEvents = (eventsData || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        date: e.event_date,
        time: e.event_time || 'TBA',
        location: e.location || 'TBA',
        slots: e.registration_cap || 100,
        slotsLeft: e.slots_left === null ? null : Number(e.slots_left),
        registeredCount: Number(e.registered_count) || 0,
        description: e.description || '',
        event_type: (e.event_type as 'competition' | 'general') || (
          (e.title && (e.title.toLowerCase().includes('competition') || e.title.toLowerCase().includes('hackathon') || e.title.toLowerCase().includes('contest') || e.title.toLowerCase().includes('tournament'))) || e.registration_required ? 'competition' : 'general'
        ),
        banner_url: e.banner_url || null,
      }));

      setEvents(mappedEvents);

      // 2. Fetch user's registrations if logged in
      if (user) {
        const { data: myRegsData, error: myRegsError } = await supabase
          .from('event_registrations')
          .select('*, events(title, event_date, location), profiles(full_name, email, student_number, program, section)')
          .eq('profile_id', user.id)
          .order('registered_at', { ascending: false });

        if (myRegsError) {
          setMyRegistrations([]);
          setRegistrationError('Failed to load your registrations.');
        } else if (myRegsData) {
          const mappedRegs = myRegsData.map((r: any) => ({
            id: r.id,
            name: r.profiles?.full_name || profile?.full_name || 'Student',
            email: r.profiles?.email || profile?.email || '',
            courseYear: r.profiles?.program || profile?.program || 'CCIS',
            studentNumber: r.profiles?.student_number || profile?.student_number || '',
            college: r.profiles?.program || profile?.program || 'CCIS',
            section: r.profiles?.section || profile?.section || '',
            eventId: r.event_id,
            eventTitle: r.events?.title || 'CCIS Event',
            registeredAt: new Date(r.registered_at).toISOString().split('T')[0],
            status: r.status,
          }));
          setMyRegistrations(mappedRegs);
        }
      }
    } catch (err) {
      console.error('Unexpected error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filter, profile, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    
    if (!fullName || !studentNum) {
      setRegistrationError('Identity details are incomplete. Please complete your profile first.');
      return;
    }

    const matchedEvent = events.find(ev => ev.id === selectedEventId);
    if (!matchedEvent) return;

    setRegistrationError(null);

    const slotsLeft = getEventSlotsLeft(matchedEvent);
    if (slotsLeft !== null && slotsLeft <= 0) {
      setRegistrationError('Sorry, registration slots for this event are fully filled.');
      return;
    }

    const exists = myRegistrations.some(reg => reg.eventId === selectedEventId && reg.status !== 'cancelled');
    if (exists) {
      setRegistrationError('You are already registered for this computing event!');
      return;
    }

    setRegistering(true);

    try {
      // Register for event using database RPC (enforces atomic slots capacity gate)
      const { data: rawData, error: regError } = await supabase.rpc('register_for_event', {
        p_event_id: selectedEventId,
        p_profile_id: user.id,
      });

      if (regError) {
        if (regError.message.includes('EVENT_FULL')) {
          setRegistrationError('Sorry, this event is already full!');
        } else if (regError.message.includes('ALREADY_REGISTERED')) {
          setRegistrationError('You are already registered for this computing event!');
        } else {
          setRegistrationError('Failed to register. Please try again.');
        }
        setRegistering(false);
        return;
      }

      // Fetch the registered event details (since RPC returns raw event_registrations row)
      const { data: regData, error: fetchError } = await supabase
        .from('event_registrations')
        .select('*, events(title, event_date, location)')
        .eq('id', rawData.id)
        .single();

      if (fetchError || !regData) {
        await fetchData();
        setRegistrationError('Failed to retrieve registration details. Please try again.');
        setRegistering(false);
        return;
      }

      // Email queue processing is handled server-side by the scheduled worker.

      const ticket: Registration = {
        id: regData.id,
        name: fullName,
        email: email,
        studentNumber: studentNum,
        courseYear: profile.program || 'Computer Science',
        college: profile.program || 'Computer Science',
        section: section,
        eventId: selectedEventId,
        eventTitle: regData.events?.title || matchedEvent.title,
        registeredAt: new Date(regData.registered_at).toISOString().split('T')[0],
        status: regData.status,
      };

      // Update locally
      setMyRegistrations(prev => [ticket, ...prev.filter(reg => reg.eventId !== selectedEventId)]);
      setEvents(prev => prev.map(ev => {
        if (ev.id === selectedEventId) {
          return {
            ...ev,
            registeredCount: ev.registeredCount + 1,
            slotsLeft: ev.slotsLeft === null ? null : (ev.slotsLeft ?? ev.slots - ev.registeredCount) - 1,
          };
        }
        return ev;
      }));

      // Close modal and show custom success notice
      closeModal();
      setShowSuccessModal(true);
    } catch (err) {
      setRegistrationError('An unexpected error occurred during registration.');
      console.error(err);
    } finally {
      setRegistering(false);
    }
  };

  const getEventSlotsLeft = (ev: EventItem) => {
    return ev.slotsLeft === null ? null : ev.slotsLeft ?? ev.slots - ev.registeredCount;
  };

  if (loading) {
    return <RegistrationGridSkeleton />;
  }

  return (
    <div className="bg-[#FAF7EA] min-h-screen text-[#1A3C2E] py-12 px-4 sm:px-6 lg:px-8 font-sans" id="registration-landing">
      <div className="max-w-7xl mx-auto">
        
        {/* Upper Banner Section */}
        <div className="text-center mb-10">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#5E6E64] font-bold font-semibold">Events</span>
          <h1 className="font-sans font-black text-3xl md:text-5xl tracking-tight text-[#1A3C2E] mt-1">
            CCIS Events &amp; Registrations
          </h1>
          <p className="text-[#5E6E64] text-xs md:text-sm mt-2 font-mono uppercase tracking-widest text-[#5E6E64]/80">
            Secure entry slots and claim official printable seat-tickets
          </p>
          <div className="h-1.5 w-16 bg-[#F5B400] mx-auto mt-3 rounded-full" />
        </div>

        <div className="space-y-6">
            
            {/* Filter chips & Pagination controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#1A3C2E]/25 shadow-xs">
              <div className="flex gap-2">
                {(['all', 'general', 'priority'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => { setFilter(type); setCurrentPage(1); }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors border cursor-pointer ${
                      filter === type
                        ? 'bg-[#1A3C2E] text-white border-[#1A3C2E]'
                        : 'bg-white text-[#5E6E64] border-[#1A3C2E]/20 hover:bg-zinc-50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>

            {/* Available Events 3-Column Grid */}
            {events.length === 0 ? (
              <div className="bg-white rounded-3xl border border-[#1A3C2E]/25 p-12 text-center text-zinc-500 shadow-sm max-w-xl mx-auto">
                <Calendar size={40} className="text-stone-300 mx-auto mb-3" />
                <p className="font-sans font-semibold text-base text-[#1A3C2E]">No upcoming events</p>
                <p className="text-xs mt-0.5">Please check back later for newly scheduled Student Council activities.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((ev) => {
                  const slotsLeft = getEventSlotsLeft(ev);
                  const isFull = slotsLeft !== null && slotsLeft <= 0;
                  const isRegistered = myRegistrations.some(reg => reg.eventId === ev.id && reg.status !== 'cancelled');
                  
                  return (
                    <div
                      key={ev.id}
                      className={`bg-white rounded-3xl border flex flex-col justify-between shadow-xs hover:shadow-md transition-[background-color,border-color,color,box-shadow] relative overflow-hidden ${
                        isFull && !isRegistered ? 'opacity-65 border-zinc-300' : 'border-[#1A3C2E]/25 hover:border-[#1A3C2E]/50'
                      }`}
                      id={`register-ev-card-${ev.id}`}
                    >
                      {ev.banner_url && (
                        <div className="h-44 w-full overflow-hidden flex-shrink-0 relative">
                          <img src={ev.banner_url} alt="" width={960} height={540} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="p-6 flex-1 flex flex-col justify-between">
                        <div>
                          {/* Upper Details */}
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#5E6E64] font-bold">
                              <Calendar size={13} className="text-[#F5B400]" />
                              {ev.date}
                            </span>
                            {ev.event_type === 'competition' ? (
                              <span className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full font-black ${
                                isRegistered
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isFull 
                                    ? 'bg-rose-100 text-rose-800'
                                    : slotsLeft !== null && slotsLeft < 15
                                      ? 'bg-amber-100 text-[#1A3C2E]'
                                      : 'bg-zinc-100 text-zinc-600'
                              }`}>
                                {isRegistered 
                                  ? '✓ Registered' 
                                  : isFull 
                                    ? 'Slots Full' 
                                    : slotsLeft === null ? 'Open registration' : `${slotsLeft} of ${ev.slots} competitor slots`}
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Open Entry
                              </span>
                            )}
                          </div>

                          {/* Event Classification Tag */}
                          <div className="mb-2">
                            {ev.event_type === 'competition' ? (
                              <span className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300/80 px-2.5 py-0.5 rounded-full">
                                <Trophy size={11} className="text-amber-600 shrink-0" /> Competition / Tournament
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300/80 px-2.5 py-0.5 rounded-full">
                                <GraduationCap size={11} className="text-emerald-700 shrink-0" /> General Assembly / Seminar
                              </span>
                            )}
                          </div>

                          {/* Title & Desc */}
                          <h3 className="font-sans font-black text-lg text-[#1A3C2E] leading-snug mb-2 truncate" title={ev.title}>
                            {ev.title}
                          </h3>
                          <p className="text-xs text-[#5E6E64] leading-relaxed mb-4 line-clamp-3">
                            {ev.description}
                          </p>
                        </div>

                        {/* Footer Metadata & CTA */}
                        <div className="space-y-3.5">
                          <div className="grid grid-cols-1 gap-1.5 border-t border-zinc-100 pt-3 text-[11px] text-[#5E6E64] font-sans">
                            <span className="flex items-center gap-1.5 break-words">
                              <Clock size={12} className="text-[#FAF7EA] stroke-[#1D4A38]" />
                              {ev.time}
                            </span>
                            <span className="flex items-center gap-1.5 break-words">
                              <MapPin size={12} className="text-[#FAF7EA] stroke-[#1D4A38]" />
                              {ev.location}
                            </span>
                          </div>

                          {/* CTA button differentiated by Event Type */}
                          {ev.event_type === 'competition' ? (
                            <div>
                              {isRegistered ? (
                                <div className="w-full text-center bg-emerald-50 text-emerald-700 font-sans text-xs font-black uppercase tracking-wider py-2.5 rounded-xl border border-emerald-200">
                                  ✓ Participant Registered
                                </div>
                              ) : isFull ? (
                                <button
                                  disabled
                                  className="w-full bg-zinc-100 text-zinc-400 font-sans text-xs font-bold uppercase tracking-wider py-2.5 rounded-xl cursor-not-allowed border border-zinc-200"
                                >
                                  Competitor Slots Full
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setLocalSelectedEventId(ev.id);
                                     setRegistrationError(null);
                                    setIsModalOpen(true);
                                  }}
                                   className="w-full bg-[#1A3C2E] hover:bg-[#255541] active:bg-[#123524] text-white hover:text-white font-sans text-xs font-bold uppercase tracking-wider py-2.5 rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <Trophy size={13} className="text-[#F5B400]" />
                                  <span>Register as Participant</span>
                                  <ArrowRight size={12} />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-[10.5px] text-[#5E6E64] font-medium leading-tight flex items-start gap-1.5">
                                <Sparkles size={13} className="text-[#F5B400] shrink-0 mt-0.5" />
                                <span>Open to all students. No separate registration required — simply present your Universal Attendance QR Pass at entry!</span>
                              </p>
                              <button
                                onClick={() => {
                                  if (onNavigate) {
                                    onNavigate('account');
                                  }
                                }}
                                 className="w-full bg-[#123524] hover:bg-[#1A3C2E] text-white hover:text-[#FFBC00] border border-[#123524] font-sans text-xs font-bold uppercase tracking-wider py-3 px-4 rounded-xl transition-[background-color,border-color,color,box-shadow] shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer group"
                              >
                                <QrCode size={15} className="text-[#FFBC00] shrink-0" />
                                <span className="font-bold tracking-wide">Get Universal Attendance QR</span>
                                <ArrowRight size={14} className="text-[#FFBC00] group-hover:translate-x-1 transition-transform shrink-0" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Pagination */}
            <div className="flex justify-end pt-2">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>

            {/* REGISTRATION MODAL WITH PORTAL OVERLAY */}
            {(isModalOpen || Boolean(preselectedEventId)) && createPortal(
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
                
                {/* Backdrop Click Closes */}
                <div className="absolute inset-0" onClick={closeModal} />
                
                {/* Secure Entry Slot Form Content Card */}
                <div className="relative w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-zinc-200 animate-scale-up max-h-[90vh] flex flex-col md:flex-row overflow-y-auto md:overflow-y-hidden">
                  
                  {/* Close button */}
                  <button
                    onClick={closeModal}
                    className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/10 text-stone-600 md:bg-white/10 md:text-white hover:bg-black/20 md:hover:bg-white/20 transition-colors"
                  >
                    <X size={18} />
                  </button>

                  {/* Left Column: Event Information */}
                  <div className="w-full md:w-1/2 p-6 md:p-10 bg-[#FAF7EA]/50 flex flex-col justify-start space-y-6 md:overflow-y-auto md:max-h-[90vh] text-[#1A3C2E]">
                    {(() => {
                      const ev = events.find(e => e.id === selectedEventId);
                      if (ev?.banner_url) {
                        return (
                          <div className="w-full h-44 rounded-2xl overflow-hidden -mt-4 mb-2 flex-shrink-0 shadow-sm border border-zinc-250">
                            <img src={ev.banner_url} alt="" width={960} height={540} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <div>
                      {/* Event Category Tag */}
                      {events.find(e => e.id === selectedEventId) && (
                        <span className="inline-block text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-[#1A3C2E]/20 text-[#1A3C2E] bg-[#1A3C2E]/5">
                          Event Invitation
                        </span>
                      )}
                      <h2 className="font-sans font-black text-2xl md:text-3xl text-[#1A3C2E] leading-tight mt-3">
                        {events.find(e => e.id === selectedEventId)?.title || 'Selected Event'}
                      </h2>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-[#5E6E64]">About the Event</h4>
                      <p className="text-stone-600 text-xs md:text-sm leading-relaxed whitespace-pre-wrap">
                        {events.find(e => e.id === selectedEventId)?.description || "No description provided for this event."}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 pt-6 border-t border-[#1A3C2E]/10">
                      {/* Date & Time */}
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-[#1A3C2E]/5 rounded-xl text-[#1A3C2E] flex-shrink-0">
                          <Calendar size={18} />
                        </div>
                        <div>
                          <span className="block text-[9px] font-mono text-stone-500 uppercase tracking-wider">Date &amp; Time</span>
                          <span className="text-xs md:text-sm font-bold font-sans">
                            {(() => {
                              const ev = events.find(e => e.id === selectedEventId);
                              return ev ? `${new Date(ev.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${ev.time}` : '—';
                            })()}
                          </span>
                        </div>
                      </div>

                      {/* Location / Venue */}
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-[#1A3C2E]/5 rounded-xl text-[#1A3C2E] flex-shrink-0">
                          <MapPin size={18} />
                        </div>
                        <div>
                          <span className="block text-[9px] font-mono text-stone-500 uppercase tracking-wider">Venue / Location</span>
                          <span className="text-xs md:text-sm font-bold font-sans">
                            {events.find(e => e.id === selectedEventId)?.location || 'TBA'}
                          </span>
                        </div>
                      </div>

                      {/* Remaining Slots */}
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-[#1A3C2E]/5 rounded-xl text-[#1A3C2E] flex-shrink-0">
                          <Ticket size={18} />
                        </div>
                        <div>
                          <span className="block text-[9px] font-mono text-stone-500 uppercase tracking-wider">Available Capacity</span>
                          <span className="text-xs md:text-sm font-bold font-sans">
                            {(() => {
                              const ev = events.find(e => e.id === selectedEventId);
                              if (!ev) return '—';
                              if (ev.slotsLeft === null) return 'Open registration';
                              return `${Math.max(0, ev.slotsLeft)} / ${ev.slots} seats remaining`;
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Registration Form */}
                  <div className="w-full md:w-1/2 p-6 md:p-10 bg-[#1A3C2E] text-white flex flex-col justify-start space-y-6 md:overflow-y-auto md:max-h-[90vh] border-t md:border-t-0 md:border-l border-white/10">
                    <div>
                      <h3 className="font-sans font-black text-xl text-white">Secure Entry Slot</h3>
                      <p className="font-mono text-stone-300 text-[10px] uppercase tracking-wider mt-1.5">
                        Claim Seat Pass Ticket
                      </p>
                    </div>

                    <div className="flex-grow">
                      {!user ? (
                        <div className="text-center py-8 px-2 space-y-5">
                          <div className="w-14 h-14 bg-[#F5B400]/10 text-[#F5B400] rounded-full flex items-center justify-center mx-auto border border-[#F5B400]/20 shadow-inner">
                            <Shield size={26} />
                          </div>
                          <div className="space-y-1.5">
                            <h3 className="font-sans font-black text-base text-white">Authentication Required</h3>
                            <p className="text-stone-300 text-xs max-w-xs mx-auto leading-relaxed">
                              Sign in with your official university Google account (<span className="text-[#F5B400] font-mono">@umak.edu.ph</span>) to register for this event.
                            </p>
                          </div>

                          {registrationError && (
                            <div className="bg-rose-950/40 border border-rose-500/30 text-rose-200 p-3.5 rounded-2xl text-xs flex items-center gap-2 animate-fade-in font-sans text-left">
                              <span className="text-sm">⚠️</span>
                              <span>{registrationError}</span>
                            </div>
                          )}

                          <button
                            onClick={handleGoogleSignIn}
                            disabled={signingIn}
                            type="button"
                             className="w-full bg-white hover:bg-stone-100 text-zinc-900 py-3.5 px-4 rounded-2xl font-sans font-bold text-xs uppercase tracking-wider shadow-xl transition-[background-color,transform,opacity] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-3 cursor-pointer mt-2"
                          >
                            {signingIn ? (
                              <span className="flex items-center gap-2 text-zinc-900 font-bold">
                                <span className="w-4 h-4 border-2 border-stone-400 border-t-stone-700 rounded-full animate-spin" />
                                Connecting with Google...
                              </span>
                            ) : (
                              <>
                                <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
                                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                </svg>
                                <span className="text-zinc-900 font-bold">Continue with Google</span>
                              </>
                            )}
                          </button>

                          <div className="pt-2 border-t border-white/10 text-center">
                            <p className="text-stone-400 text-[10px] font-mono">
                              You will be returned directly to this event registration after login.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={handleRegisterSubmit} className="space-y-4 text-stone-850" id="registration-modal-form">
                          
                          {registrationError && (
                            <div className="bg-rose-950/40 border border-rose-500/30 text-rose-200 p-3.5 rounded-2xl text-xs flex items-center gap-2 animate-fade-in font-sans shrink-0">
                              <span className="text-sm">⚠️</span>
                              <span>{registrationError}</span>
                            </div>
                          )}
                          {/* Read-Only Prefilled Profile Form */}
                          <div className="space-y-4 text-left">
                            {/* Full Student Name */}
                            <div className="space-y-1">
                              <label htmlFor="registration-full-name" className="block text-[10px] font-bold text-stone-300 uppercase tracking-widest">
                                Full Student Name
                              </label>
                              <div className="relative font-sans">
                                <input
                                  id="registration-full-name"
                                  type="text"
                                  disabled
                                  value={fullName}
                                  className="w-full bg-black/35 opacity-70 border border-white/10 text-xs rounded-xl px-3.5 py-2.5 text-stone-300 cursor-not-allowed font-semibold pl-9 outline-none"
                                />
                                <Lock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 select-none" />
                              </div>
                            </div>

                            {/* CCIS Institutional Email */}
                            <div className="space-y-1">
                              <label htmlFor="registration-email" className="block text-[10px] font-bold text-stone-300 uppercase tracking-widest">
                                CCIS Institutional Email
                              </label>
                              <div className="relative font-sans">
                                <input
                                  id="registration-email"
                                  type="text"
                                  disabled
                                  value={email}
                                  className="w-full bg-black/35 opacity-70 border border-white/10 text-xs rounded-xl px-3.5 py-2.5 text-stone-300 cursor-not-allowed font-semibold pl-9 outline-none"
                                />
                                <Lock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 select-none" />
                              </div>
                            </div>

                            {/* Student ID Number */}
                            <div className="space-y-1">
                              <label htmlFor="registration-student-number" className="block text-[10px] font-bold text-stone-300 uppercase tracking-widest">
                                Student ID Number
                              </label>
                              <div className="relative font-sans">
                                <input
                                  id="registration-student-number"
                                  type="text"
                                  disabled
                                  value={studentNum}
                                  className="w-full bg-black/35 opacity-70 border border-white/10 text-xs rounded-xl px-3.5 py-2.5 text-stone-300 cursor-not-allowed font-semibold pl-9 outline-none"
                                />
                                <Lock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 select-none" />
                              </div>
                            </div>

                            {/* Academic Computer Program */}
                            <div className="space-y-1">
                              <label htmlFor="registration-program" className="block text-[10px] font-bold text-stone-300 uppercase tracking-widest">
                                Academic Computer Program
                              </label>
                              <div className="relative font-sans">
                                <input
                                  id="registration-program"
                                  type="text"
                                  disabled
                                  value={PROGRAM_NAMES[profile?.program || ''] || profile?.program || '—'}
                                  className="w-full bg-black/35 opacity-70 border border-white/10 text-xs rounded-xl px-3.5 py-2.5 text-stone-300 cursor-not-allowed font-semibold pl-9 outline-none"
                                />
                                <Lock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 select-none" />
                              </div>
                            </div>

                            {/* Year Level */}
                            <div className="space-y-1">
                              <label htmlFor="registration-year-level" className="block text-[10px] font-bold text-stone-300 uppercase tracking-widest">
                                Year Level
                              </label>
                              <div className="relative font-sans">
                                <input
                                  id="registration-year-level"
                                  type="text"
                                  disabled
                                  value={YEAR_LEVELS[profile?.year_level || 0] || '—'}
                                  className="w-full bg-black/35 opacity-70 border border-white/10 text-xs rounded-xl px-3.5 py-2.5 text-stone-300 cursor-not-allowed font-semibold pl-9 outline-none"
                                />
                                <Lock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 select-none" />
                              </div>
                            </div>

                            {/* Class Section */}
                            <div className="space-y-1">
                              <label htmlFor="registration-section" className="block text-[10px] font-bold text-stone-300 uppercase tracking-widest">
                                Class Section
                              </label>
                              <div className="relative font-sans">
                                <input
                                  id="registration-section"
                                  type="text"
                                  disabled
                                  value={section}
                                  className="w-full bg-black/35 opacity-70 border border-white/10 text-xs rounded-xl px-3.5 py-2.5 text-stone-300 cursor-not-allowed font-semibold pl-9 outline-none"
                                />
                                <Lock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 select-none" />
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 text-[9px] text-stone-300 italic text-center flex items-center justify-center gap-1">
                            <Info size={10} className="shrink-0" />
                            <span>All details are pulled from your locked profile. For updates, please contact admin support.</span>
                          </div>

                          <button
                            type="submit"
                            disabled={registering}
                            className="w-full bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] py-3 rounded-full font-bold text-xs uppercase tracking-wider shadow-lg transition-transform transform hover:-translate-y-0.5 mt-2 flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
                          >
                            {registering ? 'Securing Seat...' : 'Generate Official Ticket'}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                </div>

              </div>,
              document.body
            )}

            {showSuccessModal && createPortal(
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
                <div className="absolute inset-0" onClick={() => {
                  setShowSuccessModal(false);
                  if (onNavigate) onNavigate('account');
                }} />
                <div className="relative w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl border border-zinc-150 p-6 text-center space-y-4 animate-scale-up">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100 shadow-xs">
                    <CheckCircle2 size={24} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-sans font-black text-lg text-[#1A3C2E]">Registration Successful!</h3>
                    <p className="text-stone-500 text-xs leading-relaxed">
                      Your seat is successfully secured. Your digital boarding pass ticket has been generated and is ready to view.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      if (onNavigate) onNavigate('account');
                    }}
                    className="w-full bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-xs"
                  >
                    View My Pass Ticket
                  </button>
                </div>
              </div>,
              document.body
            )}

          </div>

      </div>
    </div>
  );
}
