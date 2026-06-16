import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Ticket, Calendar, MapPin, CheckCircle2, QrCode, ClipboardList, Clock, ArrowRight, Shield, X, Download, Printer } from 'lucide-react';
import { EventItem, Registration } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Pagination from '../admin/components/Pagination';
import html2canvas from 'html2canvas-pro';
import { QRCodeCanvas } from 'qrcode.react';

interface RegistrationSectionProps {
  onNavigate?: (tab: string, eventId?: string) => void;
  preselectedEventId?: string | null;
  onClearPreselected?: () => void;
}

export default function RegistrationSection({ onNavigate, preselectedEventId, onClearPreselected }: RegistrationSectionProps) {
  const { user, profile, updateProfile } = useAuth();
  
  const [events, setEvents] = useState<EventItem[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  
  // Grid filters & pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<'all' | 'general' | 'priority'>('all');

  // Ticket history pagination state
  const [ticketsPage, setTicketsPage] = useState(1);
  const ticketsPerPage = 6;
  const totalTicketsPages = Math.ceil(myRegistrations.length / ticketsPerPage);

  // Registration Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [studentNum, setStudentNum] = useState('');
  const [collegeBranch, setCollegeBranch] = useState('Computer Science');
  const [section, setSection] = useState('');
  
  const [activeTab, setActiveTab] = useState<'register' | 'history'>('register');
  const [newRegTicket, setNewRegTicket] = useState<Registration | null>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  // Prefill identity info from profile
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setEmail(profile.email || '');
      setStudentNum(profile.student_number || '');
      setCollegeBranch(profile.program || 'Computer Science');
      setSection(profile.section || '');
    }
  }, [profile]);

  // Listen for preselected event redirect
  useEffect(() => {
    if (preselectedEventId) {
      setSelectedEventId(preselectedEventId);
      setIsModalOpen(true);
      if (onClearPreselected) {
        onClearPreselected();
      }
    }
  }, [preselectedEventId]);

  // Fetch events and registrations from Supabase
  const fetchData = async () => {
    setLoading(true);
    setRegistrationError(null);
    const today = new Date().toISOString().split('T')[0];

    try {
      // 1. Query events table directly with manual registration count
      let eventsQuery = supabase
        .from('events')
        .select('*', { count: 'exact' })
        .eq('registration_required', true)
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

      // Fetch registration counts for the loaded events
      const eventIds = (eventsData || []).map((e: any) => e.id);
      let counts: Record<string, number> = {};

      if (eventIds.length > 0) {
        const { data: regCounts } = await supabase
          .from('event_registrations')
          .select('event_id')
          .in('event_id', eventIds);

        regCounts?.forEach(r => {
          counts[r.event_id] = (counts[r.event_id] || 0) + 1;
        });
      }

      const mappedEvents = (eventsData || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        date: e.event_date,
        time: e.event_time || 'TBA',
        location: e.location || 'TBA',
        slots: e.registration_cap || 100,
        registeredCount: counts[e.id] || 0,
        description: e.description || '',
      }));

      setEvents(mappedEvents);

      // 2. Fetch user's registrations if logged in
      if (user) {
        const { data: myRegsData, error: myRegsError } = await supabase
          .from('event_registrations')
          .select('*, events(title, event_date, location), profiles(full_name, email, student_number, program, section)')
          .eq('profile_id', user.id)
          .order('registered_at', { ascending: false });

        if (!myRegsError && myRegsData) {
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
  };

  useEffect(() => {
    fetchData();
  }, [user, profile, currentPage, filter]);

  // Clear registration error when selected event changes
  useEffect(() => {
    setRegistrationError(null);
  }, [selectedEventId]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!fullName || !studentNum) {
      setRegistrationError('Identity details are incomplete. Please complete your profile first.');
      return;
    }

    if (!section.trim()) {
      setRegistrationError('Class Section is required.');
      return;
    }

    const matchedEvent = events.find(ev => ev.id === selectedEventId);
    if (!matchedEvent) return;

    setRegistrationError(null);

    const sectionTrimmed = section.trim().toUpperCase().replace(/\s/g, '');
    if (!/^[A-Z0-9]+$/.test(sectionTrimmed)) {
      setRegistrationError('Section must contain only uppercase letters and numbers, with no spaces (e.g., ACSAD, A31).');
      return;
    }

    const slotsLeft = matchedEvent.slots - matchedEvent.registeredCount;
    if (slotsLeft <= 0) {
      setRegistrationError('Sorry, registration slots for this event are fully filled.');
      return;
    }

    const exists = myRegistrations.some(reg => reg.eventId === selectedEventId);
    if (exists) {
      setRegistrationError('You are already registered for this computing event!');
      return;
    }

    setRegistering(true);

    try {
      // Update profile with editable form choices (program, section)
      await updateProfile({
        program: collegeBranch,
        section: sectionTrimmed,
        profile_complete: true,
      });

      // Insert new registration
      const { data: regData, error: regError } = await supabase
        .from('event_registrations')
        .insert({
          event_id: selectedEventId,
          profile_id: user.id,
          status: 'confirmed',
        })
        .select('*, events(title, event_date, location)')
        .single();

      if (regError || !regData) {
        setRegistrationError('Failed to register. Please try again.');
        setRegistering(false);
        return;
      }

      // Attempt to send ticket email via Supabase Edge Function
      // Logs result visibly so admin can debug email delivery issues
      try {
        const emailPayload = {
          registrationId: regData.id,
          email: email,
          name: fullName,
          section: sectionTrimmed,
          college: collegeBranch,
          eventTitle: regData.events?.title || matchedEvent.title,
        };

        supabase.functions.invoke('send-ticket-email', {
          body: emailPayload,
        }).then(({ data, error }) => {
          if (error) {
            console.warn('[Email] Edge function returned error:', error.message || error);
            console.info('[Email] To enable email delivery, deploy the send-ticket-email Supabase Edge Function.');
            console.info('[Email] Payload that would have been sent:', JSON.stringify(emailPayload, null, 2));
          } else {
            console.log('[Email] Ticket email dispatched successfully via Edge Function.', data);
          }
        }).catch((err: any) => {
          console.warn('[Email] Edge function not reachable:', err.message || err);
          console.info('[Email] This is expected if the Edge Function has not been deployed yet.');
          console.info('[Email] Payload:', JSON.stringify(emailPayload, null, 2));
        });
      } catch (emailErr) {
        console.warn('[Email] Failed to invoke edge function:', emailErr);
      }

      const ticket: Registration = {
        id: regData.id,
        name: fullName,
        email: email,
        studentNumber: studentNum,
        courseYear: collegeBranch,
        college: collegeBranch,
        section: sectionTrimmed,
        eventId: selectedEventId,
        eventTitle: regData.events?.title || matchedEvent.title,
        registeredAt: new Date(regData.registered_at).toISOString().split('T')[0],
        status: regData.status,
      };

      // Update locally
      setNewRegTicket(ticket);
      setMyRegistrations(prev => [ticket, ...prev]);
      setEvents(prev => prev.map(ev => {
        if (ev.id === selectedEventId) {
          return { ...ev, registeredCount: ev.registeredCount + 1 };
        }
        return ev;
      }));

      // Close modal and switch to history
      setIsModalOpen(false);
      setActiveTab('history');
      setTicketsPage(1); // Jump to first page of tickets
      alert('Registration Successful! Your seat is secured.');
    } catch (err) {
      setRegistrationError('An unexpected error occurred during registration.');
      console.error(err);
    } finally {
      setRegistering(false);
    }
  };

  const getEventSlotsLeft = (ev: EventItem) => {
    return ev.slots - ev.registeredCount;
  };

  const paginatedTickets = myRegistrations.slice(
    (ticketsPage - 1) * ticketsPerPage,
    ticketsPage * ticketsPerPage
  );

  if (loading) {
    return (
      <div className="bg-[#FAF7EA] min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#F5B400] border-t-transparent rounded-full animate-spin" />
      </div>
    );
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

        {/* Top switcher */}
        <div className="flex justify-center gap-2 mb-8">
          <button
            onClick={() => { setActiveTab('register'); setNewRegTicket(null); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-sans text-xs uppercase tracking-wider font-bold transition-all ${
              activeTab === 'register'
                ? 'bg-[#1A3C2E] text-white opacity-100 shadow-md'
                : 'bg-white border border-zinc-200 text-[#5E6E64] hover:bg-zinc-50'
            }`}
          >
            <ClipboardList size={14} />
            Browse &amp; Register Events
          </button>
          
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-sans text-xs uppercase tracking-wider font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-[#1A3C2E] text-white opacity-100 shadow-md'
                : 'bg-white border border-zinc-200 text-[#5E6E64] hover:bg-zinc-50'
            }`}
          >
            <Ticket size={14} className="text-[#F5B400]" />
            Your Seat Tickets ({myRegistrations.length})
          </button>
        </div>

        {activeTab === 'register' ? (
          <div className="space-y-6">
            
            {/* Filter chips & Pagination controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-zinc-100 shadow-xs">
              <div className="flex gap-2">
                {(['all', 'general', 'priority'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => { setFilter(type); setCurrentPage(1); }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                      filter === type
                        ? 'bg-[#1A3C2E] text-white border-transparent'
                        : 'bg-white text-[#5E6E64] border-zinc-200 hover:bg-zinc-50'
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
              <div className="bg-white rounded-3xl border border-zinc-150 p-12 text-center text-zinc-500 shadow-sm max-w-xl mx-auto">
                <span className="block text-4xl mb-3">📅</span>
                <p className="font-sans font-semibold text-base text-[#1A3C2E]">No upcoming events</p>
                <p className="text-xs mt-0.5">Please check back later for newly scheduled Student Council activities.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((ev) => {
                  const slotsLeft = getEventSlotsLeft(ev);
                  const isFull = slotsLeft <= 0;
                  const isRegistered = myRegistrations.some(reg => reg.eventId === ev.id);
                  
                  return (
                    <div
                      key={ev.id}
                      className={`bg-white p-6 rounded-3xl border flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow relative overflow-hidden ${
                        isFull && !isRegistered ? 'opacity-65 border-zinc-200' : 'border-zinc-100'
                      }`}
                      id={`register-ev-card-${ev.id}`}
                    >
                      <div>
                        {/* Upper Details */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#5E6E64] font-bold">
                            <Calendar size={13} className="text-[#F5B400]" />
                            {ev.date}
                          </span>
                          <span className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full font-black ${
                            isRegistered
                              ? 'bg-emerald-100 text-emerald-800'
                              : isFull 
                                ? 'bg-rose-100 text-rose-800'
                                : slotsLeft < 15
                                  ? 'bg-amber-100 text-[#1A3C2E]'
                                  : 'bg-zinc-100 text-zinc-600'
                          }`}>
                            {isRegistered 
                              ? '✓ Registered' 
                              : isFull 
                                ? 'Sold Out' 
                                : `${slotsLeft} of ${ev.slots} slots left`}
                          </span>
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
                      <div className="space-y-4">
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

                        {/* CTA button */}
                        {isRegistered ? (
                          <div className="w-full text-center bg-emerald-50 text-emerald-700 font-sans text-xs font-black uppercase tracking-wider py-2.5 rounded-xl border border-emerald-200">
                            ✓ Seat Secured
                          </div>
                        ) : isFull ? (
                          <button
                            disabled
                            className="w-full bg-zinc-100 text-zinc-400 font-sans text-xs font-bold uppercase tracking-wider py-2.5 rounded-xl cursor-not-allowed border border-zinc-200"
                          >
                            Slots Full
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedEventId(ev.id);
                              setIsModalOpen(true);
                            }}
                            className="w-full bg-[#1A3C2E] hover:bg-[#255541] text-white font-sans text-xs font-bold uppercase tracking-wider py-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1"
                          >
                            Register <ArrowRight size={12} />
                          </button>
                        )}
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
            {isModalOpen && createPortal(
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
                
                {/* Backdrop Click Closes */}
                <div className="absolute inset-0" onClick={() => setIsModalOpen(false)} />
                
                {/* Secure Entry Slot Form Content Card */}
                <div className="relative w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-zinc-200 animate-scale-up max-h-[90vh] flex flex-col md:flex-row overflow-y-auto md:overflow-y-hidden">
                  
                  {/* Close button */}
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/10 text-stone-600 md:bg-white/10 md:text-white hover:bg-black/20 md:hover:bg-white/20 transition-colors"
                  >
                    <X size={18} />
                  </button>

                  {/* Left Column: Event Information */}
                  <div className="w-full md:w-1/2 p-6 md:p-10 bg-[#FAF7EA]/50 flex flex-col justify-start space-y-6 md:overflow-y-auto md:max-h-[90vh] text-[#1A3C2E]">
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
                              const remaining = Math.max(0, ev.slots - ev.registeredCount);
                              return `${remaining} / ${ev.slots} seats remaining`;
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
                        <div className="text-center py-8 px-2 space-y-4">
                          <div className="w-14 h-14 bg-[#F5B400]/10 text-[#F5B400] rounded-full flex items-center justify-center mx-auto border border-[#F5B400]/20">
                            <Shield size={24} />
                          </div>
                          <h3 className="font-sans font-black text-sm text-white">Authentication Required</h3>
                          <p className="text-stone-300 text-xs max-w-sm mx-auto leading-relaxed">
                            You must sign in with your CCIS student account to book seats and claim seat passes.
                          </p>
                        </div>
                      ) : (
                        <form onSubmit={handleRegisterSubmit} className="space-y-4 text-stone-850" id="registration-modal-form">
                          
                          {registrationError && (
                            <div className="bg-rose-950/40 border border-rose-500/30 text-rose-200 p-3.5 rounded-2xl text-xs flex items-center gap-2 animate-fade-in font-sans shrink-0">
                              <span className="text-sm">⚠️</span>
                              <span>{registrationError}</span>
                            </div>
                          )}

                          {/* Read-Only Profile Identity Data Box */}
                          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-2.5 text-white">
                            <div className="space-y-0.5">
                              <span className="block text-[8.5px] font-mono uppercase tracking-widest text-stone-400">Full Student Name</span>
                              <span className="text-xs font-black block text-stone-100">{fullName || '—'}</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="block text-[8.5px] font-mono uppercase tracking-widest text-stone-400">CCIS Institutional Email</span>
                              <span className="text-xs font-mono block text-stone-200 truncate">{email || '—'}</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="block text-[8.5px] font-mono uppercase tracking-widest text-stone-400">Student ID Number</span>
                              <span className="text-xs font-mono block text-stone-200">{studentNum || '—'}</span>
                            </div>
                            
                            <div className="pt-2 border-t border-white/5 text-[9px] text-stone-400 italic">
                              ℹ️ Pulled from your profile. Need to fix your name, email, or student ID?{' '}
                              <button
                                type="button"
                                onClick={() => {
                                  setIsModalOpen(false);
                                  if (onNavigate) onNavigate('account');
                                }}
                                className="underline font-bold text-[#F5B400] hover:text-[#ffc522] transition-colors bg-transparent border-0 cursor-pointer p-0"
                              >
                                [Edit your profile]
                              </button>
                            </div>
                          </div>

                          {/* Editable inputs */}
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-stone-200 uppercase tracking-widest" htmlFor="reg-college">
                              Academic Computer Program
                            </label>
                            <select
                              id="reg-college"
                              value={collegeBranch}
                              onChange={(e) => setCollegeBranch(e.target.value)}
                              className="w-full bg-white border border-stone-300 focus:border-[#F5B400] text-xs rounded-xl px-3.5 py-2.5 outline-none transition-colors font-semibold text-black font-sans"
                            >
                              <option value="Computer Science">B.S. in Computer Science (BSCS)</option>
                              <option value="Information Technology">B.S. in Information Technology (BSIT)</option>
                              <option value="Information Systems">B.S. in Information Systems (BSIS)</option>
                              <option value="Data Science">B.S. in Data Science &amp; Informatics</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-stone-200 uppercase tracking-widest" htmlFor="reg-section">
                              Class Section (e.g. ACSAD, A31)
                            </label>
                            <input
                              type="text"
                              id="reg-section"
                              required
                              value={section}
                              onChange={(e) => setSection(e.target.value.toUpperCase().replace(/\s/g, ''))}
                              placeholder="e.g. ACSAD"
                              className="w-full bg-white border border-stone-300 focus:border-[#F5B400] text-xs rounded-xl px-3.5 py-2.5 outline-none transition-colors font-semibold text-black"
                            />
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

          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            
            {/* New Registered Receipt Ticket Display (If just completed) */}
            {newRegTicket && (
              <div className="bg-white p-5 rounded-3xl border border-dashed border-emerald-300 shadow-md">
                <div className="flex items-center gap-2 mb-4 text-emerald-800 bg-emerald-50 p-3 rounded-2xl">
                  <CheckCircle2 className="text-emerald-600 flex-shrink-0" size={18} />
                  <span className="text-xs md:text-sm font-sans font-bold">Registration Successful! Your seat is secured! Here is your custom pass ticket:</span>
                </div>
                <TicketDashboard registration={newRegTicket} />
              </div>
            )}

            {/* General history listing */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="font-sans font-black text-xl md:text-2xl text-[#1A3C2E] flex items-center gap-2">
                <Ticket size={18} className="text-[#F5B400]" />
                Authorized Seat Entry Tickets ({myRegistrations.length})
              </h2>
              <Pagination currentPage={ticketsPage} totalPages={totalTicketsPages} onPageChange={setTicketsPage} />
            </div>

            {!user ? (
              <div className="bg-white border rounded-3xl p-12 text-center text-zinc-500 shadow-sm border-zinc-100">
                <span className="block text-4xl mb-3">🎫</span>
                <p className="font-sans font-semibold text-base text-[#1A3C2E]">Authentication Required</p>
                <p className="text-xs mt-0.5">Please sign in to view your booked seat entry passes.</p>
              </div>
            ) : myRegistrations.length === 0 ? (
              <div className="bg-white border rounded-3xl p-12 text-center text-zinc-500 shadow-sm border-zinc-100">
                <span className="block text-4xl mb-3">🎫</span>
                <p className="font-sans font-semibold text-base text-[#1A3C2E]">No registered seats found</p>
                <p className="text-xs mt-0.5">Browse the upcoming active events and register to claim printable boarding barcodes.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {paginatedTickets
                    .filter(reg => newRegTicket ? reg.id !== newRegTicket.id : true)
                    .map((reg) => (
                      <TicketDashboard key={reg.id} registration={reg} />
                    ))}
                </div>
                
                <div className="flex justify-end pt-2">
                  <Pagination currentPage={ticketsPage} totalPages={totalTicketsPages} onPageChange={setTicketsPage} />
                </div>
              </div>
            )}

          </div>
        )}

      </div>
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
        setIsDownloading(false);
        return;
      }

      // Wait a tick to ensure QR code canvas is fully rendered
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const canvas = await html2canvas(element, {
        backgroundColor: '#FAF7EA',
        useCORS: true,
        scale: 2,
        logging: false,
        // Convert <canvas> elements (QR codes) into <img> in the cloned DOM
        // so html2canvas can actually capture them
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
      
      // Use blob download for better browser compatibility
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('Failed to create blob from canvas');
          alert('Failed to download ticket. Please try the Print option instead.');
          setIsDownloading(false);
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
        setIsDownloading(false);
      }, 'image/png');
    } catch (err) {
      console.error('Failed to export ticket as PNG:', err);
      alert('Failed to download ticket as PNG. Please try the Print option instead.');
      setIsDownloading(false);
    }
  };

  return (
    <div 
      className="bg-white border rounded-3xl shadow-md border-zinc-200/80 overflow-hidden flex flex-col md:flex-row max-w-2xl mx-auto transform transition-transform hover:scale-[1.01] font-sans"
      id={`ticket-pass-${registration.id}`}
    >
      
      {/* Visual Left Frame: Branded Info */}
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

      {/* Visual Right Frame: Entry barcode scanner verification */}
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
