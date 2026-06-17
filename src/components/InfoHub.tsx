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
          order: o.display_order
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

  return (
    <div className="bg-[#FAF7EA] min-h-screen font-sans text-stone-800" id="info-hub-section">
      
      {/* 4.4.1 About/Council Mission Block */}
      <section className="py-16 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8 border-b border-[#1A3C2E]/10" id="about-mission">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-7 space-y-6">
            {activeInfoTab === 'college' && (
              <div className="space-y-6 animate-fade-in">
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#5E6E64] font-bold">University of Makati</span>
                <h2 className="font-sans font-black text-3xl md:text-5xl text-[#1A3C2E] leading-tight">
                  College of Computing and Information Sciences
                </h2>
                <span className="block italic text-stone-500 text-xs md:text-sm font-semibold -mt-3">
                  (formerly College of Computer Science)
                </span>
                <div className="h-1 w-20 bg-[#F5B400] rounded-full" />
                <div className="bg-white p-5 rounded-2xl border border-[#1A3C2E]/5 shadow-xs space-y-3">
                  <h4 className="font-sans font-black text-sm text-[#1A3C2E] uppercase tracking-wider">
                    Welcome to College of Computing and Information Sciences!
                  </h4>
                  <p className="text-sm text-[#5E6E64] leading-relaxed">
                    The College of Computing and Information Sciences (CCIS) is the leading college in ICT education programs of the university by providing competitive, relevant and functional IT Curriculum responsive to the needs of the industrial and business organizations. The college has the following functions:
                  </p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-[#5E6E64] list-disc list-inside">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-zinc-100 shadow-xs">
                    <span className="block text-sm font-mono font-bold text-[#F5B400] uppercase tracking-wider">Vision</span>
                    <p className="text-sm text-[#5E6E64] mt-1 leading-relaxed">
                      The college envisions to lead in the development of excellent professionals and champions of social equity in the global field of computing and information sciences.
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-zinc-100 shadow-xs">
                    <span className="block text-sm font-mono font-bold text-[#F5B400] uppercase tracking-wider">Mission</span>
                    <p className="text-sm text-[#5E6E64] mt-1 leading-relaxed">
                      Guided by its vision, the college produces practitioners and leaders in computing and information sciences who are resilient, industry-ready, and socially responsible through innovative curriculum design and dynamic delivery systems.
                    </p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-zinc-100 space-y-4 shadow-xs">
                  <div>
                    <span className="block text-sm font-mono font-bold text-[#1A3C2E] uppercase tracking-wider border-b border-zinc-50 pb-1.5">Core Values</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                      <div className="text-sm">
                        <strong className="text-[#1A3C2E] block">God Fearing</strong>
                        <span className="text-stone-500 text-xs leading-snug block mt-0.5">Reverence and moral uprightness.</span>
                      </div>
                      <div className="text-sm">
                        <strong className="text-[#1A3C2E] block">Industry</strong>
                        <span className="text-stone-500 text-xs leading-snug block mt-0.5">Diligence in pursuing tasks.</span>
                      </div>
                      <div className="text-sm">
                        <strong className="text-[#1A3C2E] block">Fortitude</strong>
                        <span className="text-stone-500 text-xs leading-snug block mt-0.5">Courage and strength in character.</span>
                      </div>
                      <div className="text-sm">
                        <strong className="text-[#1A3C2E] block">Trustworthy</strong>
                        <span className="text-stone-500 text-xs leading-snug block mt-0.5">Deserving of confidence.</span>
                      </div>
                      <div className="text-sm">
                        <strong className="text-[#1A3C2E] block">Creativity</strong>
                        <span className="text-stone-500 text-xs leading-snug block mt-0.5">Ability to make new ideas.</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-zinc-100 pt-3">
                    <span className="block text-sm font-mono font-bold text-[#1A3C2E] uppercase tracking-wider border-b border-zinc-50 pb-1.5">Program Offerings</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                      <div className="text-sm space-y-1">
                        <span className="font-bold text-[#1A3C2E] block">Baccalaureate Programs</span>
                        <ul className="list-disc list-inside text-stone-500 text-xs space-y-0.5">
                          <li>B.S. in Information Technology (INS Track)</li>
                          <li>B.S. in Computer Science (CDS Track)</li>
                          <li>B.S. in Computer Science (AppDev Track)</li>
                        </ul>
                      </div>
                      <div className="text-sm space-y-1">
                        <span className="font-bold text-[#1A3C2E] block">Non-Baccalaureate Programs</span>
                        <ul className="list-disc list-inside text-stone-500 text-xs space-y-0.5">
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
              <div className="space-y-6 animate-fade-in">
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#5E6E64] font-bold">About CCIS SC</span>
                <h2 className="font-sans font-black text-3xl md:text-5xl text-[#1A3C2E] leading-tight">
                  A Legacy of Technical Excellence and Devoted Governance
                </h2>
                <div className="h-1 w-20 bg-[#F5B400] rounded-full" />
                <p className="text-[#1A3C2E]/90 text-base md:text-lg leading-relaxed">
                  The College of Computing and Information Sciences (CCIS) Student Council serves as the supreme student governing body. 
                  Our vision unites tech-pioneering action with compassionate human advocacy. 
                  We operate not just as organizers, but as builders—collaborating through modern engineering practices to craft systems, provide learning support, and amplify student voices.
                </p>
                <div className="border-l-4 border-[#F5B400] pl-4 italic text-[#5E6E64] text-sm md:text-base">
                  "We strive to foster a safe, inclusive computing atmosphere where tech service meets dynamic leadership, leaving no tiger behind."
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#1A3C2E]/5 shadow-xs space-y-3">
                  <h4 className="font-sans font-black text-sm text-[#1A3C2E] uppercase tracking-wider border-b border-zinc-50 pb-1.5">
                    Council Functions & Duties
                  </h4>
                  <ul className="grid grid-cols-1 gap-2.5 text-xs text-[#5E6E64]">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={13} className="text-[#F5B400] shrink-0 mt-0.5" />
                      <span>Represent the entire CCIS student body in administrative dialogue and university affairs.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={13} className="text-[#F5B400] shrink-0 mt-0.5" />
                      <span>Organize college-wide academic tutorials, competitive bootcamps, and technical workshop series.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={13} className="text-[#F5B400] shrink-0 mt-0.5" />
                      <span>Execute sportsfests, creative showcases, and student welfare initiatives.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={13} className="text-[#F5B400] shrink-0 mt-0.5" />
                      <span>Build, scale, and maintain digital platforms for automated event tracking and concerns resolution.</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {activeInfoTab === 'compsoc' && (
              <div className="space-y-6 animate-fade-in">
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#5E6E64] font-bold">Local Organization</span>
                <h2 className="font-sans font-black text-3xl md:text-5xl text-[#1A3C2E] leading-tight">
                  Computer Society (ComSoc)
                </h2>
                <div className="h-1 w-20 bg-[#F5B400] rounded-full" />
                <p className="text-[#1A3C2E]/90 text-base md:text-lg leading-relaxed">
                  The Computer Society is the official local academic organization dedicated to fostering coding competency and software engineering skills. We serve as a sandbox for aspiring developers, system architects, and technology enthusiasts who want to build cool things, participate in hackathons, and learn cutting-edge workflows.
                </p>
                <div className="border-l-4 border-[#F5B400] pl-4 italic text-[#5E6E64] text-sm md:text-base">
                  "Empowering future developers, engineers, and researchers to innovate, build, and lead in the digital era."
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#1A3C2E]/5 shadow-xs space-y-3">
                  <h4 className="font-sans font-black text-sm text-[#1A3C2E] uppercase tracking-wider border-b border-zinc-50 pb-1.5">
                    CompSoc Objectives
                  </h4>
                  <ul className="grid grid-cols-1 gap-2.5 text-xs text-[#5E6E64]">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={13} className="text-[#F5B400] shrink-0 mt-0.5" />
                      <span>Provide hands-on workshops in software development, cloud computing, and database management.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={13} className="text-[#F5B400] shrink-0 mt-0.5" />
                      <span>Organize peer-to-peer programming study groups and coding hackathons.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={13} className="text-[#F5B400] shrink-0 mt-0.5" />
                      <span>Collaborate with industry professionals to offer guest lectures and career guidance.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={13} className="text-[#F5B400] shrink-0 mt-0.5" />
                      <span>Support student developers in buildathons, hacking events, and algorithmic programming contests.</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-white p-6 md:p-8 rounded-3xl shadow-md border border-[#1A3C2E]/5 space-y-6">
            {/* Primary Logo: Official College Seal */}
            <div 
              onClick={() => setActiveInfoTab('college')}
              className={`flex flex-col items-center text-center space-y-3 pb-6 border-b border-[#1A3C2E]/10 cursor-pointer p-4 rounded-2xl transition-all duration-300 hover:bg-[#FAF7EA]/30 ${
                activeInfoTab === 'college' ? 'ring-2 ring-[#F5B400] bg-[#FAF7EA]/30 border-transparent shadow-xs' : ''
              }`}
            >
              <img
                src="/images/CCIS-Logo.png"
                alt="CCIS Official College Seal"
                className="w-28 h-28 md:w-32 md:h-32 object-contain select-none transition-transform duration-300 hover:scale-105"
              />
              <div>
                <h4 className="font-sans font-black text-sm text-[#1A3C2E] leading-tight">College of Computing &amp; Sciences</h4>
                <p className="text-[10px] text-stone-500 font-mono mt-1 uppercase tracking-wider">
                  Official College Logo Seal
                </p>
              </div>
            </div>

            {/* Recognized Organizations */}
            <div className="space-y-4">
              <h5 className="text-[9px] font-mono font-bold text-[#5E6E64] uppercase tracking-widest text-center">
                Recognized Organizations
              </h5>
              
              <div className="grid grid-cols-2 gap-3 items-stretch">
                {/* Mother Organization: Student Council */}
                <div 
                  onClick={() => setActiveInfoTab('council')}
                  className={`flex flex-col items-center text-center p-3 rounded-2xl bg-[#FAF7EA]/20 border border-[#1A3C2E]/5 cursor-pointer hover:border-[#F5B400]/30 transition-all duration-300 h-full justify-between ${
                    activeInfoTab === 'council' ? 'ring-2 ring-[#F5B400] bg-[#FAF7EA]/50 border-transparent shadow-xs' : ''
                  }`}
                >
                  <img
                    src="/images/ccis_logo.jpg"
                    alt="CCIS Student Council Logo"
                    className="w-12 h-12 md:w-14 md:h-14 object-contain rounded-full shadow-xs transition-transform duration-300 hover:scale-110"
                  />
                  <div className="flex-grow flex flex-col justify-between mt-2 w-full">
                    <span className="block text-[10px] md:text-xs font-sans font-black text-[#1A3C2E] leading-tight">
                      CCIS Student Council
                    </span>
                    <span className="block text-[8px] font-mono text-stone-400 mt-1 uppercase tracking-wider">
                      Mother Org
                    </span>
                  </div>
                </div>

                {/* Local Organization: Computer Society */}
                <div 
                  onClick={() => setActiveInfoTab('compsoc')}
                  className={`flex flex-col items-center text-center p-3 rounded-2xl bg-[#FAF7EA]/20 border border-[#1A3C2E]/5 cursor-pointer hover:border-[#F5B400]/30 transition-all duration-300 h-full justify-between ${
                    activeInfoTab === 'compsoc' ? 'ring-2 ring-[#F5B400] bg-[#FAF7EA]/50 border-transparent shadow-xs' : ''
                  }`}
                >
                  <img
                    src="/images/Computer-Society.png"
                    alt="Computer Society Logo"
                    className="w-12 h-12 md:w-14 md:h-14 object-contain rounded-full shadow-xs transition-transform duration-300 hover:scale-110"
                  />
                  <div className="flex-grow flex flex-col justify-between mt-2 w-full">
                    <span className="block text-[10px] md:text-xs font-sans font-black text-[#1A3C2E] leading-tight">
                      Computer Society
                    </span>
                    <span className="block text-[8px] font-mono text-stone-400 mt-1 uppercase tracking-wider">
                      Local Org
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {officers.map((off, index) => (
              <div
                key={off.id}
                className="group flex flex-col items-center bg-[#1A3C2E] p-5 rounded-2xl border border-white/5 hover:border-[#F5B400]/50 transition-all duration-300 shadow-sm hover:shadow-lg text-center"
                id={`officer-card-${off.id}`}
              >
                {/* Circular graphical portrait with concentric gold circles mirroring the seal */}
                <div className="relative w-20 h-20 rounded-full bg-[#FAF7EA] text-[#1A3C2E] flex items-center justify-center font-sans font-black text-xl tracking-tight shadow-md border-2 border-[#FAF7EA] group-hover:border-[#F5B400] transition-colors duration-300">
                  {off.name.split(' ').map(n => n[0]).join('')}
                  {/* Decorative thin inner accent ring */}
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
                  <p className="font-sans text-[11px] text-stone-300/80 leading-relaxed max-w-[180px] mx-auto">
                    {ROLE_SUMMARIES[off.position]}
                  </p>
                </div>

                <div className="mt-4 w-full pt-3 border-t border-white/10">
                  <a
                    href={`mailto:${off.email}`}
                    className="font-mono text-[9px] text-[#FAF7EA]/70 hover:text-[#F5B400] break-all px-1 px-1 rounded transition-colors"
                  >
                    {off.email}
                  </a>
                </div>
              </div>
            ))}
          </div>

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
                    <span className="text-xs font-mono text-[#5E6E64] uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                      <Award size={12} className="text-[#F5B400]" />
                      Chairperson: <strong className="text-[#1A3C2E] font-bold">{com.head}</strong>
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
