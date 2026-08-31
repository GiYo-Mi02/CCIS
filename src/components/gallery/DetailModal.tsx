import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Edit, Trash2 } from 'lucide-react';
import { GalleryItem } from '../../types/gallery';
import OptimizedImage from '../OptimizedImage';

interface DetailModalProps {
  item: GalleryItem;
  onClose: () => void;
  onEdit: (item: GalleryItem) => void;
  onConfirmDelete: (itemId: string) => void;
  isAdmin: boolean;
  prefersReducedMotion: boolean;
}

export default function DetailModal({
  item,
  onClose,
  onEdit,
  onConfirmDelete,
  isAdmin,
  prefersReducedMotion
}: DetailModalProps) {
  const [featuredImage, setFeaturedImage] = useState<string>(item.imageUrl);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // Combine main image + thumbnails
  const allImages = [item.imageUrl, ...item.thumbnails];

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 w-screen h-screen" id="gallery-detail-modal">
      <button type="button" aria-label="Close detail modal" className="absolute inset-0" onClick={onClose} />
      <div 
        className={`relative z-10 bg-[#FAF7EA] w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl border border-stone-200/50 flex flex-col md:flex-row max-h-[92vh] md:max-h-[85vh] ${
          prefersReducedMotion ? '' : 'transition-transform scale-95 animate-modal-zoom'
        }`}
      >
        
        {/* Close Button overlay */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 bg-[#FAF7EA] hover:bg-stone-100 border border-stone-200/50 text-stone-700 rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-[#1A3C2E] transition-colors cursor-pointer"
          aria-label="Close detail modal"
        >
          <X size={16} />
        </button>

        {/* LEFT COLUMN: Metadata & Description */}
        <div className="w-full md:w-[45%] p-6 sm:p-8 md:p-10 flex flex-col justify-between overflow-y-auto max-h-[45vh] md:max-h-full border-b md:border-b-0 md:border-r border-stone-200/60">
          <div className="space-y-4 text-left">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest uppercase font-black bg-[#1A3C2E]/10 text-[#1A3C2E] border border-[#1A3C2E]/20 px-3.5 py-1.5 rounded-full">
                {item.category}
              </span>
              <span className="text-[10px] text-stone-400 font-mono">
                {new Date(item.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>

            <h3 className="font-marcellus font-black text-xl sm:text-2xl md:text-3xl text-stone-900 tracking-tight leading-snug">
              {item.title}
            </h3>

            <p className="text-stone-600 text-sm md:text-[15px] leading-relaxed whitespace-pre-line font-sans font-medium mt-4">
              {item.description}
            </p>
          </div>

          <div className="pt-6 mt-6 border-t border-stone-200/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left">
            <div>
              <span className="block text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                Posted By
              </span>
              <span className="font-sans font-bold text-[#1A3C2E] text-xs sm:text-sm">
                {item.postedBy}
              </span>
            </div>

            {/* Admin actions inside the detail view */}
            {isAdmin ? (
              <div className="flex items-center gap-2">
                {deleteConfirmId === item.id ? (
                  <div className="bg-white rounded-xl shadow-md border border-stone-200 p-2 flex items-center gap-1.5">
                    <span className="text-[9px] font-bold font-mono">Delete?</span>
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
                      className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-[#1A3C2E] font-bold text-[9px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => onEdit(item)}
                      className="px-3.5 py-2 bg-white border border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#1A3C2E] cursor-pointer"
                    >
                      <Edit size={12} className="text-[#1A3C2E]" />
                      Edit ↗
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(item.id)}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={onClose}
                className="px-5 py-2 text-[#FAF7EA] bg-[#1A3C2E] hover:bg-[#123524] text-xs font-black uppercase tracking-wider rounded-full shadow-md transition-colors cursor-pointer"
              >
                Close View
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Feature Image & Thumbnails Grid */}
        <div className="w-full md:w-[55%] p-6 sm:p-8 md:p-10 bg-stone-100/30 flex flex-col justify-center gap-4 max-h-[50vh] md:max-h-full">
          
          {/* Main Featured Image Container */}
          <div className="relative w-full flex-1 min-h-[220px] md:min-h-[380px] rounded-2xl overflow-hidden border border-stone-200/55 bg-black flex items-center justify-center shadow-inner">
            <OptimizedImage
              src={featuredImage}
              alt=""
              width={1600}
              height={1200}
              loading="eager"
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Horizontal scroll thumbnails */}
          {allImages.length > 1 && (
            <div>
              <span className="block text-[9px] uppercase tracking-wider font-bold text-stone-400 font-mono mb-2 text-left">
                Event Snaps ({allImages.length})
              </span>
              
              <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-stone-300">
                {allImages.map(imgUrl => (
                  <button
                    key={imgUrl}
                    onClick={() => setFeaturedImage(imgUrl)}
                    className={`relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-black border-2 transition-colors cursor-pointer ${
                      featuredImage === imgUrl 
                        ? 'border-[#1A3C2E] scale-95 ring-2 ring-[#1A3C2E]/20' 
                        : 'border-white/50 hover:border-[#1A3C2E]/40 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <OptimizedImage src={imgUrl} alt="" width={160} height={120} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>,
    document.body
  );
}
