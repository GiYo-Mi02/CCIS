import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, List, Grid3X3, Trash } from 'lucide-react';
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
    const { data, error } = await supabase.from('events').select('*').order('event_date');
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
      if (error) { showToast('Failed to create event', 'error'); return; }
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
      if (error) { showToast('Failed to update event', 'error'); return; }
      showToast('Event updated!');
    }
    setEditingEvent(null);
    setIsCreating(false);
    fetchEvents();
  };

  const deleteEvent = async (id: string) => {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) { showToast('Failed to delete', 'error'); return; }
    showToast('Event deleted', 'error');
    fetchEvents();
  };

  const handleDeleteAll = async () => {
    const { error } = await supabase.from('events').delete().not('id', 'is', null);
    if (error) { showToast('Failed to delete all', 'error'); return; }
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
    <div className="space-y-5 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-500"><ChevronLeft size={16} /></button>
          <h2 className="font-sans font-bold text-lg text-[#1A3C2E] min-w-[180px] text-center">{monthName}</h2>
          <button onClick={nextMonth} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-500"><ChevronRight size={16} /></button>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {events.length > 0 && (
            <button onClick={handleDeleteAll} className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors">
              <Trash size={13} /> Delete All
            </button>
          )}
          <div className="flex items-center gap-0.5 bg-white rounded-lg border border-gray-200 p-0.5">
            <button onClick={() => setViewMode('calendar')} className={`p-1.5 rounded transition-colors ${viewMode === 'calendar' ? 'bg-[#F5B400] text-[#1A3C2E]' : 'text-gray-400 hover:text-gray-600'}`}><Grid3X3 size={16} /></button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-[#F5B400] text-[#1A3C2E]' : 'text-gray-400 hover:text-gray-600'}`}><List size={16} /></button>
          </div>
          <button onClick={() => openCreateForDate(new Date().getDate())} className="bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm transition-colors">
            <Plus size={15} /> Add Event
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      {viewMode === 'calendar' ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-gray-50 bg-gray-50/50" />;
              const dayEvents = getEventsForDay(day);
              const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
              return (
                <div key={day} className={`min-h-[100px] border-b border-r border-gray-50 p-1.5 hover:bg-[#F5B400]/[0.03] transition-colors cursor-pointer ${isToday ? 'bg-[#F5B400]/5' : ''}`}
                  onClick={() => openCreateForDate(day)}>
                  <span className={`text-xs font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-[#F5B400] text-[#1A3C2E]' : 'text-gray-500'}`}>{day}</span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => (
                      <div key={ev.id} onClick={(e) => { e.stopPropagation(); setIsCreating(false); setEditingEvent(ev); }}
                        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded truncate cursor-pointer transition-colors ${ev.category === 'priority' ? 'bg-[#F5B400]/15 text-[#B38600] hover:bg-[#F5B400]/25' : 'bg-[#2E7D32]/10 text-[#2E7D32] hover:bg-[#2E7D32]/20'}`}>
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && <span className="text-[9px] text-gray-400 font-mono pl-1">+{dayEvents.length - 3} more</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {events.length === 0 ? (
              <p className="p-8 text-center text-gray-400 text-sm">No events scheduled</p>
            ) : events.map(ev => (
              <div key={ev.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => { setIsCreating(false); setEditingEvent(ev); }}>
                <div className={`w-2 h-10 rounded-full shrink-0 ${ev.category === 'priority' ? 'bg-[#F5B400]' : 'bg-[#2E7D32]'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#222B26] truncate">{ev.title}</p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      ev.event_type === 'competition'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {ev.event_type === 'competition' ? '🏆 Competition' : '🎓 General'}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 font-mono">{ev.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-[#222B26]">{new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  {ev.event_time && <p className="text-[10px] text-gray-400 font-mono">{ev.event_time}</p>}
                </div>
              </div>
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
  onSave: (e: Partial<EventItem>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ ...event });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const fileExt = file.name.split('.').pop();
      const fileName = `events/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('banners')
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('banners')
        .getPublicUrl(fileName);

      setForm({ ...form, banner_url: urlData.publicUrl });
    } catch (err: any) {
      console.error(err);
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Event Banner Image Upload */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Event Banner Image</label>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-lg bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center relative flex-shrink-0">
            {form.banner_url ? (
              <img src={form.banner_url} alt="Banner Preview" className="w-full h-full object-cover" />
            ) : (
              <span className="text-gray-300 text-lg">🖼️</span>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <div className="space-y-1 flex-1 font-sans">
            <input 
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
                  onClick={() => setForm({ ...form, banner_url: null })}
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
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Title</label>
        <input type="text" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Date</label>
          <input type="date" value={form.event_date || ''} onChange={(e) => setForm({ ...form, event_date: e.target.value })} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400]" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Time (optional)</label>
          <input type="text" value={form.event_time || ''} onChange={(e) => setForm({ ...form, event_time: e.target.value })} placeholder="e.g. 2:00 PM" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]" />
        </div>
      </div>
      {/* Event Classification Selection */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
          Event Classification
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setForm({ ...form, event_type: 'competition', registration_required: true })}
            className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
              form.event_type === 'competition'
                ? 'border-amber-400 bg-amber-50/80 text-amber-900 ring-2 ring-amber-300/50'
                : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
            }`}
          >
            <span className="text-xs font-black flex items-center gap-1.5 text-[#1A3C2E]">
              🏆 Competition / Tournament
            </span>
            <span className="text-[10px] text-gray-500 leading-snug">
              Hackathons, coding contests, esports. Prompts participant registrations.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setForm({ ...form, event_type: 'general' })}
            className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
              form.event_type !== 'competition'
                ? 'border-emerald-500 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-300/50'
                : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
            }`}
          >
            <span className="text-xs font-black flex items-center gap-1.5 text-[#1A3C2E]">
              🎓 General Assembly / Seminar
            </span>
            <span className="text-[10px] text-gray-500 leading-snug">
              Seminars, webinars, GAs. Audiences use their Universal Attendance QR pass.
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Category Priority</label>
          <select value={form.category || 'general'} onChange={(e) => setForm({ ...form, category: e.target.value as any })} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400]">
            <option value="general">Standard Schedule</option>
            <option value="priority">Priority / Critical Deadline</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Location</label>
          <input type="text" value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. HPSB Hall 1 / Online" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Description</label>
        <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400] resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={form.registration_required || false} onChange={(e) => setForm({ ...form, registration_required: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-[#F5B400] focus:ring-[#F5B400]" />
          <label className="text-xs font-bold text-[#222B26]">Participant Form Required</label>
        </div>
        {form.registration_required && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Slot Cap (optional)</label>
            <input type="number" value={form.registration_cap || ''} onChange={(e) => setForm({ ...form, registration_cap: e.target.value ? Number(e.target.value) : null })} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400]" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <button onClick={() => onSave(form)} className="px-5 py-2.5 bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer">
          {isCreating ? 'Add Event' : 'Save Changes'}
        </button>
        {!isCreating && form.id && (
          <button onClick={() => { onDelete(form.id!); onClose(); }} className="px-4 py-2.5 text-xs text-[#C0392B] hover:bg-red-50 rounded-lg transition-colors font-bold cursor-pointer">Delete</button>
        )}
        <button onClick={onClose} className="ml-auto px-4 py-2.5 text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}
