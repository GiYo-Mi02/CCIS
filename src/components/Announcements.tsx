import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Announcement } from '../types/database';
import { Search, Calendar, User, ArrowRight, Tag, X, Megaphone, Star } from 'lucide-react';

interface AnnouncementsProps {
  previewMode?: boolean;
  onViewAllClick?: () => void;
}

export default function Announcements({ previewMode = false, onViewAllClick }: AnnouncementsProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
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
        query = query.limit(3);
      }

      const { data, error } = await query;
      if (!error && data) {
        // Map data to ensure profiles field is correctly parsed
        const mapped = data.map((ann: any) => ({
          ...ann,
          profiles: Array.isArray(ann.profiles) ? ann.profiles[0] : ann.profiles
        }));
        setAnnouncements(mapped);
      }
      setLoading(false);
    };

    fetchAnnouncements();
  }, [previewMode]);

  const categories = [
    { id: 'all', label: 'All Updates' },
    { id: 'event', label: 'Events' },
    { id: 'deadline', label: 'Deadlines' },
    { id: 'result', label: 'Results' },
    { id: 'general', label: 'General' },
  ];

  // Filter logic
  const filtered = announcements.filter(ann => {
    const matchesSearch = ann.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          ann.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || ann.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'event': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'deadline': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'result': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  if (loading) {
    return (
      <div className="py-16 bg-[#FAF7EA]/30 flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-3 border-[#F5B400] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-mono text-xs text-[#5E6E64] uppercase tracking-widest">Loading announcements...</p>
      </div>
    );
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

          <div className="grid md:grid-cols-3 gap-6 font-sans">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                onClick={() => setSelectedAnn(ann)}
                className={`cursor-pointer group bg-white rounded-2xl border border-zinc-100 p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between hover:-translate-y-1 relative ${
                  ann.pinned ? 'ring-2 ring-[#F5B400]/40' : ''
                }`}
                id={`ann-card-preview-${ann.id}`}
              >
                {ann.pinned && (
                  <span className="absolute top-4 right-4 bg-[#F5B400]/10 text-[#F5B400] p-1.5 rounded-full" title="Pinned Announcement">
                    <Star size={14} fill="currentColor" />
                  </span>
                )}
                <div>
                  <span className={`inline-block text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border mb-4 ${getCategoryColor(ann.category)}`}>
                    {ann.category}
                  </span>
                  <h3 className="font-bold text-lg text-[#1A3C2E] group-hover:text-[#F5B400] line-clamp-2 transition-colors">
                    {ann.title}
                  </h3>
                  <p className="text-stone-500 text-sm mt-3 line-clamp-3 leading-relaxed">
                    {ann.content}
                  </p>
                </div>

                <div className="border-t border-zinc-50 pt-4 mt-6 flex items-center justify-between text-xs text-[#5E6E64] font-mono">
                  <span className="flex items-center gap-1">
                    <Calendar size={13} />
                    {new Date(ann.published_at || ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1">
                    <User size={13} />
                    {ann.profiles?.full_name || 'Admin'}
                  </span>
                </div>
              </div>
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
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 md:p-6 shadow-sm mb-8 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            
            {/* Search inputs */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input
                type="text"
                placeholder="Search announcements by keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1A3C2E]/20 focus:border-[#1A3C2E] text-stone-800 text-sm transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 focus:outline-none"
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
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all focus:outline-none ${
                    activeCategory === cat.id
                      ? 'bg-[#1A3C2E] text-[#FAF7EA] shadow-md shadow-[#1A3C2E]/10'
                      : 'bg-zinc-50 border border-zinc-200 text-stone-600 hover:bg-zinc-100'
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
          <div className="bg-white rounded-3xl border border-dashed border-stone-200 p-16 text-center shadow-sm">
            <Megaphone size={48} className="mx-auto text-stone-300 animate-pulse mb-4" />
            <h3 className="font-bold text-lg text-[#1A3C2E]">No announcements found</h3>
            <p className="text-stone-500 text-sm mt-1 max-w-xs mx-auto">
              We couldn't find any bulletin updates matching your search terms or filters. Try adjusting them.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((ann) => (
              <div
                key={ann.id}
                onClick={() => setSelectedAnn(ann)}
                className={`cursor-pointer bg-white rounded-2xl border border-zinc-100 p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between relative ${
                  ann.pinned ? 'ring-2 ring-[#F5B400]/40' : ''
                }`}
                id={`ann-card-full-${ann.id}`}
              >
                {ann.pinned && (
                  <span className="absolute top-4 right-4 bg-[#F5B400]/10 text-[#F5B400] p-1.5 rounded-full" title="Pinned Announcement">
                    <Star size={14} fill="currentColor" />
                  </span>
                )}
                <div>
                  <span className={`inline-block text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border mb-4 ${getCategoryColor(ann.category)}`}>
                    {ann.category}
                  </span>
                  <h2 className="font-sans font-extrabold text-xl text-[#1A3C2E] hover:text-[#F5B400] line-clamp-2 transition-colors duration-200">
                    {ann.title}
                  </h2>
                  <p className="text-stone-600 text-sm mt-3 line-clamp-4 leading-relaxed font-normal">
                    {ann.content}
                  </p>
                </div>

                <div className="border-t border-zinc-100 pt-4 mt-6 flex items-center justify-between text-xs text-[#5E6E64] font-mono">
                  <span className="flex items-center gap-1">
                    <Calendar size={13} />
                    {new Date(ann.published_at || ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1">
                    <User size={13} />
                    {ann.profiles?.full_name || 'Admin'}
                  </span>
                </div>
              </div>
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
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-white/10 animate-scale-up max-h-[90vh] flex flex-col">
        {/* Banner image if available, else decorative emerald block */}
        <div className="h-44 bg-[#1A3C2E] flex flex-col justify-end p-6 relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/20 text-white hover:bg-black/40 hover:scale-105 transition-all focus:outline-none"
          >
            <X size={18} />
          </button>
          <div className="space-y-2">
            <span className={`inline-block text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-white border-transparent text-[#1A3C2E]`}>
              {announcement.category}
            </span>
            <div className="flex items-center gap-4 text-white/75 text-xs font-mono">
              <span className="flex items-center gap-1">
                <Calendar size={13} />
                {new Date(announcement.published_at || announcement.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1">
                <User size={13} />
                {announcement.profiles?.full_name || 'Admin'}
              </span>
            </div>
          </div>
        </div>

        {/* Content body scroll sector */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 admin-scrollbar">
          <h2 className="font-sans font-black text-2xl text-[#1A3C2E] leading-snug mb-5">
            {announcement.title}
          </h2>
          <p className="text-stone-700 text-sm md:text-base leading-relaxed whitespace-pre-wrap font-normal">
            {announcement.content}
          </p>
        </div>

        {/* Footer actions */}
        <div className="border-t border-zinc-100 px-6 py-4 bg-zinc-50 flex items-center justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-bold bg-[#1A3C2E] text-[#FAF7EA] hover:bg-[#1A3C2E]/90 focus:outline-none focus:ring-2 focus:ring-[#1A3C2E]/20 transition-all shadow-sm"
          >
            Close Announcement
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
