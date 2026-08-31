import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Edit, Trash2, Camera, ArrowRight } from 'lucide-react';
import { GalleryItem } from '../../types/gallery';
import OptimizedImage from '../OptimizedImage';

interface HeroCarouselProps {
  items: GalleryItem[];
  onEditClick: (item: GalleryItem) => void;
  onConfirmDelete: (itemId: string) => void;
  isAdmin: boolean;
  prefersReducedMotion: boolean;
  onOpenDetail: (item: GalleryItem) => void;
}

export default function HeroCarousel({ 
  items, 
  onEditClick, 
  onConfirmDelete, 
  isAdmin,
  prefersReducedMotion,
  onOpenDetail
}: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-advance logic (10s)
  useEffect(() => {
    if (prefersReducedMotion || items.length <= 1) return;

    const startTimer = () => {
      timerRef.current = setInterval(() => {
        setActiveIndex(prev => (prev + 1) % items.length);
      }, 10000);
    };

    startTimer();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [items.length, activeIndex, prefersReducedMotion]);

  if (items.length === 0) {
    return (
      <div className="bg-[#FAF7EA] border border-stone-200/50 rounded-3xl py-12 px-6 text-center max-w-md mx-auto shadow-sm">
        <Camera className="mx-auto text-stone-400 mb-3" size={24} />
        <p className="text-xs font-bold text-stone-700">No items available in the hero. Upload items to populate.</p>
      </div>
    );
  }

  const handlePrev = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveIndex(prev => (prev - 1 + items.length) % items.length);
    setDeleteConfirmId(null);
  };

  const handleNext = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveIndex(prev => (prev + 1) % items.length);
    setDeleteConfirmId(null);
  };

  const getSlidePositionClass = (idx: number) => {
    if (idx === activeIndex) return 'scale-100 z-30 opacity-100';
    
    const prevIdx = (activeIndex - 1 + items.length) % items.length;
    const nextIdx = (activeIndex + 1) % items.length;

    if (idx === prevIdx) {
      return '-translate-x-[75%] sm:-translate-x-[60%] scale-[0.82] z-10 opacity-40 hover:opacity-60 cursor-pointer pointer-events-auto';
    }
    if (idx === nextIdx) {
      return 'translate-x-[75%] sm:translate-x-[60%] scale-[0.82] z-10 opacity-40 hover:opacity-60 cursor-pointer pointer-events-auto';
    }

    return 'scale-50 opacity-0 z-0 pointer-events-none absolute';
  };

  return (
    <div className="relative w-full max-w-6xl mx-auto h-[260px] sm:h-[400px] md:h-[460px] flex items-center justify-center">
      
      {/* Slider View Box Wrapper */}
      <div className="relative w-full h-full flex items-center justify-center overflow-visible">
        {items.map((item, idx) => {
          const isActive = idx === activeIndex;
          const posClass = getSlidePositionClass(idx);
          const isPeek = !isActive && posClass.includes('translate');
          if (!isActive && !isPeek) return null;

          return (
            <div
              key={item.id}
              onClick={() => {
                if (isPeek) {
                  if (timerRef.current) clearInterval(timerRef.current);
                  setActiveIndex(idx);
                }
              }}
              className={`absolute w-[80%] sm:w-[70%] md:w-[65%] h-[90%] rounded-3xl overflow-hidden shadow-2xl border border-[#1A3C2E]/10 bg-white transition-all duration-700 ease-out select-none ${posClass}`}
            >
              <OptimizedImage
                src={isActive ? item.imageUrl : (item.thumbnails[0] || item.imageUrl)}
                alt={item.title}
                width={1200}
                height={675}
                loading={isActive ? 'eager' : 'lazy'}
                className="w-full h-full object-cover"
                draggable={false}
              />

              {/* Foreground details overlaid on active slide */}
              {isActive && (
                <>
                  <div 
                    className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/30 flex flex-col justify-between p-4 sm:p-6 md:p-8 text-[#FAF7EA] cursor-pointer"
                    onClick={() => onOpenDetail(item)}
                  >
                    {/* Header: Category Badge */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] md:text-xs font-mono font-bold tracking-widest uppercase bg-[#1A3C2E] border border-[#FAF7EA]/20 px-3.5 py-1 rounded-full text-white">
                        {item.category}
                      </span>
                    </div>

                    {/* Bottom Content: Title + CTA */}
                    <div className="space-y-1.5 max-w-xl text-left">
                      <h2 className="font-sans font-black text-sm sm:text-lg md:text-2xl tracking-tight leading-tight line-clamp-2 text-white">
                        {item.title}
                      </h2>
                      <p className="hidden sm:line-clamp-2 text-stone-200 text-xs leading-relaxed opacity-95">
                        {item.description}
                      </p>
                      <div className="pt-1">
                        <span className="inline-flex items-center gap-1 text-[10px] md:text-xs font-black uppercase tracking-wider text-[#F5B400] hover:text-[#ffc522]">
                          View details <ArrowRight size={12} />
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Active Slide Hover admin overlay controls */}
                  {isAdmin && (
                    <div 
                      className="absolute top-4 right-4 flex items-center gap-1.5 z-25"
                      onClick={e => e.stopPropagation()} // Avoid triggering detail modal
                    >
                      {deleteConfirmId === item.id ? (
                        <div className="bg-white rounded-xl shadow-xl border border-stone-200 p-2.5 flex items-center gap-2 animate-fade-in text-stone-800">
                          <span className="text-[9px] font-bold font-mono">Remove?</span>
                          <button
                            onClick={() => {
                              onConfirmDelete(item.id);
                              setDeleteConfirmId(null);
                            }}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-colors shadow-sm cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold text-[9px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => onEditClick(item)}
                            className="p-2 bg-white hover:bg-stone-50 text-stone-800 rounded-xl shadow-md border border-stone-200 hover:scale-105 transition-all focus:outline-none focus:ring-2 focus:ring-[#1A3C2E] cursor-pointer"
                            title="Edit Carousel Slide"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setDeleteConfirmId(item.id);
                            }}
                            className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md border border-rose-500 hover:scale-105 transition-all focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                            title="Delete Carousel Slide"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation Arrows */}
      {items.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-1 sm:left-4 z-40 p-2 rounded-full bg-[#FAF7EA]/90 hover:bg-[#FAF7EA] text-[#1A3C2E] border border-stone-300 shadow-md transition-all hover:scale-115 focus:outline-none focus:ring-2 focus:ring-[#1A3C2E] cursor-pointer"
            aria-label="Previous Slide"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-1 sm:right-4 z-40 p-2 rounded-full bg-[#FAF7EA]/90 hover:bg-[#FAF7EA] text-[#1A3C2E] border border-stone-300 shadow-md transition-all hover:scale-115 focus:outline-none focus:ring-2 focus:ring-[#1A3C2E] cursor-pointer"
            aria-label="Next Slide"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      {/* Pagination Dots overlaid at bottom-center */}
      {items.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10">
          {items.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => {
                if (timerRef.current) clearInterval(timerRef.current);
                setActiveIndex(idx);
              }}
              className={`h-2 rounded-full transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-white cursor-pointer ${
                 idx === activeIndex ? 'w-4 bg-[#F5B400]' : 'w-2 bg-white/60 hover:bg-white'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}

    </div>
  );
}
