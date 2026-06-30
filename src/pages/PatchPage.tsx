import React, { useState, useEffect, useRef } from 'react';
import { Play, Plus, Edit, Trash2, X, FileVideo, Loader2, Eye, Film } from 'lucide-react';
import { supabase } from '../lib/supabase';

export interface PatchVideo {
  id: string;
  episodeNumber: number;
  title: string;
  description: string;
  category: string; // e.g. "Full Episodes", "Highlights", "Behind the Scenes"
  facebookPermalink: string;
  videoUrl: string;
  thumbnailUrl: string;
  isFeatured: boolean;
  createdAt: string;
}

interface PatchPageProps {
  isAdmin?: boolean;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}



// Simple video thumbnail fallback generator
const ThumbnailPlaceholder = ({ epNumber, title }: { epNumber: number; title: string }) => (
  <div className="w-full h-full bg-[#1A3C2E]/60 flex flex-col items-center justify-center p-4 relative group-hover:bg-[#1A3C2E]/40 transition-colors">
    <Film className="text-[#F5B400]/40 mb-2 group-hover:scale-110 transition-transform duration-300" size={32} />
    <span className="font-mono text-2xl font-black text-[#F5B400] mb-0.5 tracking-tighter">
      EPISODE {epNumber < 10 ? `0${epNumber}` : epNumber}
    </span>
    <span className="text-[10px] text-stone-300 text-center font-sans line-clamp-2 px-2 max-w-[200px] leading-snug">
      {title}
    </span>
    <div className="absolute inset-0 border border-[#F5B400]/10 rounded-2xl pointer-events-none" />
  </div>
);

