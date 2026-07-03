import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, Plus, Edit, Trash2, X, FileVideo, Loader2, Eye, Film, ArrowLeft, Volume2, VolumeX, Maximize, Minimize, RotateCcw, RotateCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import CouncilSeal from '../components/CouncilSeal';

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

interface FilmCredits {
  directedBy?: string;
  coDirectedBy?: string;
  writtenBy?: string;
  starring?: string;
  alsoStarring?: string;
  cinematographyBy?: string;
  setDesign?: string;
  specialThanks?: string;
  sponsoredBy?: string;
  editedBy?: string;
}

const PATCH_CREDITS: Record<string, FilmCredits> = {
  lychee: {
    directedBy: "John Dave Villareal",
    writtenBy: "Monique Frondozo",
    starring: "Pauleen Mae Espenilla and Jelden San Pedro",
    cinematographyBy: "Paul Efhraim Gregorio",
    setDesign: "Cathrina Joen Lumbang, Alexandra Macalla, Isabel Esteban, Brisias Labuson, Fitz Gerald Dellosa, Rohd Owerada, and John Bernard Inoy",
    specialThanks: "Jeremy Christian Mamaril",
    sponsoredBy: "Mogu Mogu",
    editedBy: "John Dave Villareal and Pole Buendia"
  },
  hagkan: {
    directedBy: "John Dave Villareal",
    coDirectedBy: "Monique Frondozo",
    writtenBy: "Alexandra Macalla",
    starring: "Leann Louise Orille and Allyza Joy Alcovendas",
    alsoStarring: "John Bernard Inoy",
    setDesign: "Pauleen Mae Espenilla, Cathrina Joen Lumbang, Brisias Labuson, Aldriy Baniel, Rohd Owerada, Jelden San Pedro, Fitz Gerald Dellosa, and Isabel San Esteban",
    cinematographyBy: "Paul Efhraim Gregorio",
    editedBy: "John Dave Villareal",
    specialThanks: "Cafe Prince, Sevi Coffee, Jeremy Christian Mamaril, and Aeron Francis Nasol",
    sponsoredBy: "Taters"
  },
  kanlungan: {
    directedBy: "Monique Frondozo",
    writtenBy: "Alexandra Macalla and John Bernard Inoy",
    starring: "Cyril Manalo and Ethan Harvey De Ocampo",
    alsoStarring: "Brisias Labuson and Rhianne Nacino",
    setDesign: "Aldriy Baniel, Pauleen Mae Espenilla, and Rohd Danniel Owerada",
    editedBy: "John Dave Villareal and Cathrina Joen Lumbang",
    cinematographyBy: "Paul Efhraim Gregorio"
  },
  kalungan: {
    directedBy: "Monique Frondozo",
    writtenBy: "Alexandra Macalla and John Bernard Inoy",
    starring: "Cyril Manalo and Ethan Harvey De Ocampo",
    alsoStarring: "Brisias Labuson and Rhianne Nacino",
    setDesign: "Aldriy Baniel, Pauleen Mae Espenilla, and Rohd Danniel Owerada",
    editedBy: "John Dave Villareal and Cathrina Joen Lumbang",
    cinematographyBy: "Paul Efhraim Gregorio"
  }
};

const normalizeTitle = (title: string): string => {
  let result = '';
  for (let i = 0; i < title.length; i++) {
    const cp = title.codePointAt(i);
    if (!cp) continue;
    
    if (cp > 0xffff) {
      i++;
    }
    
    if (cp >= 0x1D5D4 && cp <= 0x1D5ED) {
      result += String.fromCharCode(cp - 0x1D5D4 + 65);
    } else if (cp >= 0x1D5EE && cp <= 0x1D607) {
      result += String.fromCharCode(cp - 0x1D5EE + 97);
    } else if (cp >= 0x1D400 && cp <= 0x1D419) {
      result += String.fromCharCode(cp - 0x1D400 + 65);
    } else if (cp >= 0x1D41A && cp <= 0x1D433) {
      result += String.fromCharCode(cp - 0x1D41A + 97);
    } else {
      result += String.fromCodePoint(cp);
    }
  }
  return result.toLowerCase().trim();
};

