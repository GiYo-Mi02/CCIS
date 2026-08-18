import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, X, Loader2, Zap, CalendarDays, CalendarRange } from 'lucide-react';
import { supabase } from '../lib/supabase';

const getTodayStr = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface EventItemDB {
  id: string;
  title: string;
  description: string | null;
  category: 'general' | 'priority';
  event_type?: 'competition' | 'general';
  event_date: string;
  event_time: string | null;
  location: string | null;
  banner_url: string | null;
}

interface UpcomingEventsListProps {
  onNavigate?: (tab: string, eventId?: string) => void;
}

export function UpcomingEventsList({ onNavigate }: UpcomingEventsListProps) {
  const [upcoming, setUpcoming] = useState<EventItemDB[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUpcoming = async () => {
      const today = new Date().toISOString().split('T')[0];
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, description, category, event_type, event_date, event_time, location, banner_url')
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
    <div className="space-y-4 font-sans">
      <h3 className="font-sans text-xs uppercase tracking-wider text-[#5E6E64] font-black flex items-center gap-1.5">
        <CalendarRange size={14} className="text-[#123524]" /> Upcoming Directives
      </h3>
      <div className="space-y-3">
        {upcoming.map(evt => {
          const isComp = evt.event_type === 'competition' || evt.title?.toLowerCase().includes('competition') || evt.title?.toLowerCase().includes('hackathon') || evt.title?.toLowerCase().includes('contest');

          return (
            <div key={evt.id} className="bg-white p-4 rounded-2xl border-2 border-stone-200 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                {evt.banner_url ? (
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-stone-200 relative shadow-sm">
                    <img src={evt.banner_url} alt="" className="w-full h-full object-cover" />
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      evt.category === 'priority' ? 'bg-[#FFBC00]' : 'bg-[#123524]'
                    }`} />
                  </div>
                ) : (
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-xs transition-colors duration-300 ${
                    evt.category === 'priority' 
                      ? 'bg-[#FFBC00]/15 border-[#FFBC00]/30 text-[#8F6A00]' 
                      : 'bg-[#123524]/10 border-[#123524]/20 text-[#123524]'
                  }`}>
                    {evt.category === 'priority' ? <Zap size={20} className="animate-pulse" /> : <CalendarDays size={20} />}
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1 text-left">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10.5px] font-black text-[#123524] bg-stone-100 px-2.5 py-0.5 rounded-md inline-flex items-center gap-1">
                      <Calendar size={11} className="text-[#FFBC00] shrink-0" /> {evt.event_date}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      isComp ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    }`}>
                      {isComp ? '🏆 Competition' : '🎓 General'}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-[#123524] truncate mt-1">{evt.title}</h4>
                  <p className="text-[10.5px] text-[#5E6E64] truncate">{evt.description}</p>
                </div>
              </div>
              
              {evt.event_date < getTodayStr() ? (
                <span className="text-[10px] font-bold text-stone-400 bg-stone-100 border border-stone-200 px-2.5 py-1 rounded-lg cursor-not-allowed select-none shrink-0 animate-fade-in">
                  Event Ended
                </span>
              ) : isComp ? (
                <button
                  onClick={() => onNavigate && onNavigate('registration', evt.id)}
                  className="text-[10px] font-bold text-[#123524] hover:text-[#FFBC00] hover:bg-[#123524] border border-[#123524]/20 hover:border-transparent px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer"
                >
                  Register
                </button>
              ) : (
                <button
                  onClick={() => onNavigate && onNavigate('account')}
                  className="text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-[#123524] hover:text-white border border-emerald-200 hover:border-transparent px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer"
                >
                  Audience Pass
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PublicEventCalendar({ onNavigate }: { onNavigate?: (tab: string, eventId?: string) => void }) {
  const todayStr = getTodayStr();
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [events, setEvents] = useState<EventItemDB[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const [filter, setFilter] = useState<'all' | 'general' | 'priority'>('all');
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<{ x: number; y: number } | null>(null);

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>, dateStr: string, cellEvents: EventItemDB[]) => {
    if (cellEvents.length === 0 || isMobile) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredDate(dateStr);
    setHoveredPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  };

  const handleMouseLeave = () => {
    setHoveredDate(null);
    setHoveredPosition(null);
  };

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
          .select('id, title, description, category, event_date, event_time, location, banner_url')
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
    setCurrentDate(new Date());
    setSelectedDateStr(getTodayStr());
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
  const isToday = (dateStr: string) => dateStr === todayStr;

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
            <div className="flex items-start gap-3.5 flex-1 min-w-0 text-left">
              {evt.banner_url && (
                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-zinc-150 shadow-xs">
                  <img src={evt.banner_url} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-[#5E6E64]">
                  <span className="flex items-center gap-1"><Clock size={12} className="text-[#123524]" /> {evt.event_time || 'TBA'}</span>
                  {evt.location && <span className="flex items-center gap-1"><MapPin size={12} className="text-[#123524]" /> {evt.location}</span>}
                </div>
                <h4 className="font-sans font-bold text-[#123524] text-base leading-snug">{evt.title}</h4>
                {evt.description && <p className="text-[#5E6E64] text-xs leading-relaxed">{evt.description}</p>}
              </div>
            </div>
            
            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 self-stretch sm:self-auto shrink-0">
              <span className={`text-[9px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full font-bold ${
                evt.category === 'priority'
                  ? 'bg-amber-100 text-[#123524]'
                  : 'bg-zinc-100 text-[#5E6E64]'
              }`}>
                {evt.category}
              </span>
              {evt.event_date < todayStr ? (
                <span className="text-[10px] font-bold text-stone-400 bg-stone-100 border border-stone-200 px-3 py-1.5 rounded-lg cursor-not-allowed select-none animate-fade-in">
                  Event has Ended
                </span>
              ) : (
                <button
                  onClick={() => onNavigate && onNavigate('registration', evt.id)}
                  className="text-[10px] font-bold bg-[#123524] hover:bg-[#FFBC00] text-white hover:text-[#123524] px-3 py-1.5 rounded-lg transition-all shadow-xs"
                >
                  Register
                </button>
              )}
            </div>
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
          <h3 className="font-sans font-black text-[#123524] text-xl flex items-center gap-2">
            <CalendarRange size={22} className="text-[#FFBC00] shrink-0" />
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
      <div className="border-2 border-[#123524]/20 rounded-2xl overflow-hidden shadow-sm bg-white transition-all duration-300 hover:shadow-md">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b-2 border-[#123524]/15 bg-stone-50/70 text-center py-2.5">
          {daysOfWeek.map(day => (
            <span key={day} className="font-mono font-black text-[10px] text-[#5E6E64] uppercase tracking-wider">
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
          <div className="grid grid-cols-7 grid-rows-5 divide-x-2 divide-y-2 divide-[#123524]/10 border-t border-stone-200">
            {cells.map((cell, idx) => {
              const { dateStr, day, isCurrentMonth } = cell;
              const isSelected = selectedDateStr === dateStr;
              
              const cellEvents = eventsMap.get(dateStr) || [];
              const filteredDayEvents = cellEvents.filter(
                e => filter === 'all' || e.category === filter
              );
              
              const hasEvents = filteredDayEvents.length > 0;
              const isTodayCell = isToday(dateStr);

              let cellBgClass = 'bg-white hover:bg-stone-50';
              let cellBorderClass = '';
              
              if (!isCurrentMonth) {
                cellBgClass = 'bg-stone-100/50 text-stone-300 cursor-not-allowed';
              } else if (isSelected) {
                cellBgClass = 'bg-[#FAF7EA] ring-2 ring-[#FFBC00] z-10';
              } else if (hasEvents) {
                cellBgClass = 'bg-white hover:bg-stone-50/80';
                // Bottom thick highlights indicator
                cellBorderClass = 'relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[4px] ' + 
                  (filteredDayEvents.some(e => e.category === 'priority') ? 'after:bg-[#FFBC00]' : 'after:bg-[#123524]');
              }

              return (
                <div
                  key={`${dateStr}-${idx}`}
                  onClick={() => handleDayClick(dateStr, isCurrentMonth)}
                  onMouseEnter={(e) => handleMouseEnter(e, dateStr, filteredDayEvents)}
                  onMouseLeave={handleMouseLeave}
                  className={`relative cursor-pointer transition-all duration-200 outline-none select-none flex flex-col justify-between group ${cellBgClass} ${cellBorderClass} ${
                    isMobile ? 'h-14 p-1.5' : 'md:min-h-[100px] md:h-24 p-2'
                  }`}
                >
                  {/* Day Number badge & category indicators */}
                  <div className="w-full flex justify-between items-start">
                    <div className={`text-sm md:text-[15px] font-black font-sans flex items-center justify-center rounded-full transition-all duration-300 ${
                      isTodayCell
                        ? 'bg-[#123524] text-white w-7 h-7 shadow-sm scale-105'
                        : isCurrentMonth ? 'text-[#123524]' : 'text-stone-300'
                    }`}>
                      {day}
                    </div>
                    
                    {isMobile && hasEvents && (
                      <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${
                        filteredDayEvents.some(e => e.category === 'priority') ? 'bg-[#FFBC00]' : 'bg-[#123524]'
                      }`} />
                    )}
                  </div>

                  {/* Event indicators capsules (Desktop only) */}
                  {!isMobile && isCurrentMonth && hasEvents && (
                    <div className="w-full flex flex-col gap-1 mt-1 overflow-hidden pointer-events-none">
                      {filteredDayEvents.slice(0, 2).map((evt) => (
                        <div
                          key={evt.id}
                          className={`text-[9px] px-1.5 py-0.5 rounded font-sans truncate font-bold text-left w-full border transition-all duration-300 group-hover:scale-[1.02] ${
                            evt.category === 'priority'
                              ? 'bg-[#FFBC00]/15 text-[#8F6A00] border-[#FFBC00]/30'
                              : 'bg-[#123524]/10 text-[#123524] border-[#123524]/20'
                          }`}
                          title={evt.title}
                        >
                          {evt.title}
                        </div>
                      ))}
                      {filteredDayEvents.length > 2 && (
                        <div className="text-[8px] font-mono font-black text-stone-400 text-left pl-1">
                          +{filteredDayEvents.length - 2} more
                        </div>
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
          <div className="border-b-2 border-zinc-200 pb-2.5 mb-3 flex items-center gap-2">
            <h4 className="font-sans font-black text-sm uppercase tracking-wider text-[#123524] flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#FFBC00] animate-pulse" />
              Agenda for: {new Date(selectedDateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </h4>
          </div>
          {renderEventList(filteredSelectedEvents)}
        </div>
      )}

      {/* 3. SELECTED DAY PANEL (MOBILE MODAL PORTAL SHEET) */}
      {isMobile && showMobileModal && createPortal(
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
        </div>,
        document.body
      )}

      {/* 4. MOUSE HOVER PREVIEW TOOLTIP */}
      {hoveredDate && hoveredPosition && eventsMap.get(hoveredDate) && (
        createPortal(
          <div
            className="fixed z-[9999] pointer-events-none transition-all duration-200"
            style={{
              left: `${hoveredPosition.x}px`,
              top: `${hoveredPosition.y - 12}px`,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <div className="bg-[#FAF7EA] w-64 rounded-2xl shadow-xl border border-stone-200/60 overflow-hidden flex flex-col text-left animate-fade-in">
              {(() => {
                const cellEvents = eventsMap.get(hoveredDate) || [];
                const firstEvent = cellEvents[0];
                if (!firstEvent) return null;

                return (
                  <>
                    {firstEvent.banner_url ? (
                      <div className="w-full h-24 relative overflow-hidden bg-black shrink-0">
                        <img src={firstEvent.banner_url} alt="" className="w-full h-full object-cover" />
                        <span className={`absolute top-2 right-2 text-[8px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          firstEvent.category === 'priority' ? 'bg-[#FFBC00] text-[#123524]' : 'bg-[#123524] text-white'
                        }`}>
                          {firstEvent.category}
                        </span>
                      </div>
                    ) : (
                      <div className={`w-full h-3 shrink-0 ${firstEvent.category === 'priority' ? 'bg-[#FFBC00]' : 'bg-[#123524]'}`} />
                    )}
                    
                    <div className="p-3.5 space-y-2.5 font-sans">
                      <span className="flex items-center flex-wrap gap-2 text-[9px] font-mono uppercase tracking-wider text-stone-500 font-bold">
                        <Clock size={10} className="text-[#123524] shrink-0" /> {firstEvent.event_time || 'TBA'}
                        {firstEvent.location && (
                          <>
                            <span className="opacity-40">•</span>
                            <MapPin size={10} className="text-[#123524] shrink-0" /> {firstEvent.location}
                          </>
                        )}
                      </span>
                      <h5 className="font-bold text-xs text-[#123524] leading-snug line-clamp-2">
                        {firstEvent.title}
                      </h5>
                      {firstEvent.description && (
                        <p className="text-[10px] text-[#5E6E64] line-clamp-2 leading-relaxed mt-0.5 font-medium">
                          {firstEvent.description}
                        </p>
                      )}
                      {cellEvents.length > 1 && (
                        <div className="pt-2 mt-2 border-t border-stone-200/50 flex items-center justify-between text-[8px] font-mono font-bold text-stone-400 uppercase tracking-wider">
                          <span>Active Directives</span>
                          <span className="bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded">+{cellEvents.length - 1} More</span>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
            {/* Tooltip arrow */}
            <div className="w-3 h-3 bg-[#FAF7EA] border-r border-b border-stone-200/60 rotate-45 mx-auto -mt-1.5 shadow-sm" />
          </div>,
          document.body
        )
      )}

    </div>
  );
}
