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
  email: "giojoshua.gonzales@example.com",
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
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-fade-in font-sans"
          onClick={() => setSelectedDev(null)}
        >
          <div 
            className="bg-[#123524] text-[#FAF7EA] max-w-xl w-full rounded-3xl p-6 md:p-8 relative shadow-2xl border border-white/10 overflow-hidden shadow-[0_0_50px_rgba(245,180,0,0.15)] flex flex-col gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Ambient Glow Overlay */}
            <div className="absolute top-0 right-0 -mt-16 -mr-16 w-48 h-48 bg-[#F5B400]/5 rounded-full blur-3xl pointer-events-none" />
            
            {/* Close Button */}
            <button 
              onClick={() => setSelectedDev(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 border border-white/10 text-stone-300 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close Modal"
            >
              <X size={18} />
            </button>

            {/* Header Content inside Modal */}
            <div className="flex items-center gap-4 border-b border-white/10 pb-5">
              {selectedDev.photoUrl ? (
                <div className="w-16 h-16 rounded-2xl overflow-hidden border border-[#F5B400]/30 shrink-0">
                  <img src={selectedDev.photoUrl} alt={selectedDev.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#1A3C2E] to-[#123524] flex items-center justify-center text-[#F5B400] font-serif text-2xl font-bold shadow-inner relative border border-[#F5B400]/30 shrink-0">
                  {selectedDev.initials}
                </div>
              )}
              <div>
                <h3 className="font-sans font-black text-xl text-[#F5B400]">{selectedDev.name}</h3>
                <p className="text-xs font-mono font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                  {selectedDev.department === 'ENGINEERING' ? <Code size={12} /> : <ShieldCheck size={12} />}
                  {selectedDev.role}
                </p>
              </div>
            </div>

            {/* Bio & Quote */}
            <div className="space-y-4">
              {selectedDev.quote && (
                <div className="border-l-4 border-[#F5B400] pl-4 italic text-stone-300 text-sm md:text-base leading-relaxed">
                  "{selectedDev.quote}"
                </div>
              )}
              <p className="text-stone-300 text-sm leading-relaxed">
                {selectedDev.bio}
              </p>
            </div>

            {/* Key Contributions */}
            <div className="space-y-3">
              <span className="block text-[10px] font-mono font-black text-[#F5B400] uppercase tracking-wider">Key Contributions</span>
              <div className="grid grid-cols-1 gap-2.5">
                {selectedDev.contributions.map((contrib, idx) => (
                  <div key={idx} className="flex gap-3 bg-white/5 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors items-start">
                    <CheckCircle2 size={16} className="text-[#F5B400] shrink-0 mt-0.5" />
                    <span className="text-xs text-stone-200 leading-relaxed font-sans">{contrib}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact / Social links */}
            <div className="flex items-center justify-between border-t border-white/10 pt-5 mt-2">
              <a
                href={`mailto:${selectedDev.email}`}
                className="font-mono text-xs text-stone-300 hover:text-[#F5B400] transition-colors flex items-center gap-2"
              >
                <Mail size={14} /> {selectedDev.email}
              </a>
              
              <div className="flex items-center gap-3">
                <a
                  href={selectedDev.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white/5 border border-white/10 text-stone-300 hover:text-[#F5B400] hover:bg-white/10 hover:border-[#F5B400] transition-all flex items-center justify-center shadow-sm"
                  aria-label="GitHub Profile"
                >
                  <Github size={14} />
                </a>
                <a
                  href={selectedDev.linkedin}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 text-stone-300 hover:text-[#F5B400] hover:bg-white/10 hover:border-[#F5B400] transition-all flex items-center justify-center shadow-sm"
                  aria-label="LinkedIn Profile"
                >
                  <Linkedin size={14} />
                </a>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