export default function PatchPage({ isAdmin = false }: PatchPageProps) {
  const [videos, setVideos] = useState<PatchVideo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isUsingMockData, setIsUsingMockData] = useState<boolean>(false);

  // Detail Modal & Lightbox
  const [selectedVideo, setSelectedVideo] = useState<PatchVideo | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);

  // Admin Video Form States
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [editTarget, setEditTarget] = useState<PatchVideo | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('Full Episodes');
  const [formEpisodeNumber, setFormEpisodeNumber] = useState<string>('1');
  const [formFacebookPermalink, setFormFacebookPermalink] = useState('');
  const [formThumbnailUrl, setFormThumbnailUrl] = useState('');
  const [formIsFeatured, setFormIsFeatured] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Direct video upload states
  const [formSourceType, setFormSourceType] = useState<'facebook' | 'direct' | 'upload'>('facebook');
  const [formVideoUrl, setFormVideoUrl] = useState<string>('');
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);

  // Autoplay-on-hover & Carousel logic states & refs
  const [hoveredItem, setHoveredItem] = useState<{ id: string; type: 'hero' | 'card' } | null>(null);
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const hoverTimerRef = useRef<any>(null);
  const [isCarouselPaused, setIsCarouselPaused] = useState<boolean>(false);
  const heroRef = useRef<HTMLDivElement>(null);

  // Carousel slider configurations: list of featured videos (fallback to latest 3)
  const featuredVideos = videos.filter(v => v.isFeatured).length > 0
    ? videos.filter(v => v.isFeatured)
    : videos.slice(0, 3);

  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const activeHeroVideo = featuredVideos[currentSlideIndex] || featuredVideos[0];

  // Automated 8-second slide rotation
  useEffect(() => {
    if (featuredVideos.length <= 1 || isCarouselPaused) return;

    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % featuredVideos.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [featuredVideos.length, isCarouselPaused]);

  // Sync hoveredItem id with slide transitions if user is hovering the hero
  useEffect(() => {
    if (hoveredItem && hoveredItem.type === 'hero' && activeHeroVideo) {
      setHoveredItem({ id: activeHeroVideo.id, type: 'hero' });
    }
  }, [currentSlideIndex, activeHeroVideo?.id]);

  // Index boundary safety check
  useEffect(() => {
    if (currentSlideIndex >= featuredVideos.length && featuredVideos.length > 0) {
      setCurrentSlideIndex(0);
    }
  }, [featuredVideos.length, currentSlideIndex]);

  // Hover preview activator
  useEffect(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    if (hoveredItem) {
      if (hoveredItem.type === 'hero') {
        setActivePreviewId(hoveredItem.id);
      } else {
        hoverTimerRef.current = setTimeout(() => {
          setActivePreviewId(hoveredItem.id);
        }, 5000);
      }
    } else {
      setActivePreviewId(null);
    }

    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, [hoveredItem]);

  // Touch and scroll outside interrupts for mobile triggers
  useEffect(() => {
    const handleScrollOrOutsideTouch = (e: Event) => {
      if (activePreviewId && hoveredItem?.type === 'hero') {
        const isScroll = e.type === 'scroll';
        const isOutside = heroRef.current && !heroRef.current.contains(e.target as Node);

        if (isScroll || isOutside) {
          setActivePreviewId(null);
          setHoveredItem(null);
          setIsCarouselPaused(false);
        }
      }
    };

    window.addEventListener('scroll', handleScrollOrOutsideTouch, { passive: true });
    document.addEventListener('touchstart', handleScrollOrOutsideTouch, { passive: true });
    document.addEventListener('mousedown', handleScrollOrOutsideTouch, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollOrOutsideTouch);
      document.removeEventListener('touchstart', handleScrollOrOutsideTouch);
      document.removeEventListener('mousedown', handleScrollOrOutsideTouch);
    };
  }, [activePreviewId, hoveredItem]);

  const handleHeroMouseEnter = () => {
    setIsCarouselPaused(true);
    if (activeHeroVideo) {
      setHoveredItem({ id: activeHeroVideo.id, type: 'hero' });
    }
  };

  const handleHeroMouseLeave = () => {
    setHoveredItem(null);
    setIsCarouselPaused(false);
  };

  const handleHeroTouchStart = () => {
    setIsCarouselPaused(true);
    if (activeHeroVideo) {
      setHoveredItem({ id: activeHeroVideo.id, type: 'hero' });
    }
  };

  // Toast Trigger Helper
  const triggerToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Fetch Videos
  const fetchVideos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patch_videos')
        .select('*')
        .order('episode_number', { ascending: false });

      if (error) {
        console.error('Supabase patch videos table load error:', error.message);
        setVideos([]);
        setIsUsingMockData(false);
      } else if (data && data.length > 0) {
        const mapped: PatchVideo[] = data.map((v) => ({
          id: v.id,
          episodeNumber: Number(v.episode_number || 1),
          title: v.title,
          description: v.description,
          category: v.category,
          facebookPermalink: v.facebook_permalink || '',
          videoUrl: v.video_url || '',
          thumbnailUrl: v.thumbnail_url || '',
          isFeatured: !!v.is_featured,
          createdAt: v.created_at
        }));
        setVideos(mapped);
        setIsUsingMockData(false);
      } else {
        // Table is empty
        setVideos([]);
        setIsUsingMockData(false);
      }
    } catch (err) {
      console.error('Failed to load patch videos:', err);
      setVideos([]);
      setIsUsingMockData(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  // Listen for Escape to close Lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize form for adding / editing
  const openForm = (video: PatchVideo | null = null) => {
    if (video) {
      setEditTarget(video);
      setFormTitle(video.title);
      setFormDescription(video.description);
      setFormCategory(video.category);
      setFormEpisodeNumber(String(video.episodeNumber));
      setFormFacebookPermalink(video.facebookPermalink || '');
      setFormThumbnailUrl(video.thumbnailUrl);
      setFormIsFeatured(video.isFeatured);
      setFormVideoUrl(video.videoUrl || '');
      if (video.videoUrl) {
        if (video.videoUrl.startsWith('http') && !video.videoUrl.includes('supabase.co')) {
          setFormSourceType('direct');
        } else {
          setFormSourceType('upload');
        }
      } else {
        setFormSourceType('facebook');
      }
      setSelectedFile(null);
      setSelectedVideoFile(null);
    } else {
      setEditTarget(null);
      setFormTitle('');
      setFormDescription('');
      setFormCategory('Full Episodes');
      
      // Auto increment episode number
      const maxEp = videos.reduce((max, v) => (v.episodeNumber > max ? v.episodeNumber : max), 0);
      setFormEpisodeNumber(String(maxEp + 1));
      setFormFacebookPermalink('');
      setFormThumbnailUrl('');
      setFormIsFeatured(false);
      setFormVideoUrl('');
      setFormSourceType('facebook');
      setSelectedFile(null);
      setSelectedVideoFile(null);
    }
    setShowFormModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.type.startsWith('image/')) {
        triggerToast('Only image files are allowed for thumbnails.', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        triggerToast('Thumbnail image cannot exceed 5MB.', 'error');
        return;
      }
      setSelectedFile(file);
      setFormThumbnailUrl(URL.createObjectURL(file));
    }
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.type.startsWith('video/') && !file.name.endsWith('.mov') && !file.name.endsWith('.mp4')) {
        triggerToast('Only video files are allowed.', 'error');
        return;
      }
      if (file.size > 500 * 1024 * 1024) {
        triggerToast('Video file size cannot exceed 500MB.', 'error');
        return;
      }
      setSelectedVideoFile(file);
      setFormVideoUrl(file.name);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUsingMockData) {
      triggerToast('Local Mock Fallback enabled. Connect Supabase database to write patch records.', 'warning');
      return;
    }

    const title = formTitle.trim();
    const description = formDescription.trim();
    const category = formCategory.trim();
    const episodeNumber = parseInt(formEpisodeNumber) || 1;
    const facebookPermalink = formSourceType === 'facebook' ? formFacebookPermalink.trim() : '';
    let videoUrl = (formSourceType === 'upload' || formSourceType === 'direct') ? formVideoUrl.trim() : '';
    let thumbnailUrl = formThumbnailUrl.trim();
    const isFeatured = formIsFeatured;

    if (!title || !description || !category) {
      triggerToast('Please fill out all required fields.', 'error');
      return;
    }

    if (formSourceType === 'facebook' && !facebookPermalink) {
      triggerToast('Please provide a Facebook Video permalink.', 'error');
      return;
    }

    if (formSourceType === 'direct' && !videoUrl) {
      triggerToast('Please provide a direct video URL (e.g. Cloudinary link).', 'error');
      return;
    }

    if (formSourceType === 'upload' && !videoUrl && !selectedVideoFile) {
      triggerToast('Please select a video file to upload.', 'error');
      return;
    }

    setFormSubmitting(true);

    try {
      // 1. Upload custom thumbnail to bucket if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const sanitizedFileName = `thumb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        
        const { error: uploadErr } = await supabase.storage
          .from('patch-thumbnails')
          .upload(sanitizedFileName, selectedFile);

        if (uploadErr) throw uploadErr;

        const publicUrl = supabase.storage.from('patch-thumbnails').getPublicUrl(sanitizedFileName).data.publicUrl;
        thumbnailUrl = publicUrl;
      }

      // 2. Upload custom video to bucket if selected
      if (formSourceType === 'upload' && selectedVideoFile) {
        const fileExt = selectedVideoFile.name.split('.').pop();
        const sanitizedFileName = `video_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        
        triggerToast('Starting video file upload (this may take a few seconds)...', 'info');
        const { error: uploadErr } = await supabase.storage
          .from('patch-videos')
          .upload(sanitizedFileName, selectedVideoFile);

        if (uploadErr) throw uploadErr;

        const publicUrl = supabase.storage.from('patch-videos').getPublicUrl(sanitizedFileName).data.publicUrl;
        videoUrl = publicUrl;
      }

      if (editTarget) {
        const { error: dbErr } = await supabase
          .from('patch_videos')
          .update({
            episode_number: episodeNumber,
            title,
            description,
            category,
            facebook_permalink: facebookPermalink || null,
            video_url: videoUrl || null,
            thumbnail_url: thumbnailUrl,
            is_featured: isFeatured
          })
          .eq('id', editTarget.id);

        if (dbErr) throw dbErr;
        triggerToast('Video metadata updated successfully.', 'success');
      } else {
        const { error: dbErr } = await supabase
          .from('patch_videos')
          .insert({
            episode_number: episodeNumber,
            title,
            description,
            category,
            facebook_permalink: facebookPermalink || null,
            video_url: videoUrl || null,
            thumbnail_url: thumbnailUrl,
            is_featured: isFeatured
          });

        if (dbErr) throw dbErr;
        triggerToast('New Patch video published successfully.', 'success');
      }

      setShowFormModal(false);
      fetchVideos();
    } catch (err: any) {
      console.error('Submission failed:', err);
      triggerToast(err.message || 'Failed to submit video metadata.', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteVideo = async (video: PatchVideo) => {
    if (isUsingMockData) {
      triggerToast('Mock fallback active. Delete functions locked.', 'warning');
      return;
    }

    try {
      const { error } = await supabase
        .from('patch_videos')
        .delete()
        .eq('id', video.id);

      if (error) throw error;

      triggerToast('Patch video deleted successfully.', 'success');
      setDeleteConfirmId(null);
      if (selectedVideo?.id === video.id) {
        setLightboxOpen(false);
      }
      fetchVideos();
    } catch (err: any) {
      console.error('Failed to delete video:', err);
      triggerToast(err.message || 'Failed to delete video record.', 'error');
    }
  };

  const openVideoLightbox = (video: PatchVideo) => {
    setSelectedVideo(video);
    setLightboxOpen(true);
  };

  // Resolve Facebook permalink to official plugin embed URL
  const getFbEmbedUrl = (permalink: string) => {
    let cleanUrl = permalink.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(cleanUrl)}&show_text=false&t=0`;
  };

  // Group videos by category rows
  const categories = ["Full Episodes", "Highlights", "Behind the Scenes"];

  return (
    <div className="min-h-screen bg-[#11241C] text-[#FAF7EA] font-sans select-none overflow-hidden relative">
      
      {/* Toast Alert overlay */}
      <div className="fixed top-24 right-6 z-[10000] flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-5 py-3.5 rounded-2xl shadow-xl border flex items-center justify-between gap-6 pointer-events-auto animate-slide-in text-xs font-sans tracking-wide max-w-sm ${
              t.type === 'success' ? 'bg-[#1A3C2E] border-emerald-500/20 text-[#FAF7EA]' :
              t.type === 'error' ? 'bg-rose-950 border-rose-500/20 text-rose-200' :
              t.type === 'warning' ? 'bg-amber-950 border-amber-500/20 text-amber-200' :
              'bg-[#123524] border-stone-200/10 text-stone-100'
            }`}
          >
            <div>
              <p className="font-black uppercase tracking-widest text-[9px] text-[#F5B400] mb-0.5">{t.type}</p>
              <p className="leading-relaxed font-sans">{t.message}</p>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
              className="text-[#FAF7EA] hover:opacity-75 focus:outline-none cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* 1. HERO FEATURED VIDEO SLIDER BANNER */}
      {activeHeroVideo && (
        <section
          ref={heroRef}
          onMouseEnter={handleHeroMouseEnter}
          onMouseLeave={handleHeroMouseLeave}
          onTouchStart={handleHeroTouchStart}
          className="relative w-full h-[65vh] min-h-[460px] md:h-auto md:aspect-video md:max-h-[80vh] bg-gradient-to-b from-stone-900/60 to-[#11241C] overflow-hidden flex items-end"
        >
          {/* Background image/video overlay */}
          <div key={`bg-${activeHeroVideo.id}`} className="absolute inset-0 z-0 animate-slide-fade-in">
            {activePreviewId === activeHeroVideo.id && activeHeroVideo.videoUrl ? (
              <video
                src={activeHeroVideo.videoUrl}
                autoPlay
                loop
                playsInline
                className="w-full h-full object-cover object-top opacity-85 filter brightness-90 scale-105 transition-opacity duration-1000"
              />
            ) : activeHeroVideo.thumbnailUrl ? (
              <img
                src={activeHeroVideo.thumbnailUrl}
                alt={activeHeroVideo.title}
                className="w-full h-full object-cover object-top opacity-80 filter brightness-90 scale-105"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-[#1A3C2E]/60 to-[#11241C] flex items-center justify-center opacity-30">
                <Film className="w-48 h-48 text-[#FAF7EA]/5 stroke-[0.5]" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#11241C] via-[#11241C]/40 to-transparent" />
            <div className="absolute inset-y-0 left-0 w-full md:w-2/3 bg-gradient-to-r from-[#11241C]/90 via-[#11241C]/30 to-transparent pointer-events-none" />
          </div>

          {/* Hero details container */}
          <div key={`details-${activeHeroVideo.id}`} className="relative z-10 max-w-7xl mx-auto w-full px-6 sm:px-12 pb-20 sm:pb-28 flex flex-col items-start gap-4 animate-slide-fade-in">
            <div className="flex items-center gap-3">
              <span className="bg-[#F5B400] text-[#11241C] font-mono text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full shadow-md">
                FEATURED EPISODE
              </span>
              <span className="font-mono text-xs text-[#FAF7EA]/75 font-bold uppercase tracking-tight">
                Patch Series &bull; Episode {activeHeroVideo.episodeNumber}
              </span>
            </div>

            <h1 className="font-serif font-black text-3xl sm:text-5xl md:text-6xl text-[#FAF7EA] max-w-3xl tracking-tight leading-none mt-2 drop-shadow-md">
              {activeHeroVideo.title}
            </h1>

            <p className="text-stone-300 text-xs sm:text-sm max-w-2xl leading-relaxed mt-2 line-clamp-3 md:line-clamp-none font-sans drop-shadow-sm">
              {activeHeroVideo.description}
            </p>

            <div className="flex items-center gap-4 mt-6 flex-wrap">
              <button
                onClick={() => openVideoLightbox(activeHeroVideo)}
                className="inline-flex items-center gap-2 bg-[#F5B400] hover:bg-[#ffc522] text-[#11241C] font-black uppercase tracking-wider text-xs px-8 py-3.5 rounded-full transition-all duration-300 shadow-lg hover:shadow-[#F5B400]/25 transform hover:-translate-y-0.5 cursor-pointer focus:ring-2 focus:ring-[#FAF7EA] outline-none"
              >
                <Play size={14} className="fill-current" />
                Watch Episode
              </button>

              {isAdmin && (
                <button
                  onClick={() => openForm(activeHeroVideo)}
                  className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-[#FAF7EA] border border-white/10 font-bold text-xs px-6 py-3.5 rounded-full transition-all cursor-pointer focus:ring-2 focus:ring-stone-400 outline-none"
                >
                  <Edit size={14} />
                  Edit Details
                </button>
              )}
            </div>
          </div>

          {/* Slide Dot Indicators */}
          {featuredVideos.length > 1 && (
            <div className="absolute bottom-6 right-6 sm:right-12 z-20 flex gap-2">
              {featuredVideos.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlideIndex(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                    currentSlideIndex === idx ? 'bg-[#F5B400] w-6' : 'bg-white/30 hover:bg-white/50'
                  }`}
                  title={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* 2. ADMIN PORTAL HEADER STRIP */}
      {isAdmin && (
        <section className="max-w-7xl mx-auto px-6 sm:px-12 mt-8">
          <div className="bg-[#1A3C2E] border border-[#F5B400]/20 p-5 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <Film className="text-[#F5B400]" size={22} />
              <div>
                <h3 className="font-serif font-black text-sm text-[#FAF7EA]">Patch Admin Controller</h3>
                <p className="text-[10px] text-stone-400">Add or modify cinematography videos manually on the database</p>
              </div>
            </div>
            <button
              onClick={() => openForm(null)}
              className="inline-flex items-center gap-1.5 bg-[#F5B400] hover:bg-[#ffc522] text-[#11241C] text-xs font-black uppercase tracking-wider px-5 py-2.5 rounded-xl cursor-pointer shadow-sm transition-colors focus:ring-2 focus:ring-[#FAF7EA] outline-none"
            >
              <Plus size={14} />
              Publish Video
            </button>
          </div>
        </section>
      )}

      {/* 3. NETFLIX-STYLE CATEGORY SLIDERS */}
      <section className="max-w-7xl mx-auto px-6 sm:px-12 mt-12 space-y-12">
        {loading ? (
          /* Slider skeleton layout */
          <div className="space-y-10 animate-pulse">
            {[1, 2].map(r => (
              <div key={r} className="space-y-4">
                <div className="h-6 bg-stone-850 rounded w-1/5" />
                <div className="flex gap-6 overflow-hidden">
                  {[1, 2, 3].map(c => (
                    <div key={c} className="w-80 aspect-video bg-stone-850 rounded-2xl shrink-0" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : videos.length === 0 ? (
          /* Archive empty */
          <div className="text-center py-20 bg-[#1A3C2E]/20 border border-[#1A3C2E]/50 rounded-3xl max-w-md mx-auto p-8 flex flex-col items-center">
            <FileVideo className="text-[#F5B400]/40 mb-4" size={40} />
            <h3 className="font-serif font-black text-lg mb-1">No Video Records Published</h3>
            <p className="text-stone-400 text-xs leading-relaxed max-w-[280px]">
              The Patch cinematography catalog is currently empty. Connect Supabase database to write.
            </p>
            {isAdmin && (
              <button
                onClick={() => openForm(null)}
                className="mt-6 px-5 py-2 bg-[#F5B400] hover:bg-[#ffc522] text-[#11241C] text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer transition-colors"
              >
                Publish First Video
              </button>
            )}
          </div>
        ) : (
          /* Categories rows container */
          categories.map(category => {
            const categoryVideos = videos.filter(v => v.category === category);
            if (categoryVideos.length === 0) return null;

            return (
              <div key={category} className="space-y-3 relative group/row">
                <h2 className="font-serif font-black text-xl sm:text-2xl text-[#FAF7EA] tracking-wide inline-flex items-center gap-2 border-b-2 border-[#F5B400]/10 pb-1.5 pr-6">
                  {category}
                </h2>
                
                {/* Horizontal scrolling strip */}
                <div className="flex gap-6 overflow-x-auto scrollbar-none py-4 px-2 scroll-smooth">
                  {categoryVideos.map(video => (
                    <div
                      key={video.id}
                      onClick={() => openVideoLightbox(video)}
                      className="w-72 sm:w-80 aspect-video bg-[#1A3C2E] border border-stone-250/10 rounded-2xl overflow-hidden relative shrink-0 shadow-md hover:shadow-xl hover:shadow-[#F5B400]/10 transition-all duration-300 transform hover:scale-[1.04] cursor-pointer group"
                    >
                      {/* Video Thumbnail */}
                      {video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <ThumbnailPlaceholder epNumber={video.episodeNumber} title={video.title} />
                      )}

                      {/* Play Action Hover overlay */}
                      <div className="absolute inset-0 bg-stone-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10">
                        <div className="bg-[#F5B400] text-[#11241C] p-3.5 rounded-full shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300">
                          <Play size={18} className="fill-current" />
                        </div>
                      </div>

                      {/* Numbering & Metadata strip (intentional visual sequence) */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-stone-950 via-stone-900/80 to-transparent p-4 z-10 flex items-end justify-between">
                        <div className="space-y-0.5 max-w-[80%]">
                          <span className="font-mono text-[9px] font-black text-[#F5B400] uppercase tracking-widest block">
                            EPISODE {video.episodeNumber < 10 ? `0${video.episodeNumber}` : video.episodeNumber}
                          </span>
                          <h4 className="font-sans font-bold text-[#FAF7EA] text-[11.5px] leading-tight truncate">
                            {video.title}
                          </h4>
                        </div>
                        {video.isFeatured && (
                          <span className="bg-[#F5B400]/20 border border-[#F5B400]/30 text-[#F5B400] font-mono text-[7px] uppercase font-black px-1.5 py-0.5 rounded">
                            STAR
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* ============================================================
          4. VIDEO LIGHTBOX PLAYER MODAL
          ============================================================ */}
      {lightboxOpen && selectedVideo && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 bg-stone-955/90 backdrop-blur-sm overflow-y-auto flex items-start md:items-center justify-center p-4 sm:p-6 z-[999] animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1A3C2E] border border-stone-250/10 max-w-4xl w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto h-auto md:max-h-[90vh] text-[#FAF7EA] animate-scale-up"
          >
            {/* Aspect Ratio Video container */}
            <div className="relative aspect-video w-full bg-stone-950 border-b border-stone-250/10 flex items-center justify-center overflow-hidden">
              {selectedVideo.videoUrl ? (
                /* Native HTML5 Video Player */
                <video
                  src={selectedVideo.videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain bg-black"
                />
              ) : (
                /* Responsive Iframe Embed for Facebook Links */
                <iframe
                  src={getFbEmbedUrl(selectedVideo.facebookPermalink)}
                  width="100%"
                  height="100%"
                  className="absolute inset-0 w-full h-full"
                  style={{ border: 'none', overflow: 'hidden' }}
                  scrolling="no"
                  frameBorder="0"
                  allowFullScreen={true}
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                />
              )}
            </div>

            {/* Video description detail body */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-4 font-sans text-xs max-h-[35vh]">
              {/* Close Button */}
              <button
                onClick={() => setLightboxOpen(false)}
                className="absolute top-6 right-6 p-1.5 rounded-full bg-white/10 text-stone-300 hover:text-white hover:bg-white/20 transition-colors cursor-pointer outline-none"
              >
                <X size={18} />
              </button>

              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[9px] bg-[#F5B400] text-[#11241C] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                      EPISODE {selectedVideo.episodeNumber < 10 ? `0${selectedVideo.episodeNumber}` : selectedVideo.episodeNumber}
                    </span>
                    <span className="font-mono text-[9px] text-[#F5B400] border border-[#F5B400]/30 px-2 py-0.5 rounded-full uppercase font-bold">
                      {selectedVideo.category}
                    </span>
                  </div>
                  <h2 className="font-serif font-black text-xl sm:text-2xl text-white tracking-tight leading-tight mt-1.5">
                    {selectedVideo.title}
                  </h2>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setLightboxOpen(false);
                        openForm(selectedVideo);
                      }}
                      className="p-2 bg-white/10 hover:bg-white/20 text-[#FAF7EA] rounded-xl transition-colors cursor-pointer"
                      title="Edit Video Details"
                    >
                      <Edit size={14} />
                    </button>
                    
                    {deleteConfirmId === selectedVideo.id ? (
                      <div className="flex items-center gap-1.5 bg-rose-950/60 border border-rose-500/20 p-1 rounded-xl">
                        <button
                          onClick={() => handleDeleteVideo(selectedVideo)}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black uppercase rounded shadow-sm cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-1 bg-stone-700 hover:bg-stone-600 text-stone-200 text-[9px] font-black uppercase rounded shadow-sm cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(selectedVideo.id)}
                        className="p-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded-xl transition-colors cursor-pointer border border-rose-500/20"
                        title="Delete Video Record"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="h-[1px] bg-stone-200/10 w-full" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                <div className="md:col-span-2 space-y-2">
                  <h4 className="font-mono text-[9px] uppercase tracking-widest text-[#F5B400] font-black">Synopsis / Description</h4>
                  <p className="text-stone-300 leading-relaxed font-sans text-xs">
                    {selectedVideo.description}
                  </p>
                </div>

                <div className="space-y-3 bg-[#11241C] border border-stone-200/5 p-4 rounded-2xl">
                  <h4 className="font-mono text-[9px] uppercase tracking-widest text-[#F5B400] font-black">Video Details</h4>
                  <div className="space-y-1.5 text-[10px] text-stone-400 font-sans">
                    <div className="flex justify-between">
                      <span>Posted Date:</span>
                      <span className="font-mono text-white">
                        {new Date(selectedVideo.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Producer:</span>
                      <span className="text-white font-bold">CCIS DevCom</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Source:</span>
                      {selectedVideo.videoUrl ? (
                        <a
                          href={selectedVideo.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#F5B400] hover:underline"
                        >
                          Direct Host ↗
                        </a>
                      ) : (
                        <a
                          href={selectedVideo.facebookPermalink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#F5B400] hover:underline"
                        >
                          Facebook Page ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ============================================================
          5. ADMIN FORM MODAL UPLOAD / EDIT DIALOG
          ============================================================ */}
      {showFormModal && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-[#1A3C2E] border border-stone-200/10 max-w-md w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Form Header */}
            <div className="bg-[#11241C] text-[#FAF7EA] px-6 py-4 flex items-center justify-between border-b border-stone-200/10 shrink-0">
              <h3 className="font-serif font-black text-sm tracking-wide">
                {editTarget ? 'Edit Patch Video details' : 'Publish Patch Video'}
              </h3>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-stone-400 hover:text-white p-1 rounded-full hover:bg-white/5 transition-all cursor-pointer"
                disabled={formSubmitting}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Scroll Body */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 font-sans text-xs">
              
              {/* Category selector */}
              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-[#F5B400] mb-1.5">
                  Category *
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full bg-[#11241C] border border-stone-200/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5B400] text-xs text-[#FAF7EA] cursor-pointer"
                  disabled={formSubmitting}
                >
                  <option value="Full Episodes">Full Episodes</option>
                  <option value="Highlights">Highlights</option>
                  <option value="Behind the Scenes">Behind the Scenes</option>
                </select>
              </div>

              {/* Title & Episode row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-mono uppercase font-bold text-[#F5B400] mb-1.5">
                    Episode Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Laban CCIS Congress"
                    className="w-full bg-[#11241C] border border-stone-200/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5B400] text-xs text-white"
                    disabled={formSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-[#F5B400] mb-1.5">
                    Episode # *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formEpisodeNumber}
                    onChange={(e) => setFormEpisodeNumber(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-full bg-[#11241C] border border-stone-200/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5B400] text-xs text-white text-center font-mono font-bold"
                    disabled={formSubmitting}
                  />
                </div>
              </div>

              {/* Video Source Type Toggle */}
              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-[#F5B400] mb-2">
                  Video Source Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormSourceType('facebook')}
                    className={`py-2 text-center rounded-xl font-bold uppercase tracking-wider transition-all cursor-pointer border text-[9px] ${
                      formSourceType === 'facebook'
                        ? 'bg-[#F5B400] border-[#F5B400] text-[#11241C]'
                        : 'bg-[#11241C] border-stone-200/10 text-stone-400 hover:text-white'
                    }`}
                  >
                    FB Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSourceType('direct')}
                    className={`py-2 text-center rounded-xl font-bold uppercase tracking-wider transition-all cursor-pointer border text-[9px] ${
                      formSourceType === 'direct'
                        ? 'bg-[#F5B400] border-[#F5B400] text-[#11241C]'
                        : 'bg-[#11241C] border-stone-200/10 text-stone-400 hover:text-white'
                    }`}
                  >
                    Direct Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSourceType('upload')}
                    className={`py-2 text-center rounded-xl font-bold uppercase tracking-wider transition-all cursor-pointer border text-[9px] ${
                      formSourceType === 'upload'
                        ? 'bg-[#F5B400] border-[#F5B400] text-[#11241C]'
                        : 'bg-[#11241C] border-stone-200/10 text-stone-400 hover:text-white'
                    }`}
                  >
                    Upload File
                  </button>
                </div>
              </div>

              {/* Source Field: Facebook Permalink */}
              {formSourceType === 'facebook' && (
                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-[#F5B400] mb-1.5">
                    Facebook Video Permalink URL *
                  </label>
                  <input
                    type="url"
                    required
                    value={formFacebookPermalink}
                    onChange={(e) => setFormFacebookPermalink(e.target.value)}
                    placeholder="https://www.facebook.com/umakccissc/videos/..."
                    className="w-full bg-[#11241C] border border-stone-200/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5B400] text-xs text-white"
                    disabled={formSubmitting}
                  />
                </div>
              )}

              {/* Source Field: Direct Video URL */}
              {formSourceType === 'direct' && (
                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-[#F5B400] mb-1.5">
                    Direct Video URL (e.g. Cloudinary, MP4) *
                  </label>
                  <input
                    type="url"
                    required
                    value={formVideoUrl}
                    onChange={(e) => setFormVideoUrl(e.target.value)}
                    placeholder="https://res.cloudinary.com/...mp4"
                    className="w-full bg-[#11241C] border border-stone-200/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5B400] text-xs text-white font-mono"
                    disabled={formSubmitting}
                  />
                </div>
              )}

              {/* Source Field: Direct Video File Upload */}
              {formSourceType === 'upload' && (
                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-[#F5B400] mb-1.5">
                    Video File (.mp4, .mov) *
                  </label>
                  <div className="grid grid-cols-4 gap-4 items-center">
                    <div className="col-span-3">
                      <input
                        type="text"
                        readOnly
                        value={formVideoUrl}
                        placeholder="Select video file..."
                        className="w-full bg-[#11241C] border border-stone-200/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5B400] text-xs text-white"
                      />
                    </div>
                    <div className="relative text-center bg-[#11241C] border border-dashed border-stone-200/10 hover:border-[#F5B400]/40 rounded-xl py-2.5 cursor-pointer text-[10.5px] font-bold uppercase tracking-wide">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={formSubmitting}
                      />
                      Select
                    </div>
                  </div>
                  {selectedVideoFile && (
                    <p className="text-[10px] text-[#F5B400] mt-1.5 font-mono">
                      Selected file: {selectedVideoFile.name} ({(selectedVideoFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </p>
                  )}
                </div>
              )}

              {/* Video Description */}
              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-[#F5B400] mb-1.5">
                  Video Description / Synopsis *
                </label>
                <textarea
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Write a short summary about this episode..."
                  rows={4}
                  className="w-full bg-[#11241C] border border-stone-200/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5B400] text-xs text-white resize-none leading-relaxed"
                  disabled={formSubmitting}
                />
              </div>

              {/* Thumbnail Selector */}
              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-[#F5B400] mb-1.5">
                  Thumbnail Image
                </label>
                <div className="grid grid-cols-4 gap-4 items-center">
                  <div className="col-span-3">
                    <input
                      type="text"
                      value={formThumbnailUrl}
                      onChange={(e) => setFormThumbnailUrl(e.target.value)}
                      placeholder="Input public image URL..."
                      className="w-full bg-[#11241C] border border-stone-200/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5B400] text-xs text-white"
                      disabled={formSubmitting || !!selectedFile}
                    />
                  </div>
                  <div className="relative text-center bg-[#11241C] border border-dashed border-stone-200/10 hover:border-[#F5B400]/40 rounded-xl py-2.5 cursor-pointer text-[10px]">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={formSubmitting}
                    />
                    Upload
                  </div>
                </div>

                {selectedFile && (
                  <p className="text-[10px] text-[#F5B400] mt-1.5 font-mono">
                    Selected file: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {/* Featured toggle */}
              <div className="flex items-center gap-3 bg-[#11241C] p-3.5 border border-stone-200/10 rounded-2xl mt-2 select-none">
                <input
                  type="checkbox"
                  id="formIsFeatured"
                  checked={formIsFeatured}
                  onChange={(e) => setFormIsFeatured(e.target.checked)}
                  className="rounded border-stone-200/10 text-[#F5B400] focus:ring-[#F5B400] cursor-pointer"
                  disabled={formSubmitting}
                />
                <label htmlFor="formIsFeatured" className="text-[11px] font-bold text-[#FAF7EA] cursor-pointer">
                  Feature this episode on Hero banner slider
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 flex gap-3 border-t border-stone-200/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="flex-1 py-3 text-center border border-stone-200/10 hover:bg-[#11241C] rounded-xl font-bold uppercase tracking-wider text-stone-300 cursor-pointer"
                  disabled={formSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 py-3 bg-[#F5B400] hover:bg-[#ffc522] disabled:bg-stone-500 text-[#11241C] rounded-xl font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  {formSubmitting && <Loader2 className="animate-spin" size={14} />}
                  {editTarget ? 'Save Changes' : 'Publish Episode'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