const getCreditsForVideo = (title: string, episodeNumber?: number): FilmCredits | null => {
  if (episodeNumber === 4) return PATCH_CREDITS.lychee;
  if (episodeNumber === 3) return PATCH_CREDITS.hagkan;
  if (episodeNumber === 2) return PATCH_CREDITS.kanlungan;
  
  if (!title) return null;
  const norm = normalizeTitle(title);
  if (norm.includes('lychee')) return PATCH_CREDITS.lychee;
  if (norm.includes('hagkan')) return PATCH_CREDITS.hagkan;
  if (norm.includes('kanlungan')) return PATCH_CREDITS.kanlungan;
  if (norm.includes('kalungan')) return PATCH_CREDITS.kalungan;
  
  return null;
};

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

  // Netflix-style Custom Video Player States
  const [isPlayerActive, setIsPlayerActive] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Refs for custom player
  const customVideoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<any>(null);

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hideHeroOverlays, setHideHeroOverlays] = useState<boolean>(false);
  const overlayTimerRef = useRef<any>(null);

  // Cinematic focus mode timer
  useEffect(() => {
    if (overlayTimerRef.current) {
      clearTimeout(overlayTimerRef.current);
      overlayTimerRef.current = null;
    }

    if (activePreviewId && activeHeroVideo && activePreviewId === activeHeroVideo.id) {
      overlayTimerRef.current = setTimeout(() => {
        setHideHeroOverlays(true);
      }, 5000);
    } else {
      setHideHeroOverlays(false);
    }

    return () => {
      if (overlayTimerRef.current) {
        clearTimeout(overlayTimerRef.current);
      }
    };
  }, [activePreviewId, activeHeroVideo?.id]);

  // Autoplay video sound unmuting controller (browser policy bypass)
  useEffect(() => {
    if (activePreviewId && activeHeroVideo && activePreviewId === activeHeroVideo.id && videoRef.current) {
      const videoEl = videoRef.current;
      videoEl.muted = false;

      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.log("Autoplay sound blocked by browser, fallback to muted:", error);
          videoEl.muted = true;
          videoEl.play().catch(e => console.error("Muted playback fallback failed:", e));
        });
      }
    }
  }, [activePreviewId, activeHeroVideo?.id]);

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

  // Netflix-style Custom Video Player Control Methods
  const togglePlay = () => {
    if (!customVideoRef.current) return;
    if (isPlaying) {
      customVideoRef.current.pause();
      setIsPlaying(false);
    } else {
      customVideoRef.current.play().catch(err => console.error("Playback failed:", err));
      setIsPlaying(true);
    }
  };

  const skipSeconds = (seconds: number) => {
    if (!customVideoRef.current) return;
    const newTime = Math.max(0, Math.min(duration, customVideoRef.current.currentTime + seconds));
    customVideoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleTimeUpdate = () => {
    if (customVideoRef.current) {
      setCurrentTime(customVideoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (customVideoRef.current) {
      setDuration(customVideoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (customVideoRef.current) {
      const seekTime = parseFloat(e.target.value);
      customVideoRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (customVideoRef.current) {
      customVideoRef.current.volume = val;
      customVideoRef.current.muted = val === 0;
    }
    if (val > 0) {
      setIsMuted(false);
    } else {
      setIsMuted(true);
    }
  };

  const toggleMute = () => {
    if (!customVideoRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    customVideoRef.current.muted = nextMute;
    if (!nextMute && volume === 0) {
      setVolume(0.5);
      customVideoRef.current.volume = 0.5;
    }
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => console.error("Error enabling fullscreen:", err));
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(err => console.error("Error exiting fullscreen:", err));
    }
  };

  // Sync fullscreen state with ESC key or external changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Reset custom player states when details modal is closed
  useEffect(() => {
    if (!lightboxOpen) {
      setIsPlayerActive(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setPlaybackRate(1.0);
      if (customVideoRef.current) {
        customVideoRef.current.pause();
      }
    }
  }, [lightboxOpen]);

  // Lock body scroll when details modal is open
  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [lightboxOpen]);



  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (customVideoRef.current) {
      customVideoRef.current.playbackRate = rate;
    }
  };

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return "00:00";
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    const minsStr = mins < 10 ? `0${mins}` : `${mins}`;
    const secsStr = secs < 10 ? `0${secs}` : `${secs}`;
    return `${minsStr}:${secsStr}`;
  };

  // Keyboard Shortcuts Effect
  useEffect(() => {
    if (!isPlayerActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ': // Spacebar
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowleft': // Left Arrow -> seek back 10s
          e.preventDefault();
          skipSeconds(-10);
          break;
        case 'arrowright': // Right Arrow -> seek forward 10s
          e.preventDefault();
          skipSeconds(10);
          break;
        case 'arrowup': // Up Arrow -> volume up
          e.preventDefault();
          setVolume(prev => {
            const newVol = Math.min(1.0, prev + 0.1);
            if (customVideoRef.current) customVideoRef.current.volume = newVol;
            return newVol;
          });
          setIsMuted(false);
          if (customVideoRef.current) customVideoRef.current.muted = false;
          break;
        case 'arrowdown': // Down Arrow -> volume down
          e.preventDefault();
          setVolume(prev => {
            const newVol = Math.max(0.0, prev - 0.1);
            if (customVideoRef.current) customVideoRef.current.volume = newVol;
            return newVol;
          });
          break;
        case 'f': // Fullscreen
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm': // Mute
          e.preventDefault();
          toggleMute();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlayerActive, isPlaying, isMuted, volume, duration]);

  // Auto-hide controls effect
  useEffect(() => {
    if (!isPlayerActive) return;

    const hideControls = () => {
      setShowControls(false);
    };

    const resetTimer = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(hideControls, 3000);
    };

    resetTimer();

    window.addEventListener('mousemove', resetTimer);
    return () => {
      window.removeEventListener('mousemove', resetTimer);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlayerActive]);


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
                ref={videoRef}
                src={activeHeroVideo.videoUrl}
                autoPlay
                loop
                muted
                playsInline
                className={`w-full h-full object-cover object-top filter brightness-90 scale-105 transition-all duration-1000 ${
                  hideHeroOverlays ? 'opacity-100' : 'opacity-85'
                }`}
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
            <div className={`absolute inset-0 bg-gradient-to-t from-[#11241C] via-[#11241C]/40 to-transparent transition-opacity duration-1000 ${
              hideHeroOverlays ? 'opacity-0' : 'opacity-100'
            }`} />
            <div className={`absolute inset-y-0 left-0 w-full md:w-2/3 bg-gradient-to-r from-[#11241C]/90 via-[#11241C]/30 to-transparent pointer-events-none transition-opacity duration-1000 ${
              hideHeroOverlays ? 'opacity-0' : 'opacity-100'
            }`} />
          </div>

          {/* Hero details container */}
          <div
            key={`details-${activeHeroVideo.id}`}
            className={`relative z-10 max-w-7xl mx-auto w-full px-6 sm:px-12 pb-20 sm:pb-28 flex flex-col items-start gap-4 transition-all duration-1000 ${
              hideHeroOverlays ? 'opacity-0 pointer-events-none translate-y-4' : 'animate-slide-fade-in opacity-100 translate-y-0'
            }`}
          >
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
            <div className={`absolute bottom-6 right-6 sm:right-12 z-20 flex gap-2 transition-opacity duration-1000 ${
              hideHeroOverlays ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}>
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
      {lightboxOpen && selectedVideo && createPortal(
        <div
          ref={playerContainerRef}
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 bg-[#0B1512] z-[9999] overflow-y-auto flex flex-col animate-fade-in font-sans text-[#FAF7EA]"
        >
          {/* Main Fullscreen Toggle Wrapper */}
          <div onClick={(e) => e.stopPropagation()} className="w-full min-h-screen flex flex-col relative">
            
            {/* 4A. CUSTOM VIDEO PLAYER INTERFACE */}
            {isPlayerActive ? (
              <div className="relative w-screen h-screen bg-black flex items-center justify-center overflow-hidden">
                {selectedVideo.videoUrl ? (
                  <video
                    ref={customVideoRef}
                    src={selectedVideo.videoUrl}
                    autoPlay
                    loop
                    className="w-full h-full object-contain bg-black cursor-pointer"
                    onClick={togglePlay}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                  />
                ) : (
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

                {/* Netflix-style Pause Overlay */}
                {selectedVideo.videoUrl && !isPlaying && (
                  <div className="absolute inset-0 bg-black/60 z-30 flex items-center justify-start p-8 sm:p-16 md:p-24 transition-opacity duration-300 pointer-events-none animate-fade-in">
                    <div className="max-w-md md:max-w-lg space-y-6 text-left pointer-events-auto">
                      
                      {/* Title & Ep Tag */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] bg-[#F5B400] text-[#11241C] px-3 py-0.5 rounded-full font-black uppercase tracking-wider">
                            EPISODE {selectedVideo.episodeNumber}
                          </span>
                          <span className="font-mono text-[9px] text-[#F5B400] border border-[#F5B400]/30 px-2 py-0.5 rounded-full uppercase font-bold">
                            {selectedVideo.category === 'Full Episodes' ? 'Full Ep' : 'Highlight'}
                          </span>
                        </div>
                        <h2 className="font-serif font-black text-4xl sm:text-5xl md:text-6xl text-white tracking-tight leading-tight">
                          {selectedVideo.title}
                        </h2>
                      </div>

                      {/* Brief synopsis */}
                      <p className="text-stone-300 text-xs md:text-sm leading-relaxed font-sans font-medium">
                        {selectedVideo.description.split('\n')[0]}
                      </p>

                      {/* Buttons */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        {/* Resume Button */}
                        <button
                          onClick={togglePlay}
                          className="flex items-center justify-center gap-2 bg-white text-[#11241C] hover:bg-[#F5B400] hover:text-[#11241C] font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider transition-all duration-300 cursor-pointer shadow-lg active:scale-98 outline-none"
                        >
                          <Play size={14} className="fill-current" />
                          Resume Playing
                        </button>

                        {/* Play from Beginning Button */}
                        <button
                          onClick={() => {
                            if (customVideoRef.current) {
                              customVideoRef.current.currentTime = 0;
                              if (!isPlaying) togglePlay();
                            }
                          }}
                          className="flex items-center justify-center gap-2 border border-white/20 hover:border-white text-white hover:text-[#F5B400] font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider transition-all duration-300 cursor-pointer active:scale-98 outline-none"
                        >
                          <RotateCcw size={14} />
                          Play From Beginning
                        </button>
                      </div>

                    </div>
                  </div>
                )}

                {/* Netflix-style Controls Overlay */}
                <div 
                  className={`absolute inset-0 z-20 flex flex-col justify-between transition-opacity duration-300 bg-gradient-to-t from-black/80 via-transparent to-black/75 ${
                    showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  {/* Top Bar */}
                  <div className="p-6 flex items-center justify-between w-full">
                    <div className="w-10" /> {/* Spacer */}
                    
                    {/* Middle EP & Title */}
                    <div className="text-center">
                      <span className="block font-mono text-[10px] tracking-widest text-[#F5B400] font-black uppercase mb-0.5">
                        EPISODE {selectedVideo.episodeNumber < 10 ? `0${selectedVideo.episodeNumber}` : selectedVideo.episodeNumber}
                      </span>
                      <h2 className="font-serif font-black text-lg md:text-xl text-white tracking-tight leading-tight">
                        {selectedVideo.title}
                      </h2>
                    </div>

                    {/* Top Right Back Arrow to Details Modal */}
                    <button
                      onClick={() => {
                        setIsPlayerActive(false);
                        if (customVideoRef.current) customVideoRef.current.pause();
                        setIsPlaying(false);
                      }}
                      className="p-2.5 rounded-full bg-black/40 hover:bg-[#F5B400] text-white hover:text-[#11241C] border border-white/10 transition-all duration-300 cursor-pointer outline-none"
                      title="Back to Details"
                    >
                      <ArrowLeft size={20} />
                    </button>
                  </div>

                  {/* Center Play/Pause Floating Assist */}
                  <div 
                    onClick={togglePlay}
                    className="flex-grow flex-1 flex items-center justify-center cursor-pointer pointer-events-auto"
                  >
                    {!isPlaying && selectedVideo.videoUrl && (
                      <div className="p-6 rounded-full bg-black/50 border border-white/10 text-[#FAF7EA] hover:scale-110 transition-transform duration-300">
                        <Play size={44} className="fill-current translate-x-0.5" />
                      </div>
                    )}
                  </div>

                  {/* Bottom Controls (Only for HTML5 Video URL) */}
                  {selectedVideo.videoUrl ? (
                    <div className="p-6 flex flex-col gap-4 w-full bg-gradient-to-t from-black/90 to-transparent">
                      
                      {/* Scrubber Progress Slider */}
                      <div className="flex items-center gap-4 w-full">
                        <span className="text-[10px] font-mono text-stone-300 w-10 text-right select-none">
                          {formatTime(currentTime)}
                        </span>
                        <input
                          type="range"
                          min="0"
                          max={duration || 100}
                          value={currentTime}
                          onChange={handleSeek}
                          style={{
                            background: `linear-gradient(to right, #F5B400 0%, #F5B400 ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.2) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.2) 100%)`
                          }}
                          className="flex-1 h-1 hover:h-2 rounded-lg appearance-none cursor-pointer accent-[#F5B400] transition-all bg-white/20 outline-none"
                        />
                        <span className="text-[10px] font-mono text-stone-300 w-10 text-left select-none">
                          {formatTime(duration)}
                        </span>
                      </div>

                      {/* Button Bar */}
                      <div className="flex items-center justify-between w-full">
                        {/* Left Group */}
                        <div className="flex items-center gap-6">
                          {/* Play/Pause */}
                          <button
                            onClick={togglePlay}
                            className="text-white hover:text-[#F5B400] transition-colors cursor-pointer outline-none flex items-center justify-center"
                          >
                            {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current" />}
                          </button>

                          {/* Skip Backward 10s */}
                          <button
                            onClick={() => skipSeconds(-10)}
                            className="text-white hover:text-[#F5B400] transition-colors cursor-pointer outline-none relative flex items-center justify-center"
                            title="Rewind 10s"
                          >
                            <RotateCcw size={20} />
                            <span className="absolute text-[8px] font-bold font-sans mt-1">10</span>
                          </button>

                          {/* Skip Forward 10s */}
                          <button
                            onClick={() => skipSeconds(10)}
                            className="text-white hover:text-[#F5B400] transition-colors cursor-pointer outline-none relative flex items-center justify-center"
                            title="Forward 10s"
                          >
                            <RotateCw size={20} />
                            <span className="absolute text-[8px] font-bold font-sans mt-1">10</span>
                          </button>

                          {/* Volume & Slider */}
                          <div className="flex items-center gap-2 group">
                            <button
                              onClick={toggleMute}
                              className="text-white hover:text-[#F5B400] transition-colors cursor-pointer outline-none flex items-center justify-center"
                            >
                              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                            </button>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={isMuted ? 0 : volume}
                              onChange={handleVolumeChange}
                              className="w-0 opacity-0 group-hover:w-16 group-hover:opacity-100 transition-all duration-300 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                            />
                          </div>
                        </div>

                        {/* Right Group */}
                        <div className="flex items-center gap-6">
                          {/* Playback Rate Cycler */}
                          <button
                            onClick={() => {
                              const rates = [1.0, 1.25, 1.5, 2.0];
                              const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
                              handleSpeedChange(rates[nextIdx]);
                            }}
                            className="text-[10px] font-mono font-black border border-white/30 hover:border-white text-stone-300 hover:text-white px-2 py-0.5 rounded transition-all cursor-pointer outline-none"
                            title="Playback Speed"
                          >
                            {playbackRate === 1.0 ? '1.0x (Normal)' : `${playbackRate}x`}
                          </button>

                          {/* Fullscreen Toggle */}
                          <button
                            onClick={toggleFullscreen}
                            className="text-white hover:text-[#F5B400] transition-colors cursor-pointer outline-none flex items-center justify-center"
                            title="Toggle Fullscreen"
                          >
                            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                          </button>
                        </div>
                      </div>

                    </div>
                  ) : (
                    /* Info text for embed players */
                    <div className="p-4 text-center bg-black/60 backdrop-blur-xs text-[10px] text-stone-400 font-sans w-full">
                      Custom Netflix control overlays are currently only supported on native hosted files.
                    </div>
                  )}

                </div>
              </div>
            ) : (
              
              /* 4B. CINEMATIC TWO-COLUMN DETAILS MODAL */
              <div className="grid grid-cols-1 lg:grid-cols-12 w-full min-h-screen text-[#FAF7EA] bg-[#0B1512] relative">
                
                {/* Close modal completely (top-right absolute icon) */}
                <button
                  onClick={() => setLightboxOpen(false)}
                  className="absolute top-6 right-6 z-50 p-2.5 rounded-full bg-black/40 hover:bg-white/15 text-stone-300 hover:text-white border border-white/10 transition-colors cursor-pointer outline-none flex items-center justify-center"
                  title="Close Screen"
                >
                  <X size={20} />
                </button>

                {/* Left Side: Video Info Column */}
                <div className="lg:col-span-6 p-6 sm:p-12 md:p-16 flex flex-col justify-start space-y-8 overflow-y-auto max-h-screen scrollbar-none">
                  
                  {/* Council Logo & Badge */}
                  <div className="flex items-center gap-4">
                    <CouncilSeal size={70} interactive={false} />
                    <div>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-[#F5B400] font-black block">
                        CCIS STUDENT COUNCIL
                      </span>
                      <span className="font-mono text-[8px] uppercase tracking-wider text-stone-400 block mt-0.5">
                        CCIS Patch Studio Present
                      </span>
                    </div>
                  </div>

                  {/* Title & Ep Tag */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] bg-[#F5B400] text-[#11241C] px-3 py-0.5 rounded-full font-black uppercase tracking-wider">
                        EPISODE {selectedVideo.episodeNumber}
                      </span>
                      <span className="font-mono text-[9px] text-[#F5B400] border border-[#F5B400]/30 px-2 py-0.5 rounded-full uppercase font-bold">
                        {selectedVideo.category}
                      </span>
                    </div>
                    <h1 className="font-serif font-black text-4xl sm:text-5xl md:text-6xl text-white tracking-tight leading-tight">
                      {selectedVideo.title}
                    </h1>
                  </div>

                  {/* Synopsis (Quick text summary block) */}
                  <p className="text-stone-300 text-sm leading-relaxed max-w-2xl font-sans font-medium">
                    {selectedVideo.description.split('\n')[0]}
                  </p>

                  {/* Inline quick credits banner */}
                  {(() => {
                    const credits = getCreditsForVideo(selectedVideo.title, selectedVideo.episodeNumber);
                    if (!credits) return null;
                    return (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-mono text-[#F5B400] bg-white/5 border border-white/5 px-4 py-2.5 rounded-xl max-w-2xl">
                        {credits.directedBy && (
                          <span>
                            <strong className="text-stone-400">DIR:</strong> {credits.directedBy.split(',')[0]}
                          </span>
                        )}
                        {credits.writtenBy && (
                          <span>
                            <strong className="text-stone-400">WRITER:</strong> {credits.writtenBy.split(',')[0]}
                          </span>
                        )}
                        {credits.starring && (
                          <span>
                            <strong className="text-stone-400">CAST:</strong> {credits.starring.split('and')[0]}
                          </span>
                        )}
                        {credits.sponsoredBy && (
                          <span>
                            <strong className="text-stone-400">SPONSOR:</strong> {credits.sponsoredBy}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Huge cinematic play button */}
                  <button
                    onClick={() => {
                      setIsPlayerActive(true);
                      setIsPlaying(true);
                    }}
                    className="inline-flex items-center justify-center gap-3 bg-[#F5B400] hover:bg-[#ffc522] text-[#11241C] font-black uppercase tracking-wider text-xs px-10 py-4.5 rounded-2xl shadow-xl hover:shadow-[#F5B400]/25 transform hover:-translate-y-0.5 transition-all duration-300 max-w-xs cursor-pointer focus:ring-2 focus:ring-white outline-none"
                  >
                    <Play size={16} className="fill-current" />
                    Play {selectedVideo.category === 'Full Episodes' ? 'Episode' : 'Highlight'}
                  </button>

                  {/* Divider line */}
                  <div className="h-[1px] bg-stone-200/10 w-full max-w-2xl" />

                  {/* About the Episode (Detail text body + full credits list) */}
                  <div className="space-y-6 max-w-2xl">
                    <div className="space-y-3">
                      <h3 className="font-serif font-black text-lg text-white">About the Episode</h3>
                      <p className="text-stone-300 text-xs leading-relaxed whitespace-pre-line font-sans font-normal">
                        {selectedVideo.description}
                      </p>
                    </div>

                    {(() => {
                      const credits = getCreditsForVideo(selectedVideo.title, selectedVideo.episodeNumber);
                      if (!credits) return null;
                      return (
                        <div className="space-y-3 pt-4 border-t border-stone-200/10">
                          <h4 className="font-mono text-[9px] uppercase tracking-widest text-[#F5B400] font-black flex items-center gap-1.5">
                            <Film size={10} />
                            Full Production Credits
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 bg-[#11241C] border border-stone-200/5 p-4 rounded-2xl">
                            {credits.directedBy && (
                              <div className="text-[11px] font-sans">
                                <span className="block text-stone-400 font-mono text-[9px] uppercase tracking-wider mb-0.5">Directed By</span>
                                <span className="text-white font-semibold">{credits.directedBy}</span>
                              </div>
                            )}
                            {credits.coDirectedBy && (
                              <div className="text-[11px] font-sans">
                                <span className="block text-stone-400 font-mono text-[9px] uppercase tracking-wider mb-0.5">Co-Directed By</span>
                                <span className="text-white font-semibold">{credits.coDirectedBy}</span>
                              </div>
                            )}
                            {credits.writtenBy && (
                              <div className="text-[11px] font-sans">
                                <span className="block text-stone-400 font-mono text-[9px] uppercase tracking-wider mb-0.5">Written By</span>
                                <span className="text-white font-semibold">{credits.writtenBy}</span>
                              </div>
                            )}
                            {credits.starring && (
                              <div className="text-[11px] font-sans">
                                <span className="block text-stone-400 font-mono text-[9px] uppercase tracking-wider mb-0.5">Starring</span>
                                <span className="text-white font-semibold">{credits.starring}</span>
                              </div>
                            )}
                            {credits.alsoStarring && (
                              <div className="text-[11px] font-sans">
                                <span className="block text-stone-400 font-mono text-[9px] uppercase tracking-wider mb-0.5">Also Starring</span>
                                <span className="text-white font-semibold">{credits.alsoStarring}</span>
                              </div>
                            )}
                            {credits.cinematographyBy && (
                              <div className="text-[11px] font-sans">
                                <span className="block text-stone-400 font-mono text-[9px] uppercase tracking-wider mb-0.5">Cinematography By</span>
                                <span className="text-white font-semibold">{credits.cinematographyBy}</span>
                              </div>
                            )}
                            {credits.editedBy && (
                              <div className="text-[11px] font-sans">
                                <span className="block text-stone-400 font-mono text-[9px] uppercase tracking-wider mb-0.5">Edited By</span>
                                <span className="text-white font-semibold">{credits.editedBy}</span>
                              </div>
                            )}
                            {credits.sponsoredBy && (
                              <div className="text-[11px] font-sans">
                                <span className="block text-stone-400 font-mono text-[9px] uppercase tracking-wider mb-0.5">Sponsored By</span>
                                <span className="text-white font-semibold">{credits.sponsoredBy}</span>
                              </div>
                            )}
                            {credits.setDesign && (
                              <div className="text-[11px] font-sans sm:col-span-2">
                                <span className="block text-stone-400 font-mono text-[9px] uppercase tracking-wider mb-0.5">Set Design</span>
                                <span className="text-white font-semibold">{credits.setDesign}</span>
                              </div>
                            )}
                            {credits.specialThanks && (
                              <div className="text-[11px] font-sans sm:col-span-2">
                                <span className="block text-stone-400 font-mono text-[9px] uppercase tracking-wider mb-0.5">Special Thanks</span>
                                <span className="text-white font-semibold">{credits.specialThanks}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Right Side: Large Cinematic Poster Background Column */}
                <div className="lg:col-span-6 relative h-[50vh] lg:h-screen bg-stone-955 overflow-hidden flex items-center justify-center shrink-0">
                  {selectedVideo.thumbnailUrl ? (
                    <img
                      src={selectedVideo.thumbnailUrl}
                      alt={selectedVideo.title}
                      className="w-full h-full object-cover select-none scale-102 filter brightness-85"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#1A3C2E]/60 flex items-center justify-center">
                      <Film className="text-[#F5B400]/40 w-32 h-32" />
                    </div>
                  )}

                  {/* Gradient mask to blend left to right on desktop */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0B1512] via-[#0B1512]/45 to-transparent max-lg:hidden pointer-events-none" />
                  
                  {/* Gradient mask to blend bottom to top on mobile */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B1512] via-[#0B1512]/40 to-transparent lg:hidden pointer-events-none" />

                  {/* Floating click to play button overlay */}
                  <div 
                    onClick={() => {
                      setIsPlayerActive(true);
                      setIsPlaying(true);
                    }}
                    className="absolute inset-0 flex items-center justify-center group/play cursor-pointer z-10"
                    title="Play Movie"
                  >
                    <div className="bg-[#0B1512]/40 backdrop-blur-md border border-white/20 text-[#FAF7EA] p-6 rounded-full shadow-2xl group-hover/play:bg-[#F5B400] group-hover/play:text-[#11241C] group-hover/play:scale-110 transition-all duration-500">
                      <Play size={36} className="fill-current translate-x-0.5" />
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>,
        document.body
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
