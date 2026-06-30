import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

interface HeroProps {
  onLearnMoreClick: () => void;
  onAnnouncementsClick: () => void;
}

const HERO_IMAGES = [
  '/images/hero-section.jpg',
  '/images/hero-section2.png',
  '/images/hero-section3.jpg'
];

export default function Hero({ onLearnMoreClick, onAnnouncementsClick }: HeroProps) {
  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section 
      className="relative w-full min-h-[90vh] flex items-center overflow-hidden border-b-2 border-[#F5B400]" 
      id="hero-section"
    >
      {/* Background Image Carousel with Crossfade */}
      {HERO_IMAGES.map((src, idx) => (
        <div
          key={src}
          className="absolute inset-0 transition-opacity duration-[1800ms] ease-in-out"
          style={{ opacity: currentImage === idx ? 1 : 0, zIndex: 0 }}
        >
          <img
            src={src}
            alt={`CCIS Hero ${idx + 1}`}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
      ))}

      {/* Dark Scrim Overlays — neutral black for text readability, replacing the green overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent z-[1]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-[1]" />
      {/* Subtle animated accent lines */}
      <div className="absolute inset-0 z-[2] opacity-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] -left-20 w-[500px] h-[1px] bg-gradient-to-r from-transparent via-[#F5B400] to-transparent animate-hero-line-1" />
        <div className="absolute top-[60%] -right-20 w-[400px] h-[1px] bg-gradient-to-r from-transparent via-[#F5B400] to-transparent animate-hero-line-2" />
        <div className="absolute bottom-[30%] left-[10%] w-[300px] h-[1px] bg-gradient-to-r from-transparent via-[#FAF7EA] to-transparent animate-hero-line-3" />
      </div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10 w-full py-20 md:py-28 lg:py-32">
        <div className="max-w-2xl space-y-8">
          
          {/* Tag badge */}
          <div className="animate-hero-fade-up" style={{ animationDelay: '0.2s' }}>
            <span className="inline-block bg-[#F5B400] text-[#1A3C2E] text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 shadow-lg">
              OFFICIAL HUB
            </span>
          </div>

          {/* Main heading */}
          <h1 className="font-sans font-extrabold text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[0.88] tracking-tighter uppercase italic text-white animate-hero-fade-up" style={{ animationDelay: '0.4s' }}>
            Code.<br />
            Create.<br />
            <span className="text-[#F5B400]">Connect.</span>
          </h1>

          {/* Description */}
          <p className="max-w-lg text-[#FAF7EA]/80 font-sans text-sm md:text-base leading-relaxed animate-hero-fade-up" style={{ animationDelay: '0.6s' }}>
            The central platform for all College of Computing and Information Sciences student initiatives, announcements, events, and dynamic representative helpdesks.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-start gap-4 animate-hero-fade-up" style={{ animationDelay: '0.8s' }}>
            <button
              onClick={onAnnouncementsClick}
              className="bg-[#F5B400] text-[#1A3C2E] hover:bg-[#ffc522] px-7 py-3 text-xs font-black uppercase tracking-widest transition-all duration-300 shadow-lg hover:shadow-xl cursor-pointer"
              id="hero-cta-announcements"
            >
              EXPLORE BULLETINS
            </button>
            
            <button
              onClick={onLearnMoreClick}
              className="border border-white/30 text-white/80 hover:text-white hover:border-white/60 px-6 py-3 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all duration-300 cursor-pointer backdrop-blur-sm"
              id="hero-cta-learn-more"
            >
              About the Council <ArrowRight size={13} />
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/10 animate-hero-fade-up" style={{ animationDelay: '1s' }}>
            <div>
              <span className="block font-black text-2xl md:text-3xl text-[#F5B400]">100%</span>
              <span className="text-[10px] uppercase tracking-wider text-[#FAF7EA]/50 font-black">Student Service</span>
            </div>
            <div>
              <span className="block font-black text-2xl md:text-3xl text-[#F5B400]">4+</span>
              <span className="text-[10px] uppercase tracking-wider text-[#FAF7EA]/50 font-black">Committees</span>
            </div>
            <div>
              <span className="block font-black text-2xl md:text-3xl text-[#F5B400]">1.5k+</span>
              <span className="text-[10px] uppercase tracking-wider text-[#FAF7EA]/50 font-black">CCIS Tigers</span>
            </div>
          </div>
        </div>
      </div>

      {/* Image indicator dots */}
      <div className="absolute bottom-8 right-8 z-10 flex items-center gap-2">
        {HERO_IMAGES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentImage(idx)}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
              currentImage === idx
                ? 'bg-[#F5B400] scale-125 shadow-lg shadow-[#F5B400]/40'
                : 'bg-white/40 hover:bg-white/60'
            }`}
            aria-label={`Show hero image ${idx + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
