import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

export default function LoadingScreen() {
  const [isComplete, setIsComplete] = useState(() => {
    // Check if the animation has already played in this browser session
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('ccis_loader_played') === 'true';
    }
    return false;
  });

  const overlayRef = useRef<HTMLDivElement>(null);
  const word1Ref = useRef<HTMLDivElement>(null);
  const word2Ref = useRef<HTMLDivElement>(null);
  const word3Ref = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isComplete) return;

    // Create GSAP context for clean resource cleanup on component unmount
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          // Slide-up exit transition of the entire loading overlay
          gsap.to(overlayRef.current, {
            yPercent: -100,
            duration: 0.8,
            ease: 'power4.inOut',
            onComplete: () => {
              sessionStorage.setItem('ccis_loader_played', 'true');
              setIsComplete(true);
            },
          });
        },
      });

      // Unified transition speeds and easing curves
      const easeIn = 'power3.out';
      const easeOut = 'power2.in';

      // Set initial values
      gsap.set(lineRef.current, { top: '38.5%', width: '0%', opacity: 0 });
      gsap.set(word1Ref.current, { opacity: 0, y: 30 });
      gsap.set(word2Ref.current, { opacity: 0, y: 30 });
      gsap.set(word3Ref.current, { opacity: 0, y: 30 });
      gsap.set(logoRef.current, { opacity: 0, scale: 0.95 });

      // ==========================================
      // WAYPOINT 1 — "LEAD." (Top Zone)
      // ==========================================
      tl.to(logoRef.current, {
        opacity: 1,
        scale: 1,
        duration: 1.0,
        ease: 'power3.out'
      })
      .to(lineRef.current, { 
        top: '43.6%', 
        opacity: 1, 
        width: '22%', 
        duration: 0.6, 
        ease: easeIn 
      }, '-=0.6')
      .to(word1Ref.current, { 
        opacity: 1, 
        y: 0, 
        duration: 0.6, 
        ease: easeIn 
      }, '-=0.4')
      .to(word1Ref.current, { 
        opacity: 0, 
        y: -15, 
        duration: 0.4, 
        ease: easeOut 
      }, '+=0.6'); // Hold focus for 0.6 seconds

      // ==========================================
      // WAYPOINT 2 — "CREATE" (Middle Zone)
      // ==========================================
      // Travel the horizontal line down and expand it slightly wider
      tl.to(lineRef.current, { 
        top: '61.5%', 
        width: '32%', 
        duration: 0.6, 
        ease: 'power3.inOut' 
      })
      .to(word2Ref.current, { 
        opacity: 1, 
        y: 0, 
        duration: 0.6, 
        ease: easeIn 
      }, '-=0.2')
      .to(word2Ref.current, { 
        opacity: 0, 
        y: -15, 
        duration: 0.4, 
        ease: easeOut 
      }, '+=0.6'); // Hold focus for 0.6 seconds

      // ==========================================
      // WAYPOINT 3 — "CONNECT" (Bottom Zone)
      // ==========================================
      // Travel the horizontal line down and adjust width
      tl.to(lineRef.current, { 
        top: '81.5%', 
        width: '28%', 
        duration: 0.6, 
        ease: 'power3.inOut' 
      })
      .to(word3Ref.current, { 
        opacity: 1, 
        y: 0, 
        duration: 0.6, 
        ease: easeIn 
      }, '-=0.2')
      .to(word3Ref.current, { 
        opacity: 0, 
        y: -15, 
        duration: 0.4, 
        ease: easeOut 
      }, '+=0.6')
      .to(lineRef.current, { 
        opacity: 0, 
        width: '0%', 
        duration: 0.4, 
        ease: easeOut 
      }, '-=0.4')
      .to(logoRef.current, {
        opacity: 0,
        scale: 0.95,
        duration: 0.4,
        ease: easeOut
      }, '-=0.4'); // Shrink and fade the traveling line and logo with the final word

    });

    return () => ctx.revert();
  }, [isComplete]);

  if (isComplete) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex flex-col justify-center items-center bg-[#1A3C2E] select-none overflow-hidden pointer-events-auto"
      id="ccis-loading-screen"
    >
      {/* Background radial visual highlights */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vh] h-[80vh] border-[3px] border-[#F5B400] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vh] h-[60vh] border-[1.5px] border-[#F5B400] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vh] h-[40vh] border-[1px] border-[#FAF7EA] rounded-full" />
      </div>

      {/* CCIS Council Logo Watermark (centered in background) */}
      <div
        ref={logoRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none select-none opacity-0"
      >
        <img
          src="/images/ccis_logo.jpg"
          alt="CCIS Logo Watermark"
          className="w-[45vh] h-[45vh] max-w-[320px] max-h-[320px] rounded-full object-cover opacity-[0.06] border border-[#FAF7EA]/5 shadow-2xl"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Traveling Horizontal Gold Divider */}
      <div
        ref={lineRef}
        className="absolute left-1/2 -translate-x-1/2 h-[2px] bg-[#F5B400] opacity-0 pointer-events-none rounded-full"
      />

      {/* Waypoint 1: CODE. */}
      <div
        ref={word1Ref}
        className="absolute left-0 right-0 text-center top-[28%] text-[#FAF7EA] font-sans font-extrabold text-[clamp(3rem,8.5vw,6.5rem)] tracking-tighter uppercase italic leading-none opacity-0 select-none"
      >
        CODE.
      </div>

      {/* Waypoint 2: CREATE */}
      <div
        ref={word2Ref}
        className="absolute left-0 right-0 text-center top-[48%] text-[#FAF7EA] font-sans font-extrabold text-[clamp(3rem,8.5vw,6.5rem)] tracking-tighter uppercase italic leading-none opacity-0 select-none"
      >
        CREATE.
      </div>

      {/* Waypoint 3: CONNECT */}
      <div
        ref={word3Ref}
        className="absolute left-0 right-0 text-center top-[68%] text-[#F5B400] font-sans font-extrabold text-[clamp(3rem,8.5vw,6.5rem)] tracking-tighter uppercase italic leading-none opacity-0 select-none"
      >
        CONNECT.
      </div>
    </div>
  );
}
