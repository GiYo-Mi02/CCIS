import React, { useState, useEffect } from 'react';
import { Camera, Edit, Trash2, Plus, X, Maximize2, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  deleteManagedOptimizedImageByUrl,
  getManagedImagePathsFromUrl,
} from '../lib/media';

// Types & Sub-components
import { GalleryItem, GalleryCategory, Toast } from '../types/gallery';
import HeroCarousel from '../components/gallery/HeroCarousel';
import DetailModal from '../components/gallery/DetailModal';
import AdminForm from '../components/gallery/AdminForm';
import OptimizedImage from '../components/OptimizedImage';

interface GalleryPageProps {
  isAdmin?: boolean;
}

export default function GalleryPage({ isAdmin = false }: GalleryPageProps) {
  const { user } = useAuth();

  // App states
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<GalleryCategory>('All');
  const [detailItem, setDetailItem] = useState<GalleryItem | null>(null);
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  
  // Custom Toasts State
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Sync custom order from local storage
  useEffect(() => {
    const key = `ccis-gallery-order-${user?.id || 'guest'}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setCustomOrder(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse stored gallery order:', e);
      }
    } else {
      setCustomOrder([]);
    }
  }, [user?.id]);

  // Admin controls
  const [showAdminForm, setShowAdminForm] = useState<boolean>(false);
  const [editTargetItem, setEditTargetItem] = useState<GalleryItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Accessibility / Reduced Motion hook
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);

  // Responsive masonry columns hook
  const useColumnsCount = () => {
    const [cols, setCols] = useState(4);
    useEffect(() => {
      const handleResize = () => {
        if (window.innerWidth < 640) setCols(1);
        else if (window.innerWidth < 768) setCols(2);
        else if (window.innerWidth < 1024) setCols(3);
        else setCols(4);
      };
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);
    return cols;
  };

  const colsCount = useColumnsCount();

  // Check reduced motion match
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // Toast notifier helper
  const triggerToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Fetch live table rows on mount
  useEffect(() => {
    const fetchGallery = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('gallery_items')
          .select('id, title, description, category, posted_by, image_url, thumbnails, aspect_ratio, featured, created_at')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        if (data && data.length > 0) {
          const mapped: GalleryItem[] = data.map(item => ({
            id: item.id,
            title: item.title,
            description: item.description || '',
            category: item.category as Exclude<GalleryCategory, 'All'>,
            postedBy: item.posted_by || 'Anonymous',
            imageUrl: item.image_url,
            thumbnails: item.thumbnails || [],
            aspectRatio: (item.aspect_ratio || 'landscape') as 'portrait' | 'landscape' | 'square',
            featured: item.featured || false,
            createdAt: item.created_at
          }));
          setItems(mapped);
        } else {
          setItems([]);
        }
      } catch (err: any) {
        console.error('Error fetching gallery items:', err);
        triggerToast('Failed to load live gallery items.', 'error');
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchGallery();
  }, []);

  const getStoragePathFromUrl = (url: string): string | null => {
    try {
      const parts = url.split('gallery-images/');
      if (parts.length >= 2) return parts.slice(1).join('gallery-images/');
      return null;
    } catch {
      return null;
    }
  };

  // Sort items according to local storage custom order
  const getSortedItems = (itemsList: GalleryItem[]): GalleryItem[] => {
    if (!customOrder || customOrder.length === 0) return itemsList;
    
    const orderedItems: GalleryItem[] = [];
    const newItems: GalleryItem[] = [];
    const itemMap = new Map(itemsList.map(item => [item.id, item]));
    
    customOrder.forEach(id => {
      const item = itemMap.get(id);
      if (item) {
        orderedItems.push(item);
        itemMap.delete(id);
      }
    });
    
    itemMap.forEach(item => {
      newItems.push(item);
    });
    
    newItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return [...newItems, ...orderedItems];
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItemId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItemId || draggedItemId === targetId) return;

    const sorted = getSortedItems(items);
    const draggedIdx = sorted.findIndex(item => item.id === draggedItemId);
    const targetIdx = sorted.findIndex(item => item.id === targetId);

    if (draggedIdx === -1 || targetIdx === -1) return;

    const updated = [...sorted];
    const [draggedItem] = updated.splice(draggedIdx, 1);
    updated.splice(targetIdx, 0, draggedItem);

    const newOrder = updated.map(item => item.id);
    setCustomOrder(newOrder);

    const key = `ccis-gallery-order-${user?.id || 'guest'}`;
    localStorage.setItem(key, JSON.stringify(newOrder));
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
  };

  // Execute storage and DB deletion
  const handleConfirmDelete = async (itemId: string) => {
    try {
      const itemToDelete = items.find(i => i.id === itemId);
      if (!itemToDelete) return;

      const { error: dbError } = await supabase
        .from('gallery_items')
        .delete()
        .eq('id', itemId);

      if (dbError) throw dbError;

      const mediaUrls = [itemToDelete.imageUrl, ...itemToDelete.thumbnails];
      await Promise.allSettled(mediaUrls
        .filter(url => getManagedImagePathsFromUrl(url, 'gallery-images') !== null)
        .map(url => deleteManagedOptimizedImageByUrl(url, 'gallery-images')));

      const legacyStoragePaths = mediaUrls
        .filter(url => getManagedImagePathsFromUrl(url, 'gallery-images') === null)
        .map(url => getStoragePathFromUrl(url))
        .filter((path): path is string => path !== null);
      if (legacyStoragePaths.length > 0) {
        const { error: storageError } = await supabase.storage.from('gallery-images').remove(legacyStoragePaths);
        if (storageError) console.error('Failed to clean legacy gallery paths:', storageError);
      }

      // Optimistic state updates
      setItems(prev => prev.filter(i => i.id !== itemId));
      
      if (detailItem && detailItem.id === itemId) {
        setDetailItem(null);
      }

      triggerToast('Gallery item and assets deleted successfully.', 'success');
    } catch (err: any) {
      console.error('Error deleting item:', err);
      triggerToast(err.message || 'Failed to delete item.', 'error');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  // Callback on upload form submit success
  const handleFormSuccess = (updatedItem: GalleryItem, isEditing: boolean) => {
    if (isEditing) {
      setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
      if (detailItem && detailItem.id === updatedItem.id) {
        setDetailItem(updatedItem);
      }
    } else {
      setItems(prev => [updatedItem, ...prev]);
    }
    setEditTargetItem(null);
    setShowAdminForm(false);
  };

  const getDerivedIndexLabel = (item: GalleryItem, filteredList: GalleryItem[]): string => {
    const idx = filteredList.findIndex(i => i.id === item.id);
    if (idx === -1) return '001';
    return String(idx + 1).padStart(3, '0');
  };

  // Filter items
  const filteredItems = getSortedItems(items).filter(item => {
    if (selectedCategory === 'All') return true;
    return item.category === selectedCategory;
  });
  const visibleItems = filteredItems.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(24);
  }, [selectedCategory]);

  // Masonry layout packing columns
  const columns: GalleryItem[][] = Array.from({ length: colsCount }, () => []);
  visibleItems.forEach((item, index) => {
    columns[index % colsCount].push(item);
  });

  return (
    <div className="bg-[#FAF7EA] min-h-screen font-sans antialiased text-[#1A3C2E]">
      
      {/* ADMIN CONTROL BAR (Gated via real isAdmin prop) */}
      {isAdmin && (
        <div className="bg-[#123524] border-b-2 border-[#F5B400]/30 py-3 px-4 sm:px-6 sticky top-[66px] z-40 text-stone-200 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-[#F5B400] animate-pulse" />
            <span className="font-sans font-black text-xs uppercase tracking-wider text-[#FAF7EA]">
              CCIS Gallery Administration Panel
            </span>
          </div>
          <div>
            <button
              onClick={() => {
                setShowAdminForm(!showAdminForm);
                setEditTargetItem(null);
              }}
              className="px-4 py-1.5 text-xs font-black uppercase tracking-wider text-[#1A3C2E] bg-[#FAF7EA] border border-white hover:bg-stone-100 rounded-full flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              {showAdminForm ? <X size={12} /> : <Plus size={12} />}
              {showAdminForm ? 'Close Form' : 'Upload Event Media'}
            </button>
          </div>
        </div>
      )}

      {/* TOASTS PORTAL container */}
      <div className="fixed top-28 right-4 z-[99] flex flex-col gap-2 max-w-sm w-full pointer-events-none" id="gallery-toast-container">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`p-4 rounded-2xl shadow-2xl flex items-start gap-3 pointer-events-auto border animate-toast-in text-[#FAF7EA] ${
              t.type === 'success' 
                ? 'bg-emerald-800 border-emerald-700' 
                : t.type === 'error' 
                  ? 'bg-rose-800 border-rose-700' 
                  : t.type === 'info'
                    ? 'bg-[#1A3C2E] border-[#FAF7EA]/20'
                    : 'bg-amber-800 border-amber-700'
            }`}
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="shrink-0 mt-0.5 text-[#F5B400]" size={16} />
            ) : t.type === 'error' ? (
              <AlertTriangle className="shrink-0 mt-0.5 text-rose-300" size={16} />
            ) : (
              <Info className="shrink-0 mt-0.5 text-[#F5B400]" size={16} />
            )}
            <div className="flex-1">
              <p className="text-xs font-black font-sans uppercase tracking-wide text-white">
                {t.type === 'success' ? 'Success' : t.type === 'error' ? 'Action Failed' : t.type === 'info' ? 'Info' : 'Notice'}
              </p>
              <p className="text-[11px] font-sans text-stone-200 leading-relaxed mt-0.5">{t.message}</p>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
              className="text-[#FAF7EA] hover:opacity-75 focus:outline-none"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* ADMIN PANEL UPLOAD / EDIT FORM (Gated to real admins) */}
      {isAdmin && showAdminForm && (
        <AdminForm 
          itemToEdit={editTargetItem}
          onSuccess={handleFormSuccess}
          onClose={() => {
            setShowAdminForm(false);
            setEditTargetItem(null);
          }}
          triggerToast={triggerToast}
        />
      )}

      {/* HERO CAROUSEL */}
      <section className="pt-8 pb-16 px-4 md:px-8 max-w-7xl mx-auto overflow-hidden">
        
        <div className="text-center mb-10 space-y-2">
          <span className="font-sans font-bold text-xs uppercase tracking-widest text-[#1A3C2E] bg-white border border-[#1A3C2E]/10 px-3.5 py-1 rounded-full shadow-sm inline-block">
            2026 Edition ↗
          </span>
          <h1 className="font-sans font-black text-4xl sm:text-5xl text-[#1A3C2E] tracking-tight">
            Explore Our Gallery
          </h1>
          <p className="text-[#5E6E64] text-xs sm:text-sm max-w-lg mx-auto">
            Take a visual tour through recent hackathons, seminars, student achievements, and college activities.
          </p>
        </div>

        <HeroCarousel 
          items={items.filter(item => item.featured)}
          onEditClick={(item) => {
            setEditTargetItem(item);
            setShowAdminForm(true);
          }}
          onConfirmDelete={handleConfirmDelete}
          isAdmin={isAdmin}
          prefersReducedMotion={prefersReducedMotion}
          onOpenDetail={setDetailItem}
        />
      </section>

      {/* MASONRY GRID GALLERY */}
      <section className="py-16 bg-[#FAF7EA]/50 border-t border-[#1A3C2E]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-4">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#1A3C2E] font-bold">
              Our Gallery ↗
            </span>
            <h2 className="font-sans font-black text-3xl sm:text-4xl text-[#1A3C2E] tracking-tight">
              Explore the Gallery and See the Future Unfold
            </h2>
            <p className="text-[#5E6E64] text-sm leading-relaxed">
              Every snap records student growth, engineering milestones, and dedicated department operations. Filter by event committee to explore specific domains.
            </p>
            <button
              onClick={() => {
                const el = document.getElementById('masonry-grid-focus');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 bg-[#1A3C2E] hover:bg-[#123524] text-[#FAF7EA] px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest shadow-md transition-colors cursor-pointer"
            >
              Explore the Gallery
            </button>
          </div>

          {/* Filtering Tab-Bar */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10" id="masonry-grid-focus">
            {(['All', 'Student Achievements', 'Student Council', 'Computer Society', 'CCIS Department'] as GalleryCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 text-xs font-bold rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[#1A3C2E]/40 focus:ring-offset-1 border ${
                  selectedCategory === cat
                    ? 'bg-[#1A3C2E] text-[#FAF7EA] border-[#1A3C2E] shadow-sm'
                    : 'bg-white text-[#5E6E64] border-stone-200/80 hover:bg-stone-50 hover:text-[#1A3C2E] cursor-pointer'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Skeletons/Grid Loader */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div 
                  key={i} 
                  className={`bg-white border border-stone-200 rounded-2xl p-3 space-y-4 animate-pulse ${
                    i % 3 === 0 ? 'h-[360px]' : i % 3 === 1 ? 'h-[280px]' : 'h-[320px]'
                  }`}
                >
                  <div className="w-full h-3/4 bg-stone-100 rounded-xl" />
                  <div className="h-4 bg-stone-100 rounded w-2/3" />
                  <div className="h-3 bg-stone-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            
            <div className="text-center py-16 bg-white border border-stone-200 rounded-3xl p-8 max-w-md mx-auto shadow-sm">
              <div className="w-12 h-12 bg-stone-50 text-stone-400 border border-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Camera size={20} />
              </div>
              <h4 className="font-sans font-bold text-stone-700 text-sm">No items in this category yet.</h4>
              <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
                No items have been posted for this category yet. Please check back later.
              </p>
            </div>

          ) : (

            /* Grid Layout columns flex masonry */
            <div 
              className={`grid gap-4 ${
                colsCount === 1 ? 'grid-cols-1' :
                colsCount === 2 ? 'grid-cols-2' :
                colsCount === 3 ? 'grid-cols-3' :
                'grid-cols-4'
              }`}
            >
              {columns.map((col, colIdx) => (
                <div key={colIdx} className="flex flex-col gap-4">
                  {col.map(item => {
                    return (
                      <div
                        key={item.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onDragOver={(e) => handleDragOver(e)}
                        onDrop={(e) => handleDrop(e, item.id)}
                        onDragEnd={handleDragEnd}
                        className={`group relative overflow-hidden rounded-2xl bg-white border border-[#1A3C2E]/25 shadow-xs transition-all duration-300 hover:shadow-xl hover:border-[#1A3C2E] hover:-translate-y-2 focus-within:ring-2 focus-within:ring-[#1A3C2E] cursor-grab active:cursor-grabbing ${
                          draggedItemId === item.id ? 'opacity-40 border-dashed border-2 border-[#1A3C2E]' : ''
                        }`}
                        onClick={() => setDetailItem(item)}
                      >
                        
                        {/* Image aspect box */}
                        <div className="overflow-hidden relative bg-stone-100 w-full h-full">
                          <OptimizedImage
                            src={item.thumbnails[0] || item.imageUrl}
                            alt={item.title}
                            width={800}
                            height={600}
                            className="w-full h-auto object-cover transition-all duration-500 group-hover:scale-105 group-hover:brightness-75 group-hover:opacity-90"
                            loading="lazy"
                          />
                          
                          {/* Hover metadata overlay */}
                          <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-5 text-white">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono tracking-widest uppercase font-black bg-[#FAF7EA]/25 backdrop-blur-md px-2.5 py-1 rounded-full text-white">
                                {item.category}
                              </span>
                              {item.featured && (
                                <span className="text-[9px] font-bold font-mono text-[#F5B400] bg-black/40 px-2 py-0.5 rounded-full border border-[#F5B400]/30">
                                  Featured
                                </span>
                              )}
                            </div>
                            
                            <div className="space-y-2 text-left">
                              <h3 className="font-marcellus text-sm sm:text-base md:text-lg font-black tracking-tight leading-tight line-clamp-3 text-white font-serif">
                                {item.title}
                              </h3>
                              <p className="text-[11px] font-sans text-stone-200 line-clamp-2 opacity-95">
                                {item.description}
                              </p>
                              
                              <div className="flex items-center justify-between pt-1 border-t border-white/20 mt-1">
                                <span className="text-[10px] font-bold opacity-80 truncate max-w-[130px]">
                                  By {item.postedBy}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#F5B400] flex items-center gap-1">
                                  View <Maximize2 size={10} />
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Hover admin controls overlay */}
                        {isAdmin && (
                          <div 
                            className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                            onClick={e => e.stopPropagation()}
                          >
                            {deleteConfirmId === item.id ? (
                              <div className="bg-white rounded-xl shadow-xl border border-stone-200 p-2 flex items-center gap-1.5 animate-fade-in text-stone-800 cursor-default">
                                <span className="text-[9px] font-bold font-mono">Delete?</span>
                                <button
                                  onClick={() => handleConfirmDelete(item.id)}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-colors shadow-sm cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold text-[9px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditTargetItem(item);
                                    setShowAdminForm(true);
                                  }}
                                  className="p-1.5 bg-white hover:bg-stone-50 text-stone-700 rounded-lg shadow-md transition-all hover:scale-105 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1A3C2E] cursor-pointer"
                                  title="Edit Item"
                                >
                                  <Edit size={12} />
                                </button>
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setDeleteConfirmId(item.id);
                                  }}
                                  className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-md transition-all hover:scale-105 border border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                                  title="Delete Item"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {filteredItems.length > visibleCount && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount(count => count + 24)}
                className="rounded-xl border border-[#123524] bg-white px-5 py-2.5 text-xs font-bold text-[#123524] transition-colors hover:bg-[#123524] hover:text-white"
              >
                Load 24 more
              </button>
            </div>
          )}

        </div>
      </section>

      {/* DETAIL VIEW MODAL */}
      {detailItem && (
        <DetailModal 
          item={detailItem} 
          onClose={() => setDetailItem(null)} 
          onEdit={(item) => {
            setEditTargetItem(item);
            setShowAdminForm(true);
          }}
          onConfirmDelete={handleConfirmDelete}
          isAdmin={isAdmin}
          prefersReducedMotion={prefersReducedMotion}
        />
      )}

    </div>
  );
}
