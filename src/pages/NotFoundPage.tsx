import React from 'react';
import { ShieldAlert, Home, MessageSquare, ArrowLeft } from 'lucide-react';

interface NotFoundPageProps {
  onNavigate: (tab: string) => void;
}

export default function NotFoundPage({ onNavigate }: NotFoundPageProps) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16 bg-[#FAF7EA] font-sans">
      <div className="max-w-lg w-full text-center space-y-8 bg-white p-8 md:p-12 rounded-3xl border border-[#1A3C2E]/10 shadow-xl relative overflow-hidden animate-fade-in">
        
        {/* Decorative background glow */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-[#F5B400]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-[#1A3C2E]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Crest Icon */}
        <div className="relative mx-auto w-24 h-24 rounded-3xl bg-[#1A3C2E] text-[#F5B400] flex items-center justify-center shadow-lg border-2 border-[#F5B400]/30 group hover:scale-105 transition-transform duration-300">
          <ShieldAlert size={48} className="animate-pulse" />
          <span className="absolute -bottom-2 -right-2 bg-[#F5B400] text-[#1A3C2E] text-[10px] font-black font-mono px-2 py-0.5 rounded-full uppercase tracking-wider border border-[#1A3C2E]">
            404
          </span>
        </div>

        {/* 404 Header Text */}
        <div className="space-y-3">
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-[#5E6E64] font-bold block">
            HTTP Error 404 — Page Not Found
          </span>
          <h1 className="text-3xl md:text-4xl font-black text-[#1A3C2E] tracking-tight leading-tight">
            Lost in the Council Archives?
          </h1>
          <p className="text-stone-600 text-sm md:text-base leading-relaxed max-w-md mx-auto">
            The page or route you are attempting to access does not exist, may have been moved, or requires elevated access privileges.
          </p>
        </div>

        {/* Recommended Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className="w-full sm:w-auto bg-[#1A3C2E] hover:bg-[#123524] text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            <Home size={16} /> Return to Home
          </button>
          
          <button
            onClick={() => onNavigate('messages')}
            className="w-full sm:w-auto bg-stone-100 hover:bg-stone-200 text-[#1A3C2E] border border-stone-200 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <MessageSquare size={16} /> Contact Support Desk
          </button>
        </div>

        {/* Sub-footer Note */}
        <div className="pt-6 border-t border-stone-100 text-[11px] text-stone-400 font-mono flex items-center justify-center gap-1.5">
          <span>CCIS Student Council System</span>
          <span>•</span>
          <span>UMak CIC Platform</span>
        </div>

      </div>
    </div>
  );
}
