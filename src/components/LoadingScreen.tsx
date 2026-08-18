import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

export default function LoadingScreen() {
  const [isComplete, setIsComplete] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('ccis_loader_played') === 'true';
    }
    return false;
  });

  const overlayRef    = useRef<HTMLDivElement>(null);
  const logoRef       = useRef<HTMLDivElement>(null);
  const wordsGroupRef = useRef<HTMLDivElement>(null);
  const word1Ref      = useRef<HTMLSpanElement>(null); // CODE.
  const word2Ref      = useRef<HTMLSpanElement>(null); // CREATE.
  const word3Ref      = useRef<HTMLSpanElement>(null); // CONNECT.
  const barTrackRef   = useRef<HTMLDivElement>(null);
  const barFillRef    = useRef<HTMLDivElement>(null);
  const barPercentRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isComplete) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          gsap.to(overlayRef.current, {
            yPercent: -100,
            duration: 0.75,
            ease: 'power4.inOut',
            onComplete: () => {
              sessionStorage.setItem('ccis_loader_played', 'true');
              setIsComplete(true);
            },
          });
        },
      });

      // ── Initial states ──────────────────────────────────────
      gsap.set(logoRef.current,       { opacity: 0, scale: 0.88, y: 8 });
      gsap.set(wordsGroupRef.current, { opacity: 0, y: 14 });
      gsap.set([word1Ref.current, word2Ref.current, word3Ref.current], { opacity: 0, y: 10 });
      gsap.set(barTrackRef.current,   { opacity: 0, scaleX: 0, transformOrigin: 'left center' });
      gsap.set(barFillRef.current,    { width: '0%' });

      // ── 1) Logo fades in ────────────────────────────────────
      tl.to(logoRef.current, {
        opacity: 1, scale: 1, y: 0,
        duration: 0.6, ease: 'power3.out',
      })

      // ── 2) Bar track reveals ────────────────────────────────
      .to(barTrackRef.current, {
        opacity: 1, scaleX: 1,
        duration: 0.35, ease: 'power2.out',
      }, '-=0.1')

      // ── 3) Bar starts filling (runs in parallel with words) ─
      .to(barFillRef.current, {
        width: '100%',
        duration: 2.8,
        ease: 'power1.inOut',
        onUpdate: function () {
          if (barPercentRef.current) {
            barPercentRef.current.textContent = `${Math.round(this.progress() * 100)}%`;
          }
        },
      }, '<')

      // ── 4) "Code. Create. Connect." words animate in SIMULTANEOUSLY ─
      .to(wordsGroupRef.current, {
        opacity: 1, y: 0,
        duration: 0.3, ease: 'power2.out',
      }, '<')
      .to([word1Ref.current, word2Ref.current, word3Ref.current], {
        opacity: 1, y: 0,
        duration: 0.45,
        stagger: 0.08,
        ease: 'power3.out',
      }, '<+=0.05')

      // ── 5) Words hold then fade out simultaneously ─────────
      .to(wordsGroupRef.current, {
        opacity: 0, y: -10,
        duration: 0.4, ease: 'power2.in',
      }, '+=0.85')

      // ── 6) Loading remains with ONLY CCIS Logo visible until 100% complete ─
      .to({}, { duration: 0.5 });
    });

    return () => ctx.revert();
  }, [isComplete]);

  if (isComplete) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#1A3C2E] select-none overflow-hidden pointer-events-auto"
      id="ccis-loading-screen"
    >
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(245,180,0,0.07) 0%, transparent 70%)',
        }}
      />

      {/* Decorative rings */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[72vh] h-[72vh] border-[2px] border-[#F5B400] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[52vh] h-[52vh] border-[1.5px] border-[#F5B400] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[34vh] h-[34vh] border border-[#FAF7EA] rounded-full" />
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 flex flex-col items-center gap-6 sm:gap-8 w-full max-w-[360px] sm:max-w-[480px] px-6">

        {/* Logo */}
        <div ref={logoRef} className="opacity-0">
          <img
            src="/images/ccis_logo.jpg"
            alt="CCIS Logo"
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover shadow-2xl ring-2 ring-[#F5B400]/40"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Simultaneous Words Container */}
        <div className="h-12 flex items-center justify-center w-full">
          <div
            ref={wordsGroupRef}
            className="opacity-0 flex items-center justify-center gap-2 sm:gap-3 text-center flex-wrap"
          >
            <span
              ref={word1Ref}
              className="text-[#FAF7EA] font-extrabold italic uppercase tracking-tight text-xl sm:text-3xl leading-none"
            >
              Code.
            </span>
            <span
              ref={word2Ref}
              className="text-[#F5B400] font-extrabold italic uppercase tracking-tight text-xl sm:text-3xl leading-none"
            >
              Create.
            </span>
            <span
              ref={word3Ref}
              className="text-[#FAF7EA] font-extrabold italic uppercase tracking-tight text-xl sm:text-3xl leading-none"
            >
              Connect.
            </span>
          </div>
        </div>

        {/* Loading bar */}
        <div className="w-full flex flex-col items-end gap-[5px]">
          <span
            ref={barPercentRef}
            className="text-[#F5B400]/60 text-[10px] font-mono font-semibold tabular-nums"
          >
            0%
          </span>

          {/* Track */}
          <div
            ref={barTrackRef}
            className="w-full h-[3px] rounded-full overflow-hidden opacity-0"
            style={{ background: 'rgba(250,247,234,0.12)' }}
          >
            {/* Fill */}
            <div
              ref={barFillRef}
              className="h-full rounded-full"
              style={{
                width: '0%',
                background: 'linear-gradient(90deg, #b07e00 0%, #F5B400 55%, #ffe168 100%)',
                boxShadow: '0 0 10px rgba(245,180,0,0.55)',
              }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

