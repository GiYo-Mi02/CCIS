import React, { useState } from 'react';

interface CouncilSealProps {
  className?: string;
  size?: number;
  interactive?: boolean;
  src?: string;
}

export default function CouncilSeal({ className = '', size = 120, interactive = true, src = '/images/CCIS-Logo.png' }: CouncilSealProps) {
  const [hasFailed, setHasFailed] = useState(false);

  if (!hasFailed) {
    return (
      <img
        src={src}
        alt="CCIS Logo Seal"
        style={{ width: size, height: size }}
        onError={() => setHasFailed(true)}
        className={`object-contain select-none transition-transform duration-500 rounded-full ${
          interactive ? 'hover:scale-105 hover:rotate-3' : ''
        } ${className}`}
        id="ccis-council-logo-img"
        referrerPolicy="no-referrer"
      />
    );
  }

  // Geometric CSS fallback
  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-full bg-[#1A3C2E] border-2 border-[#F5B400] text-[#FAF7EA] flex flex-col items-center justify-center font-sans shadow-lg select-none transition-all duration-300 ${
        interactive ? 'hover:scale-105 hover:rotate-3' : ''
      } ${className}`}
      id="ccis-council-seal-fallback"
    >
      <div className="flex flex-col items-center justify-center text-center p-1">
        <span className="font-sans font-black uppercase text-[#F5B400] tracking-tighter leading-none" style={{ fontSize: Math.max(8, size * 0.16) }}>
          CCIS
        </span>
        <span className="font-mono uppercase text-[#FAF7EA]/80 font-black tracking-widest leading-none mt-1" style={{ fontSize: Math.max(5, size * 0.07) }}>
          COUNCIL
        </span>
      </div>
    </div>
  );
}
