import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Github, Linkedin, Mail, Code, ShieldCheck, X, Sparkles, CheckCircle2 } from 'lucide-react';

// ============================================================================
// DEVELOPER INFO CONFIGURATION
// You can edit the developer names, descriptions, quotes, and links below.
// ============================================================================

interface Developer {
  name: string;
  role: string;
  initials: string;
  department: string;
  quote: string;
  email: string;
  github: string;
  linkedin: string;
  bio: string;
  contributions: string[];
  tags: string[];
  photoUrl?: string; // Optional: e.g. "images/photo.png" or "https://..."
}

const LEAD_DEVELOPER: Developer = {
  name: "Gio Joshua Gonzales",
  role: "Lead Developer & Architect",
  initials: "GJ",
  department: "ENGINEERING",
  quote: "Designed and engineered the core portal architecture with passion.",
  email: "ggonzales.k12254495@umak.edu.ph",
  github: "https://github.com/GiYo-Mi02",
  linkedin: "#",
  // ==========================================================================
  // HOW TO CHANGE PICTURE:
  // 1. Upload your photo (e.g. "my-avatar.jpg") to the "public/images" directory
  // 2. Change the photoUrl line below to: photoUrl: "images/my-avatar.jpg"
  // ==========================================================================
  photoUrl: "images/Gio.png", 
  bio: "Gio took on the primary responsibility of structuring the CCIS Centralized Portal. From defining the relational database schema in Supabase to engineering real-time synchronization hooks and securing critical endpoints, he focused on building a secure, scalable, and lightning-fast student resource center.",
  tags: ["Full-Stack Dev", "Database Architect", "UI/UX Designer"],
  contributions: [
    "End-to-End System Architecture & Client-Server Integration",
    "Supabase Database Design & Real-Time Syncing Subscriptions",
    "Interactive Academic Calendar Grid & Portal Tooltips",
    "Administrative Operations Dashboard & Moderation Tools",
    "Security Operations (IP banning & profanity filters)"
  ]
};

const QA_DEVELOPER: Developer = {
  name: "John Christoper Diaz",
  role: "Quality Assurance Specialist",
  initials: "QA",
  department: "QA TEAM",
  quote: "Drove comprehensive testing and security audits for stable operations.",
  email: "johnchristoper.diaz@example.com",
  github: "#",
  linkedin: "#",
  // ==========================================================================
  // HOW TO CHANGE PICTURE:
  // 1. Upload your photo (e.g. "qa-avatar.jpg") to the "public/images" directory
  // 2. Change the photoUrl line below to: photoUrl: "images/qa-avatar.jpg"
  // ==========================================================================
  photoUrl: "images/john.jpg", 
  bio: "The QA Specialist ensured the integrity and reliability of the entire platform. By validating student workflows, simulating edge cases in event registration, testing the responsive layouts across multiple device viewports, and checking safety compliance, they guaranteed a bulletproof release.",
  tags: ["Feature Testing", "Performance Audit", "Security QA"],
  contributions: [
    "E2E Student Registration Workflow & Edge Case Validation",
    "Cross-device Compatibility & Mobile UI/UX Responsiveness",
    "Security Auditing & SQL Edge Case Vulnerability Scanning",
    "Performance Benchmarking & Loading Optimization Checks",
    "Email Worker & Background Notification Queue Verification"
  ]
};

