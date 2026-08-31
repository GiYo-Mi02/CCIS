import React, { useState, useEffect, useRef } from 'react';
import { deleteManagedOptimizedImage, deleteManagedOptimizedImageByUrl, uploadOptimizedImage } from '../../lib/media/uploadOptimizedImage';
import type { MediaAsset } from '../../lib/media/types';
import { ChevronLeft, ChevronRight, Plus, List, Grid3X3, Trash, Trophy, GraduationCap, Image as ImageIcon, Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';
import { useAdmin } from '../AdminContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { EventItem } from '../../types/database';
import Modal from '../components/Modal';

export default function EventCalendar() {
  const { showToast } = useAdmin();
  const { user } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [editingEvent, setEditingEvent] = useState<Partial<EventItem> | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchEvents = async () => {
    const { data, error } = await supabase.from('events').select('id, title, description, category, event_type, event_date, event_time, location, registration_required, registration_cap, created_by, created_at, banner_url').order('event_date').limit(200);
    if (!error && data) setEvents(data as EventItem[]);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.event_date === dateStr);
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const openCreateForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setIsCreating(true);
    setEditingEvent({
      title: '', description: '', category: 'general', event_type: 'general',
      event_date: dateStr, event_time: '', location: '',
      registration_required: false, registration_cap: null,
    });
  };

  const saveEvent = async (form: Partial<EventItem>) => {
    if (isCreating) {
      const { error } = await supabase.from('events').insert({
        title: form.title, description: form.description, category: form.category,
        event_type: form.event_type || 'general',
        event_date: form.event_date, event_time: form.event_time || null,
        location: form.location || null, registration_required: form.registration_required || false,
        registration_cap: form.registration_cap || null, created_by: user?.id,
        banner_url: form.banner_url || null,
      });
      if (error) { showToast('Failed to create event', 'error'); throw error; }
      showToast('Event added!');
    } else {
      const { error } = await supabase.from('events').update({
        title: form.title, description: form.description, category: form.category,
        event_type: form.event_type || 'general',
        event_date: form.event_date, event_time: form.event_time || null,
        location: form.location || null, registration_required: form.registration_required || false,
        registration_cap: form.registration_cap || null,
        banner_url: form.banner_url || null,
      }).eq('id', form.id);
      if (error) { showToast('Failed to update event', 'error'); throw error; }
      showToast('Event updated!');
    }
    setEditingEvent(null);
    setIsCreating(false);
    fetchEvents();
  };

  const deleteEvent = async (id: string) => {
    const deletedEvent = events.find(event => event.id === id);
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) { showToast('Failed to delete', 'error'); return; }
    await deleteManagedOptimizedImageByUrl(deletedEvent?.banner_url, 'banners').catch(error =>
      console.error('Failed to clean up managed event banner:', error));
    showToast('Event deleted', 'error');
    fetchEvents();
  };

  const handleDeleteAll = async () => {
    const { error } = await supabase.from('events').delete().not('id', 'is', null);
    if (error) { showToast('Failed to delete all', 'error'); return; }
    await Promise.allSettled(events.map(event => deleteManagedOptimizedImageByUrl(event.banner_url, 'banners')));
    setEvents([]);
    showToast('All events deleted', 'error');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-[#F5B400] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
           <button type="button" onClick={prevMonth} aria-label="Previous month" className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"><ChevronLeft size={18} /></button>
          <h2 className="font-sans font-black text-xl text-[#1A3C2E] min-w-[180px] text-center">{monthName}</h2>
           <button type="button" onClick={nextMonth} aria-label="Next month" className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"><ChevronRight size={18} /></button>
        </div>
        <div className="flex items-center gap-2">
          {events.length > 0 && (
           <button type="button" onClick={() => { if (window.confirm('Delete all scheduled events?')) handleDeleteAll(); }} className="bg-rose-50 border border-rose-200 hover:bg-rose-100 text-[#C0392B] px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer" title="Delete All Events">
              <Trash size={14} /> Delete All
            </button>
          )}
          <div className="flex items-center gap-0.5 bg-white rounded-lg border border-[#1A3C2E]/20 p-0.5 shadow-2xs">
             <button type="button" onClick={() => setViewMode('calendar')} aria-label="Calendar view" className={`p-1.5 rounded transition-colors ${viewMode === 'calendar' ? 'bg-[#F5B400] text-[#1A3C2E]' : 'text-gray-400 hover:text-gray-600'}`}><Grid3X3 size={16} /></button>
             <button type="button" onClick={() => setViewMode('list')} aria-label="List view" className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-[#F5B400] text-[#1A3C2E]' : 'text-gray-400 hover:text-gray-600'}`}><List size={16} /></button>
          </div>
           <button type="button" onClick={() => openCreateForDate(new Date().getDate())} className="bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm transition-colors cursor-pointer">
            <Plus size={15} /> Add Event
           </button>
        </div>
      </div>

      {/* Calendar Grid with Crisp Visible Borders */}
      {viewMode === 'calendar' ? (
        <div className="bg-white rounded-2xl border border-[#1A3C2E]/25 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[#1A3C2E]/20 bg-stone-50 divide-x divide-[#1A3C2E]/15">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="px-2 py-2.5 text-center text-[10px] font-black uppercase tracking-wider text-[#1A3C2E]/70">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 border-b border-[#1A3C2E]/20">
            {days.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} className="min-h-[110px] border-b border-r border-[#1A3C2E]/15 bg-stone-50/60" />;
              const dayEvents = getEventsForDay(day);
              const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
               return (
                 <div key={day} className={`relative min-h-[110px] border-b border-r border-[#1A3C2E]/20 p-2 hover:bg-[#F5B400]/[0.05] transition-colors ${isToday ? 'bg-[#F5B400]/10' : 'bg-white'}`}>
                   <button type="button" aria-label={`Add event on ${monthName.split(' ')[0]} ${day}, ${year}`} onClick={() => openCreateForDate(day)} className="absolute inset-0 z-0" />
                   <div className="relative z-10 pointer-events-none flex items-center justify-between">
                    <button type="button" aria-label={`Add event on ${monthName.split(' ')[0]} ${day}, ${year}`} onClick={() => openCreateForDate(day)} className={`pointer-events-auto text-xs font-bold inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-[#1A3C2E] text-[#F5B400]' : 'text-stone-700 hover:bg-stone-100'}`}>
                      {day}
                    </button>
                    {dayEvents.length > 0 && (
                      <span className="text-[9px] font-mono text-[#5E6E64] font-semibold">{dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}</span>
                    )}
                  </div>
                   <div className="relative z-10 mt-1.5 space-y-1">
                    {dayEvents.slice(0, 3).map(ev => {
                      const isComp = ev.event_type === 'competition';
                      return (
                         <button type="button" key={ev.id} onClick={() => { setIsCreating(false); setEditingEvent(ev); }} aria-label={`Edit event: ${ev.title}`}
                           className={`pointer-events-auto text-[9.5px] font-bold px-2 py-1 rounded-md truncate cursor-pointer transition-colors border flex items-center gap-1 ${
                            isComp
                              ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                          }`}>
                          {isComp ? <Trophy size={10} className="text-amber-600 shrink-0" /> : <GraduationCap size={10} className="text-emerald-600 shrink-0" />}
                          <span className="truncate">{ev.title}</span>
                        </button>
                      );
                    })}
                    {dayEvents.length > 3 && <span className="text-[9px] text-gray-500 font-mono pl-1 block font-semibold">+{dayEvents.length - 3} more</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#1A3C2E]/25 shadow-sm overflow-hidden">
          <div className="divide-y divide-[#1A3C2E]/15">
            {events.length === 0 ? (
              <p className="p-8 text-center text-gray-400 text-sm">No events scheduled</p>
            ) : events.map(ev => (
               <button type="button" key={ev.id} className="w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-stone-50 transition-colors" onClick={() => { setIsCreating(false); setEditingEvent(ev); }} aria-label={`Edit event: ${ev.title}`}>
                <div className={`w-2.5 h-12 rounded-full shrink-0 ${ev.category === 'priority' ? 'bg-[#F5B400]' : 'bg-[#1A3C2E]'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-[#1A3C2E] truncate">{ev.title}</p>
                    <span className={`text-[9.5px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1 ${
                      ev.event_type === 'competition'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    }`}>
                      {ev.event_type === 'competition' ? (
                        <>
                          <Trophy size={10} className="text-amber-600" /> Competition
                        </>
                      ) : (
                        <>
                          <GraduationCap size={10} className="text-emerald-700" /> General Assembly
                        </>
                      )}
                    </span>
                   </div>
                   <p className="text-[11px] text-gray-500 font-sans mt-0.5 line-clamp-1">{ev.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-[#1A3C2E]">{new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  {ev.event_time && <p className="text-[10px] text-gray-500 font-mono">{ev.event_time}</p>}
                </div>
               </button>
            ))}
          </div>
        </div>
      )}

      {/* Edit/Create Modal */}
      {editingEvent && (
        <Modal isOpen={true} onClose={() => { setEditingEvent(null); setIsCreating(false); }} title={isCreating ? 'Add Event' : 'Edit Event'}>
          <EventForm event={editingEvent} isCreating={isCreating} onSave={saveEvent} onDelete={deleteEvent} onClose={() => { setEditingEvent(null); setIsCreating(false); }} />
        </Modal>
      )}
    </div>
  );
}

function EventForm({ event, isCreating, onSave, onDelete, onClose }: {
  event: Partial<EventItem>;
  isCreating: boolean;
  onSave: (e: Partial<EventItem>) => Promise<void>;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ ...event });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingAssetRef = useRef<MediaAsset | null>(null);
  const committedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
    if (!committedRef.current && pendingAssetRef.current) {
      void deleteManagedOptimizedImage(pendingAssetRef.current).catch(() => undefined);
    }
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be under 10MB.');
      return;
    }

    setUploading(true);
    try {
      const result = await uploadOptimizedImage(file, {
        category: 'banner',
        bucket: 'banners',
        folder: 'events',
        entityType: 'events',
        entityId: event?.id,
      });
      if (!mountedRef.current) {
        await deleteManagedOptimizedImage(result.asset).catch(() => undefined);
        return;
      }
      const previousPendingAsset = pendingAssetRef.current;
      pendingAssetRef.current = result.asset;
      const cardUrl = result.asset.variants.find(variant => variant.label === 'card')?.publicUrl ?? result.asset.publicUrl;
      setForm({ ...form, banner_url: cardUrl });
      alert(`Optimized ${(result.originalSizeBytes / 1024).toFixed(0)} KB to ${(result.optimizedSizeBytes / 1024).toFixed(0)} KB (${result.percentageSaved.toFixed(0)}% saved).`);
      if (previousPendingAsset) {
        await deleteManagedOptimizedImage(previousPendingAsset).catch(error => console.error('Failed to clean up replaced draft event banner:', error));
      }
    } catch (err: unknown) {
      console.error(err);
      alert(`Upload failed: ${err instanceof Error ? err.message : 'Unknown image error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (uploading) return;
    committedRef.current = true;
    try {
      await onSave(form);
      if (event.banner_url && event.banner_url !== form.banner_url) {
        await deleteManagedOptimizedImageByUrl(event.banner_url, 'banners').catch(error =>
          console.error('Failed to clean up replaced event banner:', error));
      }
    } catch (error) {
      committedRef.current = false;
      if (pendingAssetRef.current) {
        await deleteManagedOptimizedImage(pendingAssetRef.current).catch(() => undefined);
        pendingAssetRef.current = null;
      }
      setForm(previous => ({ ...previous, banner_url: event.banner_url || null }));
      alert(error instanceof Error ? error.message : 'The event could not be saved.');
    }
  };

  const handleRemoveBanner = () => {
    if (pendingAssetRef.current) {
      void deleteManagedOptimizedImage(pendingAssetRef.current).catch(() => undefined);
      pendingAssetRef.current = null;
    }
    setForm(previous => ({ ...previous, banner_url: null }));
  };

  return (
    <div className="space-y-4">
      {/* Event Banner Image Upload */}
      <div>
        <label htmlFor="event-banner" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Event Banner Image</label>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-lg bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center relative flex-shrink-0">
            {form.banner_url ? (
              <img src={form.banner_url} alt="Banner Preview" width={960} height={400} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon size={22} className="text-stone-300" />
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <div className="space-y-1 flex-1 font-sans">
            <input 
              id="event-banner"
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              onChange={handleUpload} 
              className="hidden" 
            />
            <div className="flex gap-1.5">
                  <button
                    type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-3 py-1.5 border border-gray-200 hover:border-gray-300 text-[11px] font-bold rounded-lg text-gray-700 hover:bg-gray-50 transition-colors uppercase tracking-wider cursor-pointer"
              >
                {form.banner_url ? 'Change' : 'Choose'}
              </button>
              {form.banner_url && (
                <button 
                  type="button"
                  onClick={handleRemoveBanner}
                  className="px-3 py-1.5 border border-rose-200 hover:border-rose-300 text-[11px] font-bold rounded-lg text-rose-600 hover:bg-rose-50 transition-colors uppercase tracking-wider cursor-pointer"
                >
                  Remove
              </button>
              )}
            </div>
            <p className="text-[9px] text-gray-400">Max 5MB.</p>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="event-title" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Title</label>
        <input id="event-title" type="text" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="event-date" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Date</label>
          <input id="event-date" type="date" value={form.event_date || ''} onChange={(e) => setForm({ ...form, event_date: e.target.value })} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400]" />
        </div>
        <div>
          <label htmlFor="event-time" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Time (optional)</label>
          <input id="event-time" type="text" value={form.event_time || ''} onChange={(e) => setForm({ ...form, event_time: e.target.value })} placeholder="e.g. 2:00 PM" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]" />
        </div>
      </div>
      {/* Event Classification Selection */}
      <fieldset>
        <legend className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
          Event Classification
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setForm({ ...form, event_type: 'competition', registration_required: true })}
            className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-colors cursor-pointer ${
              form.event_type === 'competition'
                ? 'border-amber-400 bg-amber-50/80 text-amber-900 ring-2 ring-amber-300/50'
                : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
            }`}
          >
            <span className="text-xs font-black flex items-center gap-1.5 text-[#1A3C2E]">
              <Trophy size={14} className="text-amber-600" /> Competition / Tournament
            </span>
            <span className="text-[10px] text-gray-500 leading-snug">
              Hackathons, coding contests, esports. Prompts participant registrations.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setForm({ ...form, event_type: 'general' })}
            className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-colors cursor-pointer ${
              form.event_type !== 'competition'
                ? 'border-emerald-500 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-300/50'
                : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
            }`}
          >
            <span className="text-xs font-black flex items-center gap-1.5 text-[#1A3C2E]">
              <GraduationCap size={14} className="text-emerald-700" /> General Assembly / Seminar
            </span>
            <span className="text-[10px] text-gray-500 leading-snug">
              Seminars, webinars, GAs. Audiences use their Universal Attendance QR pass.
            </span>
          </button>
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="event-category" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Category Priority</label>
          <select id="event-category" value={form.category || 'general'} onChange={(e) => setForm({ ...form, category: e.target.value as any })} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400]">
            <option value="general">Standard Schedule</option>
            <option value="priority">Priority / Critical Deadline</option>
          </select>
        </div>
        <div>
          <label htmlFor="event-location" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Location</label>
          <input id="event-location" type="text" value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. HPSB Hall 1 / Online" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]" />
        </div>
      </div>
      <div>
        <label htmlFor="event-description" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Description</label>
        <textarea id="event-description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400] resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <input id="event-registration-required" type="checkbox" checked={form.registration_required || false} onChange={(e) => setForm({ ...form, registration_required: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-[#F5B400] focus:ring-[#F5B400]" />
          <label htmlFor="event-registration-required" className="text-xs font-bold text-[#222B26]">Participant Form Required</label>
        </div>
        {form.registration_required && (
          <div>
            <label htmlFor="event-registration-cap" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Slot Cap (optional)</label>
            <input id="event-registration-cap" type="number" value={form.registration_cap || ''} onChange={(e) => setForm({ ...form, registration_cap: e.target.value ? Number(e.target.value) : null })} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400]" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
         <button type="button" onClick={() => void handleSave()} disabled={uploading} className="px-5 py-2.5 bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer disabled:opacity-50">
          {isCreating ? 'Add Event' : 'Save Changes'}
        </button>
        {!isCreating && form.id && (
           <button type="button" onClick={() => { onDelete(form.id!); onClose(); }} className="px-4 py-2.5 text-xs text-[#C0392B] hover:bg-red-50 rounded-lg transition-colors font-bold cursor-pointer">Delete</button>
        )}
         <button type="button" onClick={onClose} className="ml-auto px-4 py-2.5 text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}
