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
  const word1Ref      = useRef<HTMLDivElement>(null); // CODE.
  const word2Ref      = useRef<HTMLDivElement>(null); // CREATE.
  const word3Ref      = useRef<HTMLDivElement>(null); // CONNECT.
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
      gsap.set(logoRef.current,   { opacity: 0, scale: 0.88, y: 8 });
      gsap.set(word1Ref.current,  { opacity: 0, y: 20 });
      gsap.set(word2Ref.current,  { opacity: 0, y: 20 });
      gsap.set(word3Ref.current,  { opacity: 0, y: 20 });
      gsap.set(barTrackRef.current, { opacity: 0, scaleX: 0, transformOrigin: 'left center' });
      gsap.set(barFillRef.current,  { width: '0%' });

      // ── 1) Logo fades in ────────────────────────────────────
      tl.to(logoRef.current, {
        opacity: 1, scale: 1, y: 0,
        duration: 0.7, ease: 'power3.out',
      })

      // ── 2) Bar track reveals ────────────────────────────────
      .to(barTrackRef.current, {
        opacity: 1, scaleX: 1,
        duration: 0.4, ease: 'power2.out',
      }, '-=0.1')

      // ── 3) Bar starts filling (runs in parallel with words) ─
      .to(barFillRef.current, {
        width: '100%',
        duration: 3.0,           // covers the 3 words × ~1s each
        ease: 'linear',
        onUpdate: function () {
          if (barPercentRef.current) {
            barPercentRef.current.textContent = `${Math.round(this.progress() * 100)}%`;
          }
        },
      }, '+=0.05')

      // ── 4) CODE. — in then out ──────────────────────────────
      .to(word1Ref.current, {
        opacity: 1, y: 0,
        duration: 0.45, ease: 'power3.out',
      }, '<')                    // start same time as bar fill
      .to(word1Ref.current, {
        opacity: 0, y: -14,
        duration: 0.35, ease: 'power2.in',
      }, '+=0.65')               // hold ~0.65s then fade out

      // ── 5) CREATE. — in then out ────────────────────────────
      .to(word2Ref.current, {
        opacity: 1, y: 0,
        duration: 0.45, ease: 'power3.out',
      }, '+=0.1')
      .to(word2Ref.current, {
        opacity: 0, y: -14,
        duration: 0.35, ease: 'power2.in',
      }, '+=0.65')

      // ── 6) CONNECT. — in then out ───────────────────────────
      .to(word3Ref.current, {
        opacity: 1, y: 0,
        duration: 0.45, ease: 'power3.out',
      }, '+=0.1')
      .to(word3Ref.current, {
        opacity: 0, y: -14,
        duration: 0.35, ease: 'power2.in',
      }, '+=0.65')

      // ── 7) Brief hold before exit ────────────────────────────
      .to({}, { duration: 0.25 });
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
      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-[300px] px-6">

        {/* Logo */}
        <div ref={logoRef} className="opacity-0">
          <img
            src="/images/ccis_logo.jpg"
            alt="CCIS Logo"
            className="w-28 h-28 rounded-full object-cover shadow-2xl ring-2 ring-[#F5B400]/40"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Cycling word area — fixed height so layout doesn't jump */}
        <div className="relative h-[clamp(3rem,9vw,5.5rem)] w-full flex items-center justify-center">

          {/* CODE. */}
          <div
            ref={word1Ref}
            className="absolute inset-0 flex items-center justify-center opacity-0
                       text-[#FAF7EA] font-extrabold italic uppercase tracking-tight
                       text-[clamp(2.8rem,8.5vw,5rem)] leading-none"
          >
            Code.
          </div>

          {/* CREATE. */}
          <div
            ref={word2Ref}
            className="absolute inset-0 flex items-center justify-center opacity-0
                       text-[#F5B400] font-extrabold italic uppercase tracking-tight
                       text-[clamp(2.8rem,8.5vw,5rem)] leading-none"
          >
            Create.
          </div>

          {/* CONNECT. */}
          <div
            ref={word3Ref}
            className="absolute inset-0 flex items-center justify-center opacity-0
                       text-[#FAF7EA] font-extrabold italic uppercase tracking-tight
                       text-[clamp(2.8rem,8.5vw,5rem)] leading-none"
          >
            Connect.
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