export default function DeveloperDedication() {
  const [selectedDev, setSelectedDev] = useState<Developer | null>(null);

  return (
    <section className="py-16 bg-[#FAF7EA]/50 border-b border-[#1A3C2E]/10 font-sans" id="developer-dedication">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Dedication Text, Mission & Tech Stack */}
          <div className="lg:col-span-5 space-y-6 text-left animate-fade-in">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#5E6E64] font-bold">The Engineering Team</span>
            <h2 className="font-serif font-black text-3xl md:text-4xl text-[#1A3C2E] leading-tight">
              Behind the Portal
            </h2>
            <div className="h-1 w-16 bg-[#F5B400] rounded-full" />
            <p className="text-[#5E6E64] text-sm md:text-base leading-relaxed">
              This portal serves as the digital gateway for the College of Computer and Information Sciences student body. Crafted with modern web technologies, it ensures responsive, secure, and intuitive accessibility to college news, transparency records, and organizational events.
            </p>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm flex items-center gap-3">
                <div className="p-2 bg-[#FAF7EA] rounded-lg text-[#F5B400]">
                  <Code size={18} />
                </div>
                <div>
                  <span className="block text-[10px] font-mono text-[#5E6E64] uppercase tracking-wider">BUILT FOR</span>
                  <span className="block font-black text-sm text-[#1A3C2E]">CCIS Students</span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm flex items-center gap-3">
                <div className="p-2 bg-[#FAF7EA] rounded-lg text-[#1A3C2E]">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <span className="block text-[10px] font-mono text-[#5E6E64] uppercase tracking-wider">POWERED BY</span>
                  <span className="block font-black text-sm text-[#1A3C2E]">Coffee and Code</span>
                </div>
              </div>
            </div>

            {/* Tech Stack Badges */}
            <div className="pt-2">
              <span className="block text-xs font-mono text-[#5E6E64] uppercase tracking-wider mb-3">Core Platform Stack</span>
              <div className="flex flex-wrap gap-2">
                {["React 19", "TypeScript", "Vite", "Supabase", "Tailwind CSS v4", "GSAP"].map(tech => (
                  <span key={tech} className="px-3 py-1.5 rounded-xl bg-white text-[#1A3C2E] text-xs font-mono font-medium border border-zinc-100 hover:border-[#F5B400] transition-colors duration-300 cursor-default shadow-sm">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Clickable 3D Officer-Style Cards */}
          <div className="lg:col-span-7 flex flex-wrap gap-6 md:gap-8 justify-center items-center">
            
            {/* Card 1: Lead Developer */}
            <div
              onClick={() => setSelectedDev(LEAD_DEVELOPER)}
              className="relative w-[280px] max-w-[calc(100vw-3rem)] h-[395px] group overflow-visible mt-16 mb-6 flex flex-col justify-end transition-all duration-500 cursor-pointer"
              id="dev-card-lead"
            >
              {/* 1. Offset Angled Accent Border Frame */}
              <div className="absolute inset-x-0 bottom-0 top-10 rounded-3xl border-2 border-[#F5B400]/15 translate-x-3 translate-y-3 -rotate-3 pointer-events-none group-hover:translate-x-0 group-hover:translate-y-0 group-hover:rotate-0 group-hover:border-[#F5B400]/35 transition-all duration-500" />

              {/* 2. Main Skewed/Tilted Background Panel Card with Dynamic Elevation & Ambient Glow */}
              <div className="absolute inset-x-0 bottom-0 top-10 bg-gradient-to-br from-[#163628] via-[#0E2219] to-[#060D0A] rounded-3xl border border-white/10 shadow-2xl group-hover:shadow-[0_30px_60px_rgba(0,0,0,0.6)] group-hover:shadow-[#123524]/30 transition-all duration-500 origin-bottom transform group-hover:scale-[1.02] group-hover:-translate-y-3.5 -rotate-1 group-hover:rotate-0 overflow-hidden" />

              {/* 3. Rotated/Vertical Department Label */}
              <div className="absolute top-16 right-4 font-mono font-black text-[#F5B400]/10 group-hover:text-[#F5B400]/30 text-[9px] uppercase tracking-[0.3em] transition-all duration-500 [writing-mode:vertical-lr] select-none pointer-events-none group-hover:translate-y-2">
                {LEAD_DEVELOPER.department}
              </div>

              {/* 4. Overlapping 3D Pop-out Portrait Frame */}
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[88%] h-[98%] overflow-hidden rounded-2xl border border-white/10 shadow-lg bg-white/5 pointer-events-none z-10 group-hover:shadow-2xl group-hover:scale-106 group-hover:-translate-y-4 group-hover:border-[#F5B400]/30 transition-all duration-500 origin-bottom">
                {LEAD_DEVELOPER.photoUrl ? (
                  <div className="relative w-full h-full">
                    <img 
                      src={LEAD_DEVELOPER.photoUrl} 
                      alt={LEAD_DEVELOPER.name} 
                      className="w-full h-full object-cover select-none" 
                    />
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
                  </div>
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#1A3C2E]/80 to-[#123524] text-[#F5B400] flex flex-col items-center justify-center font-serif font-black text-4xl select-none relative">
                    {LEAD_DEVELOPER.initials}
                    <span className="font-mono text-[9px] font-bold text-[#F5B400]/60 uppercase tracking-widest mt-2 flex items-center gap-1">
                      <Code size={10} /> Lead Dev
                    </span>
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
                  </div>
                )}
              </div>

              {/* 5. Floating Glassmorphic Footer Info Plate */}
              <div className="absolute bottom-4 left-4 right-4 bg-[#07130F]/90 backdrop-blur-md border border-white/10 p-3.5 rounded-2xl z-20 text-left shadow-2xl group-hover:shadow-[0_15px_30px_rgba(0,0,0,0.5)] group-hover:border-[#F5B400]/40 group-hover:-translate-y-4 transition-all duration-500 flex flex-col justify-between">
                <div>
                  <h3 className="font-sans font-black text-white text-xs md:text-sm group-hover:text-[#F5B400] transition-colors leading-tight mb-0.5 truncate">
                    {LEAD_DEVELOPER.name}
                  </h3>
                  <span className="block font-mono text-[8px] md:text-[9px] font-black text-[#F5B400]/80 uppercase tracking-wider leading-none">
                    {LEAD_DEVELOPER.role}
                  </span>
                </div>
                
                {/* Click action indicator */}
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/10">
                  <span className="text-[8px] font-mono text-stone-400 uppercase tracking-wider">Click to view details</span>
                  <Sparkles size={10} className="text-[#F5B400] animate-pulse" />
                </div>
              </div>
            </div>

            {/* Card 2: QA Specialist */}
            <div
              onClick={() => setSelectedDev(QA_DEVELOPER)}
              className="relative w-[280px] max-w-[calc(100vw-3rem)] h-[395px] group overflow-visible mt-16 mb-6 flex flex-col justify-end transition-all duration-500 cursor-pointer"
              id="dev-card-qa"
            >
              {/* 1. Offset Angled Accent Border Frame */}
              <div className="absolute inset-x-0 bottom-0 top-10 rounded-3xl border-2 border-[#F5B400]/15 translate-x-3 translate-y-3 -rotate-3 pointer-events-none group-hover:translate-x-0 group-hover:translate-y-0 group-hover:rotate-0 group-hover:border-[#F5B400]/35 transition-all duration-500" />

              {/* 2. Main Skewed/Tilted Background Panel Card with Dynamic Elevation & Ambient Glow */}
              <div className="absolute inset-x-0 bottom-0 top-10 bg-gradient-to-br from-[#163628] via-[#0E2219] to-[#060D0A] rounded-3xl border border-white/10 shadow-2xl group-hover:shadow-[0_30px_60px_rgba(0,0,0,0.6)] group-hover:shadow-[#123524]/30 transition-all duration-500 origin-bottom transform group-hover:scale-[1.02] group-hover:-translate-y-3.5 -rotate-1 group-hover:rotate-0 overflow-hidden" />

              {/* 3. Rotated/Vertical Department Label */}
              <div className="absolute top-16 right-4 font-mono font-black text-[#F5B400]/10 group-hover:text-[#F5B400]/30 text-[9px] uppercase tracking-[0.3em] transition-all duration-500 [writing-mode:vertical-lr] select-none pointer-events-none group-hover:translate-y-2">
                {QA_DEVELOPER.department}
              </div>

              {/* 4. Overlapping 3D Pop-out Portrait Frame */}
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[88%] h-[98%] overflow-hidden rounded-2xl border border-white/10 shadow-lg bg-white/5 pointer-events-none z-10 group-hover:shadow-2xl group-hover:scale-106 group-hover:-translate-y-4 group-hover:border-[#F5B400]/30 transition-all duration-500 origin-bottom">
                {QA_DEVELOPER.photoUrl ? (
                  <div className="relative w-full h-full">
                    <img 
                      src={QA_DEVELOPER.photoUrl} 
                      alt={QA_DEVELOPER.name} 
                      className="w-full h-full object-cover select-none" 
                    />
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
                  </div>
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#1A3C2E]/80 to-[#123524] text-[#F5B400] flex flex-col items-center justify-center font-serif font-black text-4xl select-none relative">
                    {QA_DEVELOPER.initials}
                    <span className="font-mono text-[9px] font-bold text-[#F5B400]/60 uppercase tracking-widest mt-2 flex items-center gap-1">
                      <ShieldCheck size={10} /> QA Specialist
                    </span>
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
                  </div>
                )}
              </div>

              {/* 5. Floating Glassmorphic Footer Info Plate */}
              <div className="absolute bottom-4 left-4 right-4 bg-[#07130F]/90 backdrop-blur-md border border-white/10 p-3.5 rounded-2xl z-20 text-left shadow-2xl group-hover:shadow-[0_15px_30px_rgba(0,0,0,0.5)] group-hover:border-[#F5B400]/40 group-hover:-translate-y-4 transition-all duration-500 flex flex-col justify-between">
                <div>
                  <h3 className="font-sans font-black text-white text-xs md:text-sm group-hover:text-[#F5B400] transition-colors leading-tight mb-0.5 truncate">
                    {QA_DEVELOPER.name}
                  </h3>
                  <span className="block font-mono text-[8px] md:text-[9px] font-black text-[#F5B400]/80 uppercase tracking-wider leading-none">
                    {QA_DEVELOPER.role}
                  </span>
                </div>
                
                {/* Click action indicator */}
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/10">
                  <span className="text-[8px] font-mono text-stone-400 uppercase tracking-wider">Click to view details</span>
                  <Sparkles size={10} className="text-[#F5B400] animate-pulse" />
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* PORTFOLIO MODAL (Rendered at Root using Portal to avoid animated stacking context bugs) */}
      {selectedDev && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/70 p-3 font-sans backdrop-blur-xs animate-fade-in sm:items-center sm:p-4"
          onClick={() => setSelectedDev(null)}
        >
          <div 
            className="relative my-auto grid max-h-[calc(100svh-1.5rem)] w-full max-w-5xl grid-cols-1 overflow-y-auto rounded-3xl border border-white/10 bg-[#123524] text-[#FAF7EA] shadow-2xl shadow-[0_0_50px_rgba(255,188,0,0.15)] md:max-h-[min(90svh,52rem)] md:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.7fr)] md:overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="developer-modal-title"
          >
            {/* Close Button */}
            <button 
              onClick={() => setSelectedDev(null)}
              className="absolute right-3 top-3 z-20 rounded-full border border-white/20 bg-[#07130F]/80 p-2 text-stone-200 shadow-lg backdrop-blur-sm transition-colors hover:bg-white/15 hover:text-white sm:right-4 sm:top-4"
              aria-label="Close Modal"
            >
              <X size={18} />
            </button>

            {/* Portrait: top on mobile, left on medium and larger screens */}
            <div className="relative min-h-[17rem] overflow-hidden bg-[#07130F] sm:min-h-[22rem] md:min-h-full">
              {selectedDev.photoUrl ? (
                <img
                  src={selectedDev.photoUrl}
                  alt={`${selectedDev.name}, ${selectedDev.role}`}
                  className="absolute inset-0 h-full w-full object-cover object-center"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1A3C2E] to-[#07130F] font-serif text-6xl font-black text-[#FFBC00]">
                  {selectedDev.initials}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#07130F]/90 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#FFBC00]/30 bg-[#123524]/90 px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#FFBC00] backdrop-blur-sm">
                  {selectedDev.department === 'ENGINEERING' ? <Code size={13} /> : <ShieldCheck size={13} />}
                  {selectedDev.department}
                </span>
              </div>
            </div>

            {/* Description and contributions */}
            <div className="relative min-w-0 p-5 sm:p-7 md:max-h-[min(90svh,52rem)] md:overflow-y-auto lg:p-9">
              <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 -translate-y-1/3 translate-x-1/3 rounded-full bg-[#FFBC00]/5 blur-3xl" />

              <div className="border-b border-white/10 pb-5 pr-10 sm:pb-6">
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#FFBC00]">{selectedDev.role}</span>
                <h3 id="developer-modal-title" className="mt-1 font-serif text-2xl font-black leading-tight text-white sm:text-3xl">
                  {selectedDev.name}
                </h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedDev.tags.map(tag => (
                    <span key={tag} className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#FAF7EA]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {selectedDev.quote && (
                  <blockquote className="border-l-4 border-[#FFBC00] pl-4 text-sm italic leading-relaxed text-stone-200 sm:text-base">
                    “{selectedDev.quote}”
                  </blockquote>
                )}
                <p className="text-sm leading-7 text-stone-300 sm:text-base">
                {selectedDev.bio}
                </p>
              </div>

              <div className="mt-7 space-y-3">
                <span className="block font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#FFBC00]">Key Contributions</span>
                <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
                {selectedDev.contributions.map((contrib, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-3 transition-colors hover:border-white/15">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#FFBC00]" />
                      <span className="font-sans text-xs leading-relaxed text-stone-200">{contrib}</span>
                  </div>
                ))}
                </div>
              </div>

              <div className="mt-7 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <a
                  href={`mailto:${selectedDev.email}`}
                  className="flex min-w-0 items-center gap-2 break-all font-mono text-[11px] text-stone-300 transition-colors hover:text-[#FFBC00]"
                >
                  <Mail size={14} className="shrink-0" /> {selectedDev.email}
                </a>
                <div className="flex items-center gap-3">
                  <a
                    href={selectedDev.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2 text-stone-300 shadow-sm transition-all hover:border-[#FFBC00] hover:bg-white/10 hover:text-[#FFBC00]"
                    aria-label="GitHub Profile"
                  >
                    <Github size={14} />
                  </a>
                  <a
                    href={selectedDev.linkedin}
                    className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2 text-stone-300 shadow-sm transition-all hover:border-[#FFBC00] hover:bg-white/10 hover:text-[#FFBC00]"
                    aria-label="LinkedIn Profile"
                  >
                    <Linkedin size={14} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
