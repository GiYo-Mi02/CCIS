import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Announcement } from '../types/database';
import { Search, Calendar, User, ArrowRight, Tag, X, Megaphone, Star } from 'lucide-react';
import { AnnouncementsSkeleton } from './common/Skeleton';

interface AnnouncementsProps {
  previewMode?: boolean;
  onViewAllClick?: () => void;
}

const categories = [
  { id: 'all', label: 'All Updates' },
  { id: 'event', label: 'Events' },
  { id: 'deadline', label: 'Deadlines' },
  { id: 'result', label: 'Results' },
  { id: 'general', label: 'General' },
];

function getCategoryColor(cat: string) {
  switch (cat) {
    case 'event': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'deadline': return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'result': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    default: return 'bg-blue-100 text-blue-800 border-blue-200';
  }
}

export default function Announcements({ previewMode = false, onViewAllClick }: AnnouncementsProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;

    const fetchAnnouncements = async () => {
      setLoading(true);
      // Query published announcements
      let query = supabase
        .from('announcements')
        .select('*, profiles(full_name)')
        .eq('status', 'published')
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false });

      if (previewMode) {
        query = query.eq('pinned', true).limit(3);
      }

      try {
        const { data, error } = await query;
        if (cancelled) return;

        if (!error && data) {
          // Map data to ensure profiles field is correctly parsed
          const mapped = data.map((ann: any) => ({
            ...ann,
            profiles: Array.isArray(ann.profiles) ? ann.profiles[0] : ann.profiles
          }));
          setAnnouncements(mapped);
        }
      } finally {
        setLoading((current) => cancelled ? current : false);
      }
    };

    fetchAnnouncements();
    return () => {
      cancelled = true;
    };
  }, [previewMode]);

  // Filter logic
  const filtered = announcements.filter(ann => {
    const matchesSearch = ann.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          ann.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || ann.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return <AnnouncementsSkeleton previewMode={previewMode} />;
  }

  // --- PREVIEW MODE LAYOUT ---
  if (previewMode) {
    if (announcements.length === 0) return null;

    return (
      <section className="py-16 bg-[#FAF7EA]/50 border-b border-[#1A3C2E]/10" id="announcements-preview">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
            <div>
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#5E6E64] font-bold">Official Bulletin</span>
              <h2 className="font-sans font-black text-3xl text-[#1A3C2E] mt-1">Latest Announcements</h2>
              <div className="h-1 w-16 bg-[#F5B400] mt-3 rounded-full" />
            </div>
            {onViewAllClick && (
              <button
                onClick={onViewAllClick}
                className="mt-4 md:mt-0 inline-flex items-center gap-2 font-sans font-bold text-sm text-[#1A3C2E] hover:text-[#F5B400] transition-colors focus:outline-none"
              >
                View Bulletin Board <ArrowRight size={16} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto font-sans">
            {announcements.map((ann) => (
              <button
                type="button"
                key={ann.id}
                onClick={() => setSelectedAnn(ann)}
                className={`w-full text-left cursor-pointer bg-white rounded-3xl border border-zinc-150 shadow-sm hover:shadow-lg transition-[background-color,border-color,color,box-shadow] duration-300 flex flex-col md:flex-row overflow-hidden group min-h-[220px] ${
                  ann.pinned ? 'ring-2 ring-[#F5B400]/40' : ''
                }`}
                id={`ann-card-preview-${ann.id}`}
              >
                {/* Left Side: Photo / Graphic */}
                <div className="w-full md:w-2/5 min-h-[200px] md:min-h-full relative overflow-hidden flex-shrink-0 bg-stone-50 border-b md:border-b-0 md:border-r border-zinc-100">
                  {ann.banner_url ? (
                    <img 
                      src={ann.banner_url} 
                      alt={ann.title} 
                      width={960}
                      height={540}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    />
                  ) : (
                    // CCIS branded gradient placeholder graphic
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1A3C2E] to-[#255541] flex flex-col items-center justify-center p-6 text-center select-none">
                      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#FAF7EA_1px,transparent_1px)] [background-size:16px_16px]" />
                      <div className="w-14 h-14 rounded-full border border-white/20 bg-white/5 flex items-center justify-center mb-3 shadow-lg backdrop-blur-xs">
                        <img 
                          src="/images/ccis_logo.jpg" 
                          alt="CCIS Logo" 
                          className="w-10 h-10 rounded-full object-cover opacity-80" 
                        />
                      </div>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-[#F5B400]">
                        CCIS Student Council
                      </span>
                      <Megaphone size={14} className="text-[#FAF7EA]/20 mt-2" />
                    </div>
                  )}
                  {ann.pinned && (
                    <span className="absolute top-4 left-4 bg-[#F5B400] text-[#1A3C2E] px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md z-10">
                      <Star size={10} fill="currentColor" />
                      Pinned
                    </span>
                  )}
                </div>

                {/* Right Side: Details & Content */}
                <div className="w-full md:w-3/5 p-6 md:p-7 flex flex-col justify-between">
                  {/* Header: User & Meta */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8.5 h-8.5 rounded-full bg-gradient-to-tr from-[#1A3C2E] to-[#F5B400] p-0.5 shadow-xs">
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-xs font-black text-[#1A3C2E]">
                        {ann.profiles?.full_name ? ann.profiles.full_name.charAt(0).toUpperCase() : 'A'}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-[#1A3C2E] leading-tight">
                        {ann.profiles?.full_name || 'CCIS Administrator'}
                      </h4>
                      <p className="text-[10px] text-stone-400 font-mono mt-0.5">
                        {new Date(ann.published_at || ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    
                    <span className={`ml-auto text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getCategoryColor(ann.category)}`}>
                      {ann.category}
                    </span>
                  </div>

                  {/* Body: Title & Content */}
                  <div className="flex-1 flex flex-col justify-start">
                    <h3 className="font-sans font-black text-base md:text-lg text-[#1A3C2E] group-hover:text-[#F5B400] transition-colors line-clamp-2 leading-snug">
                      {ann.title}
                    </h3>
                    <p className="text-stone-500 text-xs mt-2 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                      {ann.content}
                    </p>
                  </div>

                  {/* Footer Action */}
                  <div className="border-t border-zinc-50 pt-3 mt-4 flex items-center justify-between text-xs text-[#5E6E64] font-semibold">
                    <span className="text-[#1A3C2E] group-hover:text-[#F5B400] transition-colors flex items-center gap-1 text-[11px] font-bold">
                      Read full announcement
                    </span>
                    <ArrowRight size={14} className="transform group-hover:translate-x-1 transition-transform text-[#1A3C2E] group-hover:text-[#F5B400]" />
                  </div>
                </div>
              </button>
            ))}
          </div>

        </div>

        {/* Modal display portal */}
        {selectedAnn && (
          <AnnouncementModal announcement={selectedAnn} onClose={() => setSelectedAnn(null)} getCategoryColor={getCategoryColor} />
        )}
      </section>
    );
  }

  // --- FULL BULLETIN HUB LAYOUT ---
  return (
    <section className="py-12 md:py-16 bg-[#FAF7EA]/20 min-h-screen font-sans" id="announcements-hub">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Hub Header banner */}
        <div className="text-center mb-12">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#5E6E64] font-bold">CCIS SC Announcemet Page</span>
          <h1 className="font-black text-4xl md:text-5xl text-[#1A3C2E] tracking-tight mt-2">Bulletin Board</h1>
          <p className="text-stone-600 max-w-xl mx-auto mt-4 text-sm md:text-base">
            Keep track of official news, academic deadlines, council innovation challenge updates, sportsfest volunteers, and general student advisories.
          </p>
          <div className="h-1.5 w-24 bg-[#F5B400] mx-auto mt-5 rounded-full" />
        </div>

        {/* Search & Category Filter Sector */}
        <div className="bg-white rounded-2xl border border-[#1A3C2E]/25 p-5 md:p-6 shadow-xs mb-8 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            
            {/* Search inputs */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input
                type="text"
                aria-label="Search announcements"
                placeholder="Search announcements by keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#1A3C2E]/30 focus:outline-none focus:ring-2 focus:ring-[#1A3C2E]/20 focus:border-[#1A3C2E] text-stone-800 text-sm transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear announcement search"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 focus:outline-none cursor-pointer"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Filter tags list */}
            <div className="flex flex-wrap items-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors focus:outline-none cursor-pointer border ${
                    activeCategory === cat.id
                      ? 'bg-[#1A3C2E] text-[#FAF7EA] border-[#1A3C2E] shadow-sm'
                      : 'bg-zinc-50 border-[#1A3C2E]/20 text-stone-600 hover:bg-zinc-100 hover:text-[#1A3C2E]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

          </div>
        </div>

        {/* Announcements list grid */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#1A3C2E]/25 p-16 text-center shadow-xs">
            <Megaphone size={48} className="mx-auto text-stone-300 animate-pulse mb-4" />
            <h3 className="font-bold text-lg text-[#1A3C2E]">No announcements found</h3>
            <p className="text-stone-500 text-sm mt-1 max-w-xs mx-auto">
              We couldn't find any bulletin updates matching your search terms or filters. Try adjusting them.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto font-sans">
            {filtered.map((ann) => (
              <button
                type="button"
                key={ann.id}
                onClick={() => setSelectedAnn(ann)}
                className={`w-full text-left cursor-pointer bg-white rounded-3xl border border-[#1A3C2E]/25 shadow-xs hover:shadow-lg hover:border-[#1A3C2E]/50 transition-[background-color,border-color,color,box-shadow] duration-300 flex flex-col md:flex-row overflow-hidden group min-h-[220px] ${
                  ann.pinned ? 'ring-2 ring-[#F5B400]/40' : ''
                }`}
                id={`ann-card-full-${ann.id}`}
              >
                {/* Left Side: Photo / Graphic */}
                <div className="w-full md:w-2/5 min-h-[200px] md:min-h-full relative overflow-hidden flex-shrink-0 bg-stone-50 border-b md:border-b-0 md:border-r border-zinc-100">
                  {ann.banner_url ? (
                    <img 
                      src={ann.banner_url} 
                      alt={ann.title} 
                      width={960}
                      height={540}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    />
                  ) : (
                    // CCIS branded gradient placeholder graphic
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1A3C2E] to-[#255541] flex flex-col items-center justify-center p-6 text-center select-none">
                      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#FAF7EA_1px,transparent_1px)] [background-size:16px_16px]" />
                      <div className="w-14 h-14 rounded-full border border-white/20 bg-white/5 flex items-center justify-center mb-3 shadow-lg backdrop-blur-xs">
                        <img 
                          src="/images/ccis_logo.jpg" 
                          alt="CCIS Logo" 
                          className="w-10 h-10 rounded-full object-cover opacity-80" 
                        />
                      </div>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-[#F5B400]">
                        CCIS Student Council
                      </span>
                      <Megaphone size={14} className="text-[#FAF7EA]/20 mt-2" />
                    </div>
                  )}
                  {ann.pinned && (
                    <span className="absolute top-4 left-4 bg-[#F5B400] text-[#1A3C2E] px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md z-10">
                      <Star size={10} fill="currentColor" />
                      Pinned
                    </span>
                  )}
                </div>

                {/* Right Side: Details & Content */}
                <div className="w-full md:w-3/5 p-6 md:p-8 flex flex-col justify-between">
                  {/* Header: User & Meta */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#1A3C2E] to-[#F5B400] p-0.5 shadow-xs">
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-xs font-black text-[#1A3C2E]">
                        {ann.profiles?.full_name ? ann.profiles.full_name.charAt(0).toUpperCase() : 'A'}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-[#1A3C2E] leading-tight">
                        {ann.profiles?.full_name || 'CCIS Administrator'}
                      </h4>
                      <p className="text-[10px] text-stone-400 font-mono mt-0.5">
                        {new Date(ann.published_at || ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    
                    <span className={`ml-auto text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getCategoryColor(ann.category)}`}>
                      {ann.category}
                    </span>
                  </div>

                  {/* Body: Title & Content */}
                  <div className="flex-1 flex flex-col justify-start">
                    <h3 className="font-sans font-black text-lg text-[#1A3C2E] group-hover:text-[#F5B400] transition-colors line-clamp-2 leading-snug">
                      {ann.title}
                    </h3>
                    <p className="text-stone-600 text-xs mt-2 line-clamp-3 md:line-clamp-4 leading-relaxed whitespace-pre-wrap font-normal">
                      {ann.content}
                    </p>
                  </div>

                  {/* Footer Action */}
                  <div className="border-t border-zinc-100 pt-3 mt-4 flex items-center justify-between text-xs text-[#5E6E64] font-semibold">
                    <span className="text-[#1A3C2E] group-hover:text-[#F5B400] transition-colors flex items-center gap-1 text-[11px] font-bold">
                      Read full announcement
                    </span>
                    <ArrowRight size={14} className="transform group-hover:translate-x-1 transition-transform text-[#1A3C2E] group-hover:text-[#F5B400]" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

      </div>

      {/* Modal display portal */}
      {selectedAnn && (
        <AnnouncementModal announcement={selectedAnn} onClose={() => setSelectedAnn(null)} getCategoryColor={getCategoryColor} />
      )}
    </section>
  );
}

// Separate component for the Modal display
interface ModalProps {
  announcement: Announcement;
  onClose: () => void;
  getCategoryColor: (cat: string) => string;
}

function AnnouncementModal({ announcement, onClose, getCategoryColor }: ModalProps) {
  useEffect(() => {
    // Disable background scrolling when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
      {/* Click backdrop to close */}
      <button type="button" aria-label="Close announcement" className="absolute inset-0" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-zinc-150 animate-scale-up max-h-[90vh] flex flex-col md:flex-row overflow-y-auto md:overflow-y-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close announcement"
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/10 text-stone-600 md:bg-white/10 md:text-white hover:bg-black/20 md:hover:bg-white/20 hover:scale-105 transition-[background-color,transform] focus:outline-none"
        >
          <X size={18} />
        </button>

        {/* Left Side: Photo / Graphic */}
        <div className="w-full md:w-1/2 min-h-[250px] md:min-h-full bg-stone-900 flex-shrink-0 relative overflow-hidden flex items-center justify-center">
          {announcement.banner_url ? (
            <img 
              src={announcement.banner_url} 
              alt={announcement.title} 
              width={1920}
              height={1080}
              loading="eager"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover" 
            />
          ) : (
            // CCIS branded gradient placeholder graphic
            <div className="absolute inset-0 bg-gradient-to-br from-[#1A3C2E] to-[#255541] flex flex-col items-center justify-center p-8 text-center select-none">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#FAF7EA_1px,transparent_1px)] [background-size:16px_16px]" />
              <div className="w-20 h-20 rounded-full border border-white/20 bg-white/5 flex items-center justify-center mb-4 shadow-xl backdrop-blur-xs">
                <img 
                  src="/images/ccis_logo.jpg" 
                  alt="CCIS Logo" 
                  className="w-16 h-16 rounded-full object-cover" 
                />
              </div>
              <span className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-[#F5B400]">
                CCIS Student Council
              </span>
              <Megaphone size={18} className="text-[#FAF7EA]/20 mt-3" />
            </div>
          )}
          {announcement.pinned && (
            <span className="absolute top-4 left-4 bg-[#F5B400] text-[#1A3C2E] px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md z-10">
              <Star size={10} fill="currentColor" />
              Pinned
            </span>
          )}
        </div>

        {/* Right Side: Details & Content */}
        <div className="w-full md:w-1/2 flex flex-col justify-between max-h-[90vh]">
          {/* Header Area */}
          <div className="p-6 border-b border-zinc-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#1A3C2E] to-[#F5B400] p-0.5 shadow-sm">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-sm font-black text-[#1A3C2E]">
                {announcement.profiles?.full_name ? announcement.profiles.full_name.charAt(0).toUpperCase() : 'A'}
              </div>
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-[#1A3C2E] leading-tight">
                {announcement.profiles?.full_name || 'CCIS Administrator'}
              </h4>
              <p className="text-[10px] text-stone-400 font-mono mt-0.5 flex items-center gap-1.5">
                <span>{new Date(announcement.published_at || announcement.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </p>
            </div>
            <span className={`ml-auto text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getCategoryColor(announcement.category)}`}>
              {announcement.category}
            </span>
          </div>

          {/* Scrollable Description/Caption */}
          <div className="p-6 md:p-8 overflow-y-auto flex-1 admin-scrollbar space-y-4 max-h-[calc(90vh-140px)]">
            <h2 className="font-sans font-black text-xl md:text-2xl text-[#1A3C2E] leading-snug">
              {announcement.title}
            </h2>
            <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-wrap font-normal">
              {announcement.content}
            </p>
          </div>

          {/* Footer Controls */}
          <div className="border-t border-zinc-100 px-6 py-4 bg-zinc-50 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#1A3C2E] text-white hover:bg-[#255541] transition-colors shadow-sm cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
