import React, { useState, useEffect } from 'react';
import { 
  Shield, Sparkles, Code, BookOpen, Trophy, Palette, Calendar, 
  AlertCircle, CheckCircle2, List, ChevronDown, Award,
  ClipboardList, Coins, Archive, Cpu, Globe, Heart, Megaphone
} from 'lucide-react';
import { Officer, Committee } from '../types';
import CouncilSeal from './CouncilSeal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';


const ROLE_SUMMARIES: Record<string, string> = {
  'Chairperson': 'Presides over council meetings and represents CCIS SC.',
  'Vice Chairperson': 'Assists the Chairperson and assumes duties when needed.',
  'Secretary': 'Takes minutes and safekeeps council records.',
  'Treasurer': 'Collects and manages council funds.',
  'Auditor': 'Audits financial statements and tracks council equipment.',
  '4th Year Representative': "Represents their year level in the Student Representatives' Assembly.",
  '3rd Year Representative': "Represents their year level in the Student Representatives' Assembly.",
  '2nd Year Representative': "Represents their year level in the Student Representatives' Assembly."
};

export default function InfoHub({ onNavigate }: { onNavigate?: (tab: string, eventId?: string) => void }) {
  const { user, profile } = useAuth();
  const [activeCommitteeTab, setActiveCommitteeTab] = useState<string>('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [activeInfoTab, setActiveInfoTab] = useState<'college' | 'council' | 'compsoc'>('college');
  
  // Dynamic database collections
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [offRes, commRes] = await Promise.all([
        supabase.from('officers').select('*, committees(name, slug)').order('display_order'),
        supabase.from('committees').select('*').order('display_order')
      ]);

      if (commRes.data && commRes.data.length > 0) {
        const mappedComm = commRes.data.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description || '',
          head: c.head_name || 'Committee Head',
          responsibilities: c.responsibilities || []
        }));
        setCommittees(mappedComm);
        setActiveCommitteeTab(mappedComm[0].id);
      }

      if (offRes.data) {
        setOfficers(offRes.data.map((o: any) => ({
          id: o.id,
          name: o.name,
          position: o.position,
          committee: o.committees?.name || 'Executive Board',
          photoUrl: o.photo_url || '',
          email: o.email,
          order: o.display_order,
          quote: o.quote || ''
        })));
      }
      setLoading(false);
    };

    fetchData();
  }, []);



  const getCommitteeIcon = (slug: string) => {
    switch (slug) {
      case 'logistics': return <ClipboardList className="text-[#F5B400]" size={20} />;
      case 'finance': return <Coins className="text-[#F5B400]" size={20} />;
      case 'inventory': return <Archive className="text-[#F5B400]" size={20} />;
      case 'technical': return <Cpu className="text-[#F5B400]" size={20} />;
      case 'external-affairs': return <Globe className="text-[#F5B400]" size={20} />;
      case 'advertising': return <Megaphone className="text-[#F5B400]" size={20} />;
      case 'developers': return <Code className="text-[#F5B400]" size={20} />;
      case 'welfare': return <Heart className="text-[#F5B400]" size={20} />;
    }
  };

  if (loading) {
    return (
      <div className="bg-[#FAF7EA] min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#F5B400] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Identify podium officers
  const chairperson = officers.find(o => {
    const pos = o.position.toLowerCase().replace(/\s+/g, ' ').trim();
    return pos === 'chairperson' || pos === 'president';
  });

  const viceChair = officers.find(o => {
    const pos = o.position.toLowerCase().replace(/\s+/g, ' ').trim();
    return pos === 'vice chairperson' || pos === 'vice president';
  });

  const secretary = officers.find(o => {
    const pos = o.position.toLowerCase().replace(/\s+/g, ' ').trim();
    return pos === 'secretary';
  });

  // Filter out podium officers from the remaining list
  const remainingOfficers = officers.filter(
    o => o.id !== chairperson?.id && o.id !== viceChair?.id && o.id !== secretary?.id
  );

  return (
    <div className="bg-[#FAF7EA] min-h-screen font-sans text-stone-800" id="info-hub-section">
      
      {/* 4.4.1 About/Council Mission Block */}
      {/* 4.4.1 About/Council Mission Block */}
      <section className="py-16 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8 border-b border-[#1A3C2E]/10" id="about-mission">
        
        {/* Dynamic Header & Row of Logos */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 border-b border-[#1A3C2E]/10 pb-8 mb-8 text-left">
          {/* Left: Section Header Part */}
          <div className="space-y-2 lg:max-w-2xl">
            {activeInfoTab === 'college' && (
              <div className="animate-fade-in">
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#5E6E64] font-bold">University of Makati</span>
                <h2 className="font-sans font-black text-3xl md:text-5xl text-[#1A3C2E] leading-tight">
                  College of Computing and Information Sciences
                </h2>
                <span className="block italic text-stone-500 text-xs md:text-sm font-semibold mt-1">
                  (formerly College of Computer Science)
                </span>
              </div>
            )}
            {activeInfoTab === 'council' && (
              <div className="animate-fade-in">
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#5E6E64] font-bold">About CCIS SC</span>
                <h2 className="font-sans font-black text-3xl md:text-5xl text-[#1A3C2E] leading-tight">
                  A Legacy of Technical Excellence and Devoted Governance
                </h2>
              </div>
            )}
            {activeInfoTab === 'compsoc' && (
              <div className="animate-fade-in">
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#5E6E64] font-bold">Local Organization</span>
                <h2 className="font-sans font-black text-3xl md:text-5xl text-[#1A3C2E] leading-tight">
                  Computer Society (ComSoc)
                </h2>
              </div>
            )}
            <div className="h-1 w-20 bg-[#F5B400] rounded-full mt-3" />
          </div>

          {/* Right: Logos in a Row */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl shadow-xs border border-[#1A3C2E]/5 self-start lg:self-center">
            {/* CCIS Logo */}
            <div 
              onClick={() => setActiveInfoTab('college')}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer hover:bg-[#FAF7EA]/50 ${
                activeInfoTab === 'college' ? 'ring-2 ring-[#F5B400] bg-[#FAF7EA]/30' : ''
              }`}
            >
              <img src="/images/CCIS-Logo.png" alt="CCIS Logo" className="w-10 h-10 md:w-12 md:h-12 object-contain" />
              <div className="text-left">
                <span className="block text-[10px] font-black text-[#1A3C2E] leading-tight">CCIS</span>
                <span className="block text-[7px] font-mono text-stone-400 uppercase tracking-wider mt-0.5">College Seal</span>
              </div>
            </div>
            {/* Student Council Logo */}
            <div 
              onClick={() => setActiveInfoTab('council')}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer hover:bg-[#FAF7EA]/50 ${
                activeInfoTab === 'council' ? 'ring-2 ring-[#F5B400] bg-[#FAF7EA]/30' : ''
              }`}
            >
              <img src="/images/ccis_logo.jpg" alt="Student Council Logo" className="w-10 h-10 md:w-12 md:h-12 object-contain rounded-full" />
              <div className="text-left">
                <span className="block text-[10px] font-black text-[#1A3C2E] leading-tight">Student Council</span>
                <span className="block text-[7px] font-mono text-stone-400 uppercase tracking-wider mt-0.5">Mother Org</span>
              </div>
            </div>
            {/* Computer Society Logo */}
            <div 
              onClick={() => setActiveInfoTab('compsoc')}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer hover:bg-[#FAF7EA]/50 ${
                activeInfoTab === 'compsoc' ? 'ring-2 ring-[#F5B400] bg-[#FAF7EA]/30' : ''
              }`}
            >
              <img src="/images/Computer-Society.png" alt="ComSoc Logo" className="w-10 h-10 md:w-12 md:h-12 object-contain rounded-full" />
              <div className="text-left">
                <span className="block text-[10px] font-black text-[#1A3C2E] leading-tight">ComSoc</span>
                <span className="block text-[7px] font-mono text-stone-400 uppercase tracking-wider mt-0.5">Local Org</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Tab Content (Full Width) */}
        <div className="w-full">
          {activeInfoTab === 'college' && (
            <div className="space-y-8 animate-fade-in text-left">
              {/* Welcome box */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#1A3C2E]/5 shadow-sm space-y-4">
                <h4 className="font-sans font-black text-base md:text-xl text-[#1A3C2E] uppercase tracking-wider">
                  Welcome to College of Computing and Information Sciences!
                </h4>
                <p className="text-sm md:text-lg text-[#5E6E64] leading-relaxed">
                  The College of Computing and Information Sciences (CCIS) is the leading college in ICT education programs of the university by providing competitive, relevant and functional IT Curriculum responsive to the needs of the industrial and business organizations. The college has the following functions:
                </p>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-sm md:text-base text-[#5E6E64] list-disc list-inside">
                  <li>Develop, implement and revise IT Education Programs.</li>
                  <li>Subject IT Programs to recognition and accreditation.</li>
                  <li>Provide creativity and development programs.</li>
                  <li>Engage in IT and Computer Science research.</li>
                  <li>Promote ICT literacy through community service.</li>
                  <li>Establish linkages and networking with industry.</li>
                  <li>Provide administrative services to stakeholders.</li>
                  <li>Engage in curricular and extra-curricular endeavors.</li>
                </ul>
              </div>

              {/* Vision & Mission Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
                  <span className="block text-sm md:text-base font-mono font-bold text-[#F5B400] uppercase tracking-wider mb-2">Vision</span>
                  <p className="text-sm md:text-base text-[#5E6E64] leading-relaxed">
                    The college envisions to lead in the development of excellent professionals and champions of social equity in the global field of computing and information sciences.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
                  <span className="block text-sm md:text-base font-mono font-bold text-[#F5B400] uppercase tracking-wider mb-2">Mission</span>
                  <p className="text-sm md:text-base text-[#5E6E64] leading-relaxed">
                    Guided by its vision, the college produces practitioners and leaders in computing and information sciences who are resilient, industry-ready, and socially responsible through innovative curriculum design and dynamic delivery systems.
                  </p>
                </div>
              </div>

              {/* Core Values & Program Offerings Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Core Values */}
                <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-zinc-100 shadow-sm space-y-4">
                  <span className="block text-sm md:text-base font-mono font-bold text-[#1A3C2E] uppercase tracking-wider border-b border-zinc-50 pb-2">Core Values</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="text-sm md:text-base">
                      <strong className="text-[#1A3C2E] block">God Fearing</strong>
                      <span className="text-stone-500 text-xs md:text-sm leading-snug block mt-0.5">Reverence and moral uprightness.</span>
                    </div>
                    <div className="text-sm md:text-base">
                      <strong className="text-[#1A3C2E] block">Industry</strong>
                      <span className="text-stone-500 text-xs md:text-sm leading-snug block mt-0.5">Diligence in pursuing tasks.</span>
                    </div>
                    <div className="text-sm md:text-base">
                      <strong className="text-[#1A3C2E] block">Fortitude</strong>
                      <span className="text-stone-500 text-xs md:text-sm leading-snug block mt-0.5">Courage and strength in character.</span>
                    </div>
                    <div className="text-sm md:text-base">
                      <strong className="text-[#1A3C2E] block">Trustworthy</strong>
                      <span className="text-stone-500 text-xs md:text-sm leading-snug block mt-0.5">Deserving of confidence.</span>
                    </div>
                    <div className="text-sm md:text-base">
                      <strong className="text-[#1A3C2E] block">Creativity</strong>
                      <span className="text-stone-500 text-xs md:text-sm leading-snug block mt-0.5">Ability to make new ideas.</span>
                    </div>
                  </div>
                </div>

                {/* Offerings */}
                <div className="lg:col-span-5 bg-white p-6 sm:p-8 rounded-3xl border border-zinc-100 shadow-sm space-y-4">
                  <span className="block text-sm md:text-base font-mono font-bold text-[#1A3C2E] uppercase tracking-wider border-b border-zinc-50 pb-2">Program Offerings</span>
                  <div className="space-y-4">
                    <div className="text-sm md:text-base">
                      <span className="font-bold text-[#1A3C2E] block mb-1">Baccalaureate Programs</span>
                      <ul className="list-disc list-inside text-stone-500 text-xs md:text-sm space-y-1">
                        <li>B.S. in Information Technology (INS Track)</li>
                        <li>B.S. in Computer Science (CDS Track)</li>
                        <li>B.S. in Computer Science (AppDev Track)</li>
                      </ul>
                    </div>
                    <div className="text-sm md:text-base border-t border-zinc-50 pt-2">
                      <span className="font-bold text-[#1A3C2E] block mb-1">Non-Baccalaureate Programs</span>
                      <ul className="list-disc list-inside text-stone-500 text-xs md:text-sm space-y-1">
                        <li>Diploma in Application Development</li>
                        <li>Diploma in Computer Network Administration</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeInfoTab === 'council' && (
            <div className="space-y-8 animate-fade-in text-left">
              <p className="text-[#1A3C2E]/90 text-lg md:text-xl leading-relaxed">
                The College of Computing and Information Sciences (CCIS) Student Council serves as the supreme student governing body. 
                Our vision unites tech-pioneering action with compassionate human advocacy. 
                We operate not just as organizers, but as builders—collaborating through modern engineering practices to craft systems, provide learning support, and amplify student voices.
              </p>
              
              <div className="border-l-4 border-[#F5B400] pl-5 italic text-[#5E6E64] text-base md:text-lg">
                "We strive to foster a safe, inclusive computing atmosphere where tech service meets dynamic leadership, leaving no tiger behind."
              </div>

              <div className="space-y-4">
                <h4 className="font-sans font-black text-base md:text-lg text-[#1A3C2E] uppercase tracking-wider border-b border-[#1A3C2E]/10 pb-2">
                  Council Functions & Duties
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex gap-4">
                    <CheckCircle2 size={24} className="text-[#F5B400] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[#1A3C2E] block text-base md:text-lg mb-1">Student Advocacy</strong>
                      <span className="text-[#5E6E64] text-sm md:text-base leading-relaxed">Represent the entire CCIS student body in administrative dialogue and university affairs.</span>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex gap-4">
                    <CheckCircle2 size={24} className="text-[#F5B400] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[#1A3C2E] block text-base md:text-lg mb-1">Academic & Tech Enablement</strong>
                      <span className="text-[#5E6E64] text-sm md:text-base leading-relaxed">Organize college-wide academic tutorials, competitive bootcamps, and technical workshop series.</span>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex gap-4">
                    <CheckCircle2 size={24} className="text-[#F5B400] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[#1A3C2E] block text-base md:text-lg mb-1">Welfare & Engagement</strong>
                      <span className="text-[#5E6E64] text-sm md:text-base leading-relaxed">Execute sportsfests, creative showcases, and student welfare initiatives.</span>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex gap-4">
                    <CheckCircle2 size={24} className="text-[#F5B400] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[#1A3C2E] block text-base md:text-lg mb-1">Digital Governance</strong>
                      <span className="text-[#5E6E64] text-sm md:text-base leading-relaxed">Build, scale, and maintain digital platforms for automated event tracking and concerns resolution.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeInfoTab === 'compsoc' && (
            <div className="space-y-8 animate-fade-in text-left">
              <p className="text-[#1A3C2E]/90 text-lg md:text-xl leading-relaxed">
                The Computer Society is the official local academic organization dedicated to fostering coding competency and software engineering skills. We serve as a sandbox for aspiring developers, system architects, and technology enthusiasts who want to build cool things, participate in hackathons, and learn cutting-edge workflows.
              </p>
              
              <div className="border-l-4 border-[#F5B400] pl-5 italic text-[#5E6E64] text-base md:text-lg">
                "Empowering future developers, engineers, and researchers to innovate, build, and lead in the digital era."
              </div>

              <div className="space-y-4">
                <h4 className="font-sans font-black text-base md:text-lg text-[#1A3C2E] uppercase tracking-wider border-b border-[#1A3C2E]/10 pb-2">
                  CompSoc Objectives
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex gap-4">
                    <CheckCircle2 size={24} className="text-[#F5B400] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[#1A3C2E] block text-base md:text-lg mb-1">Technical Training</strong>
                      <span className="text-[#5E6E64] text-sm md:text-base leading-relaxed">Provide hands-on workshops in software development, cloud computing, and database management.</span>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex gap-4">
                    <CheckCircle2 size={24} className="text-[#F5B400] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[#1A3C2E] block text-base md:text-lg mb-1">Peer-to-Peer Study</strong>
                      <span className="text-[#5E6E64] text-sm md:text-base leading-relaxed">Organize peer-to-peer programming study groups and coding hackathons.</span>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex gap-4">
                    <CheckCircle2 size={24} className="text-[#F5B400] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[#1A3C2E] block text-base md:text-lg mb-1">Industry Networking</strong>
                      <span className="text-[#5E6E64] text-sm md:text-base leading-relaxed">Collaborate with industry professionals to offer guest lectures and career guidance.</span>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex gap-4">
                    <CheckCircle2 size={24} className="text-[#F5B400] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[#1A3C2E] block text-base md:text-lg mb-1">Contest Preparation</strong>
                      <span className="text-[#5E6E64] text-sm md:text-base leading-relaxed">Support student developers in buildathons, hacking events, and algorithmic programming contests.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4.4.2 Officer Directory Grid */}
      <section className="py-16 bg-white border-b border-[#1A3C2E]/10" id="officer-directory">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-12">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#5E6E64] font-bold font-semibold">Leadership</span>
            <h2 className="font-sans font-black text-3xl md:text-4xl text-[#1A3C2E] mt-1">CCIS Student Council Officers</h2>
            <p className="text-[#5E6E64] text-xs md:text-sm mt-2 font-mono uppercase tracking-widest">Commitment, Service, Integrity</p>
            <div className="h-1 w-16 bg-[#F5B400] mx-auto mt-3 rounded-full" />
          </div>

          {/* Podium Layout */}
          {(chairperson || secretary || viceChair) && (
            <div className="max-w-4xl mx-auto mb-16 px-4">
              <div className="flex flex-col md:flex-row items-center md:items-end justify-center gap-6 md:gap-8">
                
                {/* 2nd Place: Secretary (Left on desktop) */}
                {secretary && (
                  <div className="order-2 md:order-1 w-full md:w-64 bg-[#1A3C2E]/95 border border-white/5 hover:border-[#F5B400]/30 p-5 rounded-2xl shadow-md text-center flex flex-col items-center gap-3 transition-all duration-300 hover:-translate-y-1 h-fit md:mb-0">
                    <div className="relative w-16 h-16 rounded-full bg-[#FAF7EA] text-[#1A3C2E] flex items-center justify-center font-sans font-black text-lg tracking-tight border-2 border-[#FAF7EA] overflow-hidden shrink-0">
                      {secretary.photoUrl ? (
                        <img src={secretary.photoUrl} alt={secretary.name} className="w-full h-full object-cover select-none" />
                      ) : (
                        secretary.name.split(' ').map(n => n[0]).join('')
                      )}
                      <div className="absolute inset-1 rounded-full border border-[#1A3C2E]/20 pointer-events-none" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-sans font-black text-white text-sm hover:text-[#F5B400] transition-colors leading-tight">
                        {secretary.name}
                      </h4>
                      <span className="block font-mono text-[9px] font-black text-[#F5B400] uppercase tracking-widest leading-normal">
                        {secretary.position}
                      </span>
                      <span className="block font-sans text-[9px] text-stone-300 font-semibold uppercase tracking-wider">
                        {secretary.committee}
                      </span>
                    </div>
                    {secretary.quote && (
                      <p className="font-sans text-[10px] text-stone-300/85 italic leading-relaxed max-w-[170px] mx-auto">
                        "{secretary.quote}"
                      </p>
                    )}
                    <div className="w-full pt-2.5 border-t border-white/10 mt-auto">
                      <a href={`mailto:${secretary.email}`} className="font-mono text-[8px] text-[#FAF7EA]/70 hover:text-[#F5B400] break-all">
                        {secretary.email}
                      </a>
                    </div>
                  </div>
                )}

                {/* 1st Place: Chairperson (Middle) */}
                {chairperson && (
                  <div className="order-1 md:order-2 w-full md:w-72 bg-[#1A3C2E] ring-2 ring-[#F5B400]/40 p-6 rounded-3xl shadow-xl text-center flex flex-col items-center gap-4 transition-all duration-300 hover:-translate-y-2 border border-[#F5B400]/20 transform md:-translate-y-4">
                    <div className="relative w-24 h-24 rounded-full bg-[#FAF7EA] text-[#1A3C2E] flex items-center justify-center font-sans font-black text-2xl tracking-tight border-4 border-[#F5B400] shadow-lg overflow-hidden shrink-0">
                      {chairperson.photoUrl ? (
                        <img src={chairperson.photoUrl} alt={chairperson.name} className="w-full h-full object-cover select-none" />
                      ) : (
                        chairperson.name.split(' ').map(n => n[0]).join('')
                      )}
                      <div className="absolute inset-1 rounded-full border border-[#1A3C2E]/20 pointer-events-none" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-sans font-black text-white text-base md:text-lg hover:text-[#F5B400] transition-colors leading-tight">
                        {chairperson.name}
                      </h4>
                      <span className="block font-mono text-[10px] font-black text-[#F5B400] uppercase tracking-widest leading-normal">
                        {chairperson.position}
                      </span>
                      <span className="block font-sans text-[10px] text-stone-300 font-semibold uppercase tracking-wider">
                        {chairperson.committee}
                      </span>
                    </div>
                    {chairperson.quote && (
                      <p className="font-sans text-[11px] text-stone-300/85 italic leading-relaxed max-w-[200px] mx-auto">
                        "{chairperson.quote}"
                      </p>
                    )}
                    <div className="w-full pt-3 border-t border-white/10 mt-auto">
                      <a href={`mailto:${chairperson.email}`} className="font-mono text-[9px] text-[#FAF7EA]/70 hover:text-[#F5B400] break-all">
                        {chairperson.email}
                      </a>
                    </div>
                  </div>
                )}

                {/* 3rd Place: Vice Chairperson (Right on desktop) */}
                {viceChair && (
                  <div className="order-3 w-full md:w-64 bg-[#1A3C2E]/90 border border-white/5 hover:border-[#F5B400]/30 p-5 rounded-2xl shadow-md text-center flex flex-col items-center gap-3 transition-all duration-300 hover:-translate-y-1 h-fit md:mb-0">
                    <div className="relative w-16 h-16 rounded-full bg-[#FAF7EA] text-[#1A3C2E] flex items-center justify-center font-sans font-black text-lg tracking-tight border-2 border-[#FAF7EA] overflow-hidden shrink-0">
                      {viceChair.photoUrl ? (
                        <img src={viceChair.photoUrl} alt={viceChair.name} className="w-full h-full object-cover select-none" />
                      ) : (
                        viceChair.name.split(' ').map(n => n[0]).join('')
                      )}
                      <div className="absolute inset-1 rounded-full border border-[#1A3C2E]/20 pointer-events-none" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-sans font-black text-white text-sm hover:text-[#F5B400] transition-colors leading-tight">
                        {viceChair.name}
                      </h4>
                      <span className="block font-mono text-[9px] font-black text-[#F5B400] uppercase tracking-widest leading-normal">
                        {viceChair.position}
                      </span>
                      <span className="block font-sans text-[9px] text-stone-300 font-semibold uppercase tracking-wider">
                        {viceChair.committee}
                      </span>
                    </div>
                    {viceChair.quote && (
                      <p className="font-sans text-[10px] text-stone-300/85 italic leading-relaxed max-w-[170px] mx-auto">
                        "{viceChair.quote}"
                      </p>
                    )}
                    <div className="w-full pt-2.5 border-t border-white/10 mt-auto">
                      <a href={`mailto:${viceChair.email}`} className="font-mono text-[8px] text-[#FAF7EA]/70 hover:text-[#F5B400] break-all">
                        {viceChair.email}
                      </a>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Remaining Officers Grid */}
          {remainingOfficers.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
              {remainingOfficers.map((off, index) => (
                <div
                  key={off.id}
                  className="group flex flex-col items-center bg-[#1A3C2E] p-5 rounded-2xl border border-white/5 hover:border-[#F5B400]/50 transition-all duration-300 shadow-sm hover:shadow-lg text-center"
                  id={`officer-card-${off.id}`}
                >
                  <div className="relative w-20 h-20 rounded-full bg-[#FAF7EA] text-[#1A3C2E] flex items-center justify-center font-sans font-black text-xl tracking-tight shadow-md border-2 border-[#FAF7EA] group-hover:border-[#F5B400] transition-colors duration-300 overflow-hidden shrink-0">
                    {off.photoUrl ? (
                      <img src={off.photoUrl} alt={off.name} className="w-full h-full object-cover select-none" />
                    ) : (
                      off.name.split(' ').map(n => n[0]).join('')
                    )}
                    <div className="absolute inset-1 rounded-full border border-[#1A3C2E]/20 pointer-events-none" />
                  </div>

                  <div className="mt-4 space-y-1 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-sans font-black text-white text-base group-hover:text-[#F5B400] transition-colors leading-tight mb-1">
                        {off.name}
                      </h3>
                      <span className="block font-mono text-[9px] font-black text-[#F5B400] uppercase tracking-widest leading-normal">
                        {off.position}
                      </span>
                      <span className="block font-sans text-[10px] text-stone-300 font-semibold uppercase tracking-wider mt-0.5 mb-1.5">
                        {off.committee}
                      </span>
                    </div>
                    {off.quote && (
                      <p className="font-sans text-[11px] text-stone-300/85 italic leading-relaxed max-w-[180px] mx-auto">
                        "{off.quote}"
                      </p>
                    )}
                  </div>

                  <div className="mt-4 w-full pt-3 border-t border-white/10">
                    <a
                      href={`mailto:${off.email}`}
                      className="font-mono text-[9px] text-[#FAF7EA]/70 hover:text-[#F5B400] break-all px-1 rounded transition-colors"
                    >
                      {off.email}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </section>

      {/* 4.4.3 Committee Directory Tabs */}
      <section className="py-16 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8 border-b border-[#1A3C2E]/10" id="committees-directory">
        <div className="text-center mb-10">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#5E6E64] font-bold">Divisions</span>
          <h2 className="font-sans font-extrabold text-3xl md:text-4xl text-[#1A3C2E] mt-1">Our Working Committees</h2>
          <p className="text-[#5E6E64] text-xs md:text-sm mt-2 font-mono uppercase tracking-widest">Driven by dedication, shaped by technology</p>
          <div className="h-1 w-16 bg-[#F5B400] mx-auto mt-3 rounded-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Navigation Tab Column */}
          <div className="lg:col-span-4 flex flex-col gap-2.5 pr-2">
            {committees.map((com) => (
              <button
                key={com.id}
                onClick={() => setActiveCommitteeTab(com.id)}
                className={`flex items-center gap-3.5 px-4 py-4 rounded-xl text-left border font-sans font-bold text-sm tracking-wide transition-all ${
                  activeCommitteeTab === com.id
                    ? 'bg-white border-zinc-200 text-[#1A3C2E] border-l-4 border-l-[#F5B400] shadow-md pl-3.5'
                    : 'bg-zinc-50 border-zinc-150 text-[#5E6E64] hover:bg-white hover:text-[#1A3C2E] border-l-4 border-l-[#1A3C2E]/30'
                }`}
              >
                {getCommitteeIcon(com.slug || '')}
                {com.name}
              </button>
            ))}
          </div>

          {/* Details Content Box */}
          <div className="lg:col-span-8 bg-white p-6 md:p-8 rounded-3xl border border-zinc-100 shadow-sm border-l-4 border-l-[#1A3C2E] min-h-[300px]">
            {committees.filter(c => c.id === activeCommitteeTab).map((com) => (
              <div key={com.id} className="space-y-6 animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-[#FAF7EA] rounded-xl border border-[#F5B400]/30 flex items-center justify-center">
                    {getCommitteeIcon(com.slug || '')}
                  </div>
                  <div>
                    <h3 className="font-sans font-extrabold text-xl md:text-2xl text-[#1A3C2E]">
                      {com.name}
                    </h3>
                    <span className="text-xs font-mono text-[#5E6E64] uppercase tracking-wider flex flex-wrap items-center gap-2 mt-1">
                      <Award size={12} className="text-[#F5B400] shrink-0" />
                      <span>Chairperson:</span>
                      {(() => {
                        const headOfficer = officers.find(
                          o => o.name.toLowerCase().trim() === com.head.toLowerCase().trim()
                        );
                        return (
                          <span className="inline-flex items-center gap-1.5">
                            {headOfficer?.photoUrl ? (
                              <span className="w-5 h-5 rounded-full overflow-hidden border border-stone-200 inline-block shrink-0">
                                <img src={headOfficer.photoUrl} alt="" className="w-full h-full object-cover select-none" />
                              </span>
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-[7px] font-bold text-[#1A3C2E] shrink-0">
                                {com.head.split(' ').map((n: string) => n[0]).join('')}
                              </span>
                            )}
                            <strong className="text-[#1A3C2E] font-bold">{com.head}</strong>
                          </span>
                        );
                      })()}
                    </span>
                  </div>
                </div>

                <p className="text-stone-600 leading-relaxed font-sans text-sm md:text-base">
                  {com.description}
                </p>

                <div className="space-y-3.5">
                  <h4 className="font-sans font-bold text-[#1A3C2E] text-sm uppercase tracking-wider border-b border-zinc-100 pb-2">
                    Primary Responsibilities
                  </h4>
                  <ul className="grid grid-cols-1 gap-2.5">
                    {com.responsibilities.map((resp, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm my-0.5">
                        <span className="inline-flex items-center justify-center bg-[#FAF7EA] border border-[#F5B400]/40 text-[#1A3C2E] font-mono text-xs rounded-full w-5 h-5 flex-shrink-0 font-bold mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-[#5E6E64] leading-relaxed font-sans">{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {com.id === 'com-advertising' && (
                  <div className="mt-6 space-y-3.5">
                    <h4 className="font-sans font-bold text-[#1A3C2E] text-sm uppercase tracking-wider border-b border-zinc-100 pb-2">
                      Specialized Sub-Teams
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-[#FAF7EA]/40 border border-zinc-150 p-4 rounded-xl shadow-xs">
                        <span className="block font-sans font-black text-xs text-[#1A3C2E] uppercase tracking-wide">Publicity Team</span>
                        <p className="text-[11px] text-[#5E6E64] mt-1.5 leading-relaxed font-sans">
                          Writes captions, formal announcements, taglines, and storylines for council communications and films.
                        </p>
                      </div>
                      <div className="bg-[#FAF7EA]/40 border border-zinc-150 p-4 rounded-xl shadow-xs">
                        <span className="block font-sans font-black text-xs text-[#1A3C2E] uppercase tracking-wide">Creatives Team</span>
                        <p className="text-[11px] text-[#5E6E64] mt-1.5 leading-relaxed font-sans">
                          Produces graphics, digital art, posters, illustrations, layouts, and multimedia motion designs.
                        </p>
                      </div>
                      <div className="bg-[#FAF7EA]/40 border border-zinc-150 p-4 rounded-xl shadow-xs">
                        <span className="block font-sans font-black text-xs text-[#1A3C2E] uppercase tracking-wide">Documentation Team</span>
                        <p className="text-[11px] text-[#5E6E64] mt-1.5 leading-relaxed font-sans">
                          Handles photography, videography, coverage operations, and post-event video reel editing.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>




    </div>
  );
}
