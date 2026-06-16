import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface EventItemDB {
  id: string;
  title: string;
  description: string | null;
  category: 'general' | 'priority';
  event_date: string;
  event_time: string | null;
  location: string | null;
}

export function UpcomingEventsList() {
  const [upcoming, setUpcoming] = useState<EventItemDB[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUpcoming = async () => {
      const today = new Date().toISOString().split('T')[0];
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, description, category, event_date, event_time, location')
          .gte('event_date', today)
          .order('event_date', { ascending: true })
          .limit(5);

        if (!error && data) {
          setUpcoming(data as EventItemDB[]);
        }
      } catch (err) {
        console.error('Error fetching upcoming events:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUpcoming();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-5 h-5 border-2 border-[#FFBC00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (upcoming.length === 0) {
    return (
      <div className="bg-white p-4 rounded-xl border border-zinc-150 text-center text-zinc-400">
        <p className="text-xs">No upcoming events scheduled.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 font-sans">
      <h3 className="font-mono text-xs uppercase tracking-wider text-[#5E6E64] font-bold">Upcoming Directives</h3>
      <div className="space-y-2.5">
        {upcoming.map(evt => (
          <div key={evt.id} className="bg-white p-3.5 rounded-2xl border border-zinc-150 shadow-xs flex items-start gap-3">
            <div className={`w-2.5 h-10 rounded-full shrink-0 ${
              evt.category === 'priority' ? 'bg-[#FFBC00]' : 'bg-[#123524]'
            }`} />
            <div className="flex-1 min-w-0 space-y-0.5">
              <span className="text-[10px] font-mono text-[#5E6E64]">📅 {evt.event_date}</span>
              <h4 className="font-bold text-xs text-[#123524] truncate">{evt.title}</h4>
              <p className="text-[10.5px] text-[#5E6E64] truncate">{evt.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PublicEventCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 16)); // Target June 16, 2026 as reference base month
  const [events, setEvents] = useState<EventItemDB[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string>('2026-06-16');
  const [filter, setFilter] = useState<'all' | 'general' | 'priority'>('all');
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileModal, setShowMobileModal] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Listen to window size
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch events scoped to visible month
  useEffect(() => {
    const fetchMonthEvents = async () => {
      setLoading(true);
      const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0];

      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, description, category, event_date, event_time, location')
          .gte('event_date', startOfMonth)
          .lte('event_date', endOfMonth)
          .order('event_date');

        if (!error && data) {
          setEvents(data as EventItemDB[]);
        }
      } catch (err) {
        console.error('Error fetching calendar events:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMonthEvents();
  }, [year, month]);

  // Group events by date string
  const eventsMap = new Map<string, EventItemDB[]>();
  events.forEach(evt => {
    const dateStr = evt.event_date;
    if (!eventsMap.has(dateStr)) {
      eventsMap.set(dateStr, []);
    }
    eventsMap.get(dateStr)!.push(evt);
  });

  // Calculate calendar cells
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDaysCount = new Date(year, month, 0).getDate();

  const cells: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];

  // Leading days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthDaysCount - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr, isCurrentMonth: false });
  }

  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    cells.push({ day: i, dateStr, isCurrentMonth: true });
  }

  // Trailing days padding
  const totalCells = Math.ceil(cells.length / 7) * 7;
  const trailingDays = totalCells - cells.length;
  for (let i = 1; i <= trailingDays; i++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    cells.push({ day: i, dateStr, isCurrentMonth: false });
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleJumpToToday = () => {
    setCurrentDate(new Date(2026, 5, 16)); // Today reference locked for 2026 June
    setSelectedDateStr('2026-06-16');
  };

  const handleDayClick = (dateStr: string, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return;
    setSelectedDateStr(dateStr);
    if (isMobile) {
      setShowMobileModal(true);
    }
  };

  // Filter day events for render
  const selectedDayEvents = eventsMap.get(selectedDateStr) || [];
  const filteredSelectedEvents = selectedDayEvents.filter(
    e => filter === 'all' || e.category === filter
  );

  const monthLabels = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Today marker check
  const isToday = (dateStr: string) => dateStr === '2026-06-16';

  const renderEventList = (eventsList: EventItemDB[]) => {
    if (eventsList.length === 0) {
      return (
        <div className="py-10 text-center text-zinc-400 font-sans">
          <p className="font-bold text-sm">No events scheduled for this day.</p>
          <p className="text-xs mt-0.5">Select another day or adjust your filter selection.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3.5 mt-2">
        {eventsList.map(evt => (
          <div
            key={evt.id}
            className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
              evt.category === 'priority'
                ? 'border-l-4 border-l-[#FFBC00] border-zinc-150 bg-amber-50/10'
                : 'border-l-4 border-l-[#123524] border-zinc-150'
            }`}
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-[10.5px] font-mono text-[#5E6E64]">
                <span className="flex items-center gap-0.5"><Clock size={11} /> {evt.event_time || 'TBA'}</span>
                {evt.location && <span className="flex items-center gap-0.5">📍 {evt.location}</span>}
              </div>
              <h4 className="font-sans font-bold text-[#123524] text-base leading-snug">{evt.title}</h4>
              {evt.description && <p className="text-[#5E6E64] text-xs leading-relaxed">{evt.description}</p>}
            </div>
            
            <span className={`text-[9px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full font-bold self-start shrink-0 ${
              evt.category === 'priority'
                ? 'bg-amber-100 text-[#123524]'
                : 'bg-zinc-100 text-[#5E6E64]'
            }`}>
              {evt.category}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Month Navigation Control Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100 font-sans">
        <div className="flex items-center gap-3">
          <h3 className="font-sans font-black text-[#123524] text-lg">
            {monthLabels[month]} {year}
          </h3>
          <button
            onClick={handleJumpToToday}
            className="text-[10px] font-bold text-[#123524] bg-zinc-100 hover:bg-zinc-200 px-3 py-1 rounded-full uppercase tracking-wider transition-colors"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-full border border-zinc-200 text-stone-600 hover:bg-zinc-50 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-full border border-zinc-200 text-stone-600 hover:bg-zinc-50 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          <span className="font-mono text-xs text-[#5E6E64] font-bold ml-2 hidden sm:inline">UTC+8</span>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex gap-2 font-sans">
        {(['all', 'general', 'priority'] as const).map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
              filter === type
                ? 'bg-[#123524] text-white border-transparent'
                : 'bg-white text-[#5E6E64] border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Calendar Grid Container */}
      <div className="border border-zinc-150 rounded-2xl overflow-hidden shadow-xs bg-white">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-zinc-150 bg-stone-50/50 text-center py-2">
          {daysOfWeek.map(day => (
            <span key={day} className="font-mono font-bold text-[10px] text-[#5E6E64] uppercase tracking-wider">
              {day}
            </span>
          ))}
        </div>

        {/* Days Grid */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-zinc-400 space-y-2">
            <Loader2 className="animate-spin text-[#FFBC00]" size={24} />
            <p className="text-[10px] font-mono uppercase tracking-wider">Loading Schedules...</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 grid-rows-5 divide-x divide-y divide-zinc-150">
            {cells.map((cell, idx) => {
              const { dateStr, day, isCurrentMonth } = cell;
              const isSelected = selectedDateStr === dateStr;
              
              const dayEvents = eventsMap.get(dateStr) || [];
              const filteredDayEvents = dayEvents.filter(
                e => filter === 'all' || e.category === filter
              );
              
              const hasEvents = filteredDayEvents.length > 0;
              const isTodayCell = isToday(dateStr);

              // Responsive dots rendering configuration
              const priorityCount = filteredDayEvents.filter(e => e.category === 'priority').length;
              const generalCount = filteredDayEvents.filter(e => e.category === 'general').length;

              return (
                <div
                  key={`${dateStr}-${idx}`}
                  onClick={() => handleDayClick(dateStr, isCurrentMonth)}
                  className={`relative cursor-pointer transition-colors outline-none select-none flex flex-col items-center justify-between ${
                    isCurrentMonth 
                      ? isSelected 
                        ? 'bg-amber-50/20 ring-2 ring-[#FFBC00] z-10' 
                        : 'bg-white hover:bg-zinc-50/50' 
                      : 'bg-zinc-50 text-zinc-300 cursor-not-allowed'
                  } ${isMobile ? 'h-11 p-1' : 'h-16 p-1.5'}`}
                >
                  {/* Day Number badge */}
                  <div className={`text-xs font-bold font-sans flex items-center justify-center rounded-full ${
                    isTodayCell
                      ? 'bg-[#123524] text-white w-6 h-6 shadow-sm'
                      : 'text-stone-800'
                  }`}>
                    {day}
                  </div>

                  {/* Event indicator dots */}
                  {isCurrentMonth && hasEvents && (
                    <div className="w-full flex items-center justify-center gap-0.5 mt-0.5">
                      {isMobile ? (
                        <>
                          {priorityCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#FFBC00]" />}
                          {generalCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#123524]" />}
                        </>
                      ) : (
                        <>
                          {filteredDayEvents.slice(0, 3).map((evt, eIdx) => (
                            <span
                              key={evt.id}
                              className={`w-1.5 h-1.5 rounded-full ${
                                evt.category === 'priority' ? 'bg-[#FFBC00]' : 'bg-[#123524]'
                              }`}
                            />
                          ))}
                          {filteredDayEvents.length > 3 && (
                            <span className="text-[7.5px] font-mono font-black text-stone-500 leading-none">
                              +{filteredDayEvents.length - 3}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. SELECTED DAY PANEL (DESKTOP DETAIL BLOCK) */}
      {!isMobile && (
        <div className="bg-zinc-50/50 p-5 rounded-2xl border border-zinc-200 shadow-inner font-sans animate-fade-in">
          <div className="border-b border-zinc-200 pb-2.5 mb-3">
            <h4 className="font-sans font-black text-xs uppercase tracking-wider text-[#123524]">
              Agenda for: {new Date(selectedDateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </h4>
          </div>
          {renderEventList(filteredSelectedEvents)}
        </div>
      )}

      {/* 3. SELECTED DAY PANEL (MOBILE MODAL PORTAL SHEET) */}
      {isMobile && showMobileModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 bg-black/60 backdrop-blur-xs font-sans">
          <div className="absolute inset-0" onClick={() => setShowMobileModal(false)} />
          <div className="relative w-full max-h-[80vh] bg-white rounded-t-3xl overflow-hidden shadow-2xl flex flex-col justify-between border-t border-stone-200 animate-slide-up">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-zinc-150 bg-stone-50 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-mono text-[#5E6E64] uppercase tracking-wider font-bold">Selected agenda:</span>
                <h3 className="font-sans font-black text-[#123524] text-sm">
                  {new Date(selectedDateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
              </div>
              <button 
                onClick={() => setShowMobileModal(false)}
                className="p-1.5 rounded-full hover:bg-zinc-200 text-stone-500"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content Scroll Area */}
            <div className="flex-1 overflow-y-auto p-5 bg-zinc-50/30">
              {renderEventList(filteredSelectedEvents)}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
