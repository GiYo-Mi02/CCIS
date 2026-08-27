import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, Sparkles, Code, BookOpen, Trophy, Palette, Calendar, 
  AlertCircle, CheckCircle2, List, ChevronDown, Award,
  ClipboardList, Coins, Archive, Cpu, Globe, Heart, Megaphone,
  ExternalLink
} from 'lucide-react';
import { Officer, Committee } from '../types';
import CouncilSeal from './CouncilSeal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { InfoHubSkeleton } from './common/Skeleton';

interface StudentOrgMeta {
  id: string;
  dbOrgName: string;
  name: string;
  shortName: string;
  category: string;
  logo: string;
  tagline: string;
  missionQuote: string;
  overview: string;
  description: string;
  functions: { title: string; desc: string }[];
  theme: {
    primary: string;
    accent: string;
    onPrimary: string;
    heading: string;
  };
}

const STUDENT_ORGS: StudentOrgMeta[] = [
  {
    id: 'council',
    dbOrgName: 'Student Council',
    name: 'CCIS Student Council',
    shortName: 'Student Council',
    category: 'Mother Organization',
    logo: '/images/ccis_logo.jpg',
    tagline: 'Code, Create, Connect',
    description: 'The supreme student governing body of the College of Computing and Information Sciences.',
    missionQuote: '"We strive to foster a safe, inclusive computing atmosphere where tech service meets dynamic leadership, leaving no heron behind."',
    overview: 'The College of Computing and Information Sciences (CCIS) Student Council serves as the supreme student governing body. Our vision unites tech-pioneering action with compassionate human advocacy. We operate not just as organizers, but as builders—collaborating through modern engineering practices to craft systems, provide learning support, and amplify student voices.',
    functions: [
      { title: 'Student Advocacy', desc: 'Represent the entire CCIS student body in administrative dialogue and university affairs.' },
      { title: 'Academic & Tech Enablement', desc: 'Organize college-wide academic tutorials, competitive bootcamps, and technical workshop series.' },
      { title: 'Welfare & Engagement', desc: 'Execute sportsfests, creative showcases, and student welfare initiatives.' },
      { title: 'Digital Governance', desc: 'Build, scale, and maintain digital platforms for automated event tracking and concerns resolution.' }
    ],
    theme: {
      primary: '#123524',
      accent: '#FFBC00',
      onPrimary: '#FFFFFF',
      heading: '#123524'
    }
  },
  {
    id: 'compsoc',
    dbOrgName: 'Computer Society',
    name: 'Computer Society',
    shortName: 'ComSoc',
    category: 'Local Academic Organization',
    logo: '/images/Computer-Society.png',
    tagline: 'Debug, Develop, Deploy',
    description: 'The official academic organization focused on software engineering, competitive programming, and modern development workflows.',
    missionQuote: '"Empowering future developers, engineers, and researchers to innovate, build, and lead in the digital era."',
    overview: 'The Computer Society is the official local academic organization dedicated to fostering coding competency and software engineering skills. We serve as a sandbox for aspiring developers, system architects, and technology enthusiasts who want to build cool things, participate in hackathons, and learn cutting-edge workflows.',
    functions: [
      { title: 'Technical Training', desc: 'Provide hands-on workshops in software development, cloud computing, and database management.' },
      { title: 'Peer-to-Peer Study', desc: 'Organize peer-to-peer programming study groups and coding hackathons.' },
      { title: 'Industry Networking', desc: 'Collaborate with industry professionals to offer guest lectures and career guidance.' },
      { title: 'Contest Preparation', desc: 'Support student developers in buildathons, hacking events, and algorithmic programming contests.' }
    ],
    theme: {
      primary: '#123524',
      accent: '#FFBC00',
      onPrimary: '#FFFFFF',
      heading: '#123524'
    }
  },
  {
    id: 'sic',
    dbOrgName: 'Society of Innovative Computing',
    name: 'Society of Innovative Computing',
    shortName: 'UMak SIC',
    category: 'Local Academic Organization',
    logo: '/images/SIC_logo.jpg',
    tagline: 'Innovate. Collaborate. Grow.',
    description: 'A peer-driven CCIS organization developing computing knowledge, skills, and experience through mentorship, collaborative projects, research, and continuous learning.',
    missionQuote: '"Students grow best through one another."',
    overview: 'UMak Society of Innovative Computing (UMak SIC) is a student-led academic and professional organization under the College of Computing and Information Sciences (CCIS) at the University of Makati. Founded on the belief that students grow best through one another, SIC creates a peer-driven environment where computing knowledge, skills, and experience are developed in ways that are hands-on, research-oriented, and innovative—through mentorship, collaborative projects, and a culture of continuous learning. SIC assists and equips not just competent students but collaborative innovators ready to make a meaningful mark in the computing field.',
    functions: [
      { title: 'Innovation', desc: 'Pursue creative, forward-thinking approaches that push the boundaries of computing science and technology.' },
      { title: 'Collaboration', desc: 'Build a thriving, inclusive community through peer mentorship, shared learning, and collective effort across all levels.' },
      { title: 'Excellence', desc: 'Commit to the highest standards in every project, program, research output, and professional interaction.' },
      { title: 'Integrity', desc: 'Act with honesty, transparency, and accountability while respecting intellectual property and ethical responsibilities.' },
      { title: 'Growth', desc: 'Embrace continuous learning and self-improvement, empowering every member to develop to their full potential.' },
      { title: 'Social Responsibility', desc: 'Apply computing knowledge purposefully and ethically to create meaningful, lasting impact for the broader community.' }
    ],
    theme: {
      primary: '#10B982',
      accent: '#00FFFF',
      onPrimary: '#052E2B',
      heading: '#065F46'
    }
  }
];

export interface InfoHubProps {
  onNavigate?: (tab: string, eventId?: string) => void;
  activeSubTab?: 'umak' | 'college' | 'org';
  onSubTabChange?: (tab: 'umak' | 'college' | 'org') => void;
}

export default function InfoHub({ onNavigate, activeSubTab, onSubTabChange }: InfoHubProps) {
  const { user, profile } = useAuth();
  
  // Controlled or uncontrolled sub-tab state
  const [internalSubTab, setInternalSubTab] = useState<'umak' | 'college' | 'org'>('umak');
  const activeInfoTab = activeSubTab !== undefined ? activeSubTab : internalSubTab;
  
  const handleTabSelect = (tab: 'umak' | 'college' | 'org') => {
    if (onSubTabChange) {
      onSubTabChange(tab);
    } else {
      setInternalSubTab(tab);
    }
  };

  const [selectedOrgId, setSelectedOrgId] = useState<string>('council');
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);
  const orgMenuRef = useRef<HTMLDivElement>(null);
  const [selectedTerm, setSelectedTerm] = useState<string>('2026-2027');
  const [activeCommitteeTab, setActiveCommitteeTab] = useState<string>('');
  
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
          quote: o.quote || '',
          term: o.term || '2026-2027',
          organization: o.organization || 'Student Council'
        })));
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!isOrgMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!orgMenuRef.current?.contains(event.target as Node)) {
        setIsOrgMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOrgMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOrgMenuOpen]);

  const selectedOrg = STUDENT_ORGS.find(org => org.id === selectedOrgId) || STUDENT_ORGS[0];

  const getCommitteeIcon = (slug: string) => {
    switch (slug) {
      case 'logistics': return <ClipboardList className="text-[#F5B400]" size={18} />;
      case 'finance': return <Coins className="text-[#F5B400]" size={18} />;
      case 'inventory': return <Archive className="text-[#F5B400]" size={18} />;
      case 'technical': return <Cpu className="text-[#F5B400]" size={18} />;
      case 'external-affairs': return <Globe className="text-[#F5B400]" size={18} />;
      case 'advertising': return <Megaphone className="text-[#F5B400]" size={18} />;
      case 'developers': return <Code className="text-[#F5B400]" size={18} />;
      case 'welfare': return <Heart className="text-[#F5B400]" size={18} />;
      default: return <Shield className="text-[#F5B400]" size={18} />;
    }
  };

  if (loading) {
    return <InfoHubSkeleton />;
  }

  // Filter officers based on selected organization and term
  const filteredOfficers = officers.filter(o => 
    o.term === selectedTerm && 
    (selectedOrg.id === 'council'
      ? (o.organization === 'Student Council' || !o.organization)
      : o.organization === selectedOrg.dbOrgName)
  );

  const execBoardRoles = ['chairperson', 'president', 'vice chairperson', 'vice president', 'secretary', 'treasurer', 'auditor', 'public information officer', 'pio', 'pro', 'public relations officer', 'business manager'];

  const getExecBoardRank = (position: string) => {
    const pos = position.toLowerCase().replace(/\s+/g, ' ').trim();
    if (pos.includes('chairperson') || pos.includes('president')) return 1;
    if (pos.includes('vice chairperson') || pos.includes('vice president') || pos.includes('vp')) return 2;
    if (pos.includes('secretary')) return 3;
    if (pos.includes('treasurer')) return 4;
    if (pos.includes('auditor')) return 5;
    if (pos.includes('public information officer') || pos.includes('pio') || pos.includes('public relations officer') || pos.includes('pro')) return 6;
    if (pos.includes('business manager')) return 7;
    return 8;
  };

  const getYearLevel = (position: string) => {
    const pos = position.toLowerCase().trim();
    if (pos.includes('1st') || pos.includes('first')) return 1;
    if (pos.includes('2nd') || pos.includes('second')) return 2;
    if (pos.includes('3rd') || pos.includes('third')) return 3;
    if (pos.includes('4th') || pos.includes('fourth')) return 4;
    return 99;
  };

  const execBoard = filteredOfficers.filter(o => {
    const pos = o.position.toLowerCase().replace(/\s+/g, ' ').trim();
    const isYearRep = pos.includes('year representative') || pos.includes('year rep') || pos.includes('representative');
    if (isYearRep) return false;
    
    const isExecCommittee = o.committee === 'Executive Board';
    const isExecRole = execBoardRoles.some(r => 
      pos === r || 
      pos.includes(r) ||
      pos.includes('president') ||
      pos.includes('chairperson') ||
      pos.includes('secretary') ||
      pos.includes('treasurer') ||
      pos.includes('auditor') ||
      pos.includes('pio') ||
      pos.includes('pro') ||
      pos.includes('business manager')
    );

    return isExecCommittee || isExecRole;
  }).sort((a, b) => {
    if (a.order && b.order && a.order !== b.order) return a.order - b.order;
    return getExecBoardRank(a.position) - getExecBoardRank(b.position);
  });

  const yearReps = filteredOfficers.filter(o => {
    const pos = o.position.toLowerCase();
    const isExec = execBoard.some(e => e.id === o.id);
    return !isExec && (pos.includes('year representative') || pos.includes('year rep') || pos.includes('representative'));
  }).sort((a, b) => getYearLevel(a.position) - getYearLevel(b.position));

  const committeeHeads = filteredOfficers.filter(o => {
    const pos = o.position.toLowerCase();
    const isExec = execBoard.some(e => e.id === o.id);
    const isYear = pos.includes('year representative') || pos.includes('year rep') || pos.includes('representative');
    return !isExec && !isYear && o.committee !== 'Executive Board';
  });

  const otherOfficers = filteredOfficers.filter(o => {
    return !execBoard.some(e => e.id === o.id) &&
           !yearReps.some(y => y.id === o.id) &&
           !committeeHeads.some(c => c.id === o.id);
  });

  const renderOfficerCard = (off: Officer) => (
    <div
      key={off.id}
      className="relative w-[280px] max-w-[calc(100vw-3rem)] h-[395px] group overflow-visible mt-16 mb-6 flex flex-col justify-end transition-all duration-500"
      id={`officer-card-${off.id}`}
    >
      {/* 1. Offset Angled Accent Border Frame */}
      <div className="absolute inset-x-0 bottom-0 top-10 rounded-3xl border-2 border-[#F5B400]/15 translate-x-3 translate-y-3 -rotate-3 pointer-events-none group-hover:translate-x-0 group-hover:translate-y-0 group-hover:rotate-0 group-hover:border-[#F5B400]/35 transition-all duration-500" />

      {/* 2. Main Skewed/Tilted Background Panel Card */}
      <div className="absolute inset-x-0 bottom-0 top-10 bg-gradient-to-br from-[#163628] via-[#0E2219] to-[#060D0A] rounded-3xl border border-white/10 shadow-2xl group-hover:shadow-[0_30px_60px_rgba(0,0,0,0.6)] group-hover:shadow-[#123524]/30 transition-all duration-500 origin-bottom transform group-hover:scale-[1.02] group-hover:-translate-y-3.5 -rotate-1 group-hover:rotate-0 overflow-hidden" />

      {/* 3. Rotated/Vertical Department Label */}
      <div className="absolute top-16 right-4 font-mono font-black text-[#F5B400]/10 group-hover:text-[#F5B400]/30 text-[9px] uppercase tracking-[0.3em] transition-all duration-500 [writing-mode:vertical-lr] select-none pointer-events-none group-hover:translate-y-2">
        {off.committee === 'Executive Board' ? 'EXEBOARD' : `EXECOM - ${off.committee.replace('Committee', '').trim()}`}
      </div>

      {/* 4. Overlapping 3D Pop-out Portrait Frame */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[88%] h-[98%] overflow-hidden rounded-2xl border border-white/10 shadow-lg bg-white/5 pointer-events-none z-10 group-hover:shadow-2xl group-hover:scale-106 group-hover:-translate-y-4 group-hover:border-[#F5B400]/30 transition-all duration-500 origin-bottom">
        {off.photoUrl ? (
          <div className="relative w-full h-full">
            <img 
              src={off.photoUrl} 
              alt={off.name} 
              className="w-full h-full object-cover select-none" 
            />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
          </div>
        ) : (
          <div className="w-full h-full bg-[#FAF7EA] text-[#1A3C2E] flex items-center justify-center font-sans font-black text-2xl select-none">
            {off.name.split(' ').map(n => n[0]).join('')}
          </div>
        )}
      </div>

      {/* 5. Floating Glassmorphic Footer Info Plate */}
      <div className="absolute bottom-4 left-4 right-4 bg-[#07130F]/90 backdrop-blur-md border border-white/10 p-3.5 rounded-2xl z-20 text-left shadow-2xl group-hover:shadow-[0_15px_30px_rgba(0,0,0,0.5)] group-hover:border-[#F5B400]/40 group-hover:-translate-y-4 transition-all duration-500 flex flex-col justify-between">
        <div>
          <h3 className="font-sans font-black text-white text-xs md:text-sm group-hover:text-[#F5B400] transition-colors leading-tight mb-0.5 truncate">
            {off.name}
          </h3>
          <span className="block font-mono text-[8px] md:text-[9px] font-black text-[#F5B400] uppercase tracking-wider leading-none">
            {off.position}
          </span>
        </div>
        
        {/* Hover-reveal Contact / Quote row */}
        <div className="h-0 opacity-0 group-hover:h-auto group-hover:opacity-100 group-hover:mt-2 border-t border-white/5 pt-1.5 transition-all duration-500 overflow-hidden flex flex-col gap-1">
          {off.quote && (
            <p className="font-sans text-[9px] text-stone-300 leading-tight italic truncate">
              "{off.quote}"
            </p>
          )}
          <a
            href={`mailto:${off.email}`}
            className="font-mono text-[8px] text-stone-400 hover:text-[#F5B400] truncate transition-colors"
          >
            {off.email}
          </a>
        </div>
      </div>
    </div>
  );

  // Dynamic tokens per official UMak Design System:
  // UMak surface: #f5f6fa | Primary: #111c4e | Secondary: #f5ec3a | Tertiary: #105389 | Border: #d0d5e8
  const isUmak = activeInfoTab === 'umak';
  const containerBg = isUmak ? 'bg-[#f5f6fa]' : 'bg-[#FAF7EA]';
  const borderTone = isUmak ? 'border-[#d0d5e8]' : 'border-[#1A3C2E]/10';

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 ${containerBg}`} id="info-hub-section">
      
      {/* 4.4.1 About/Council Mission Block */}
      <section className={`py-16 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8 border-b transition-colors duration-500 ${borderTone}`} id="about-mission">
        
        {/* Dynamic Header & Row of Logos (Clean Pagination Cluster) */}
        <div className={`flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 border-b pb-8 mb-8 text-left transition-colors duration-500 ${borderTone}`}>
          
          {/* Left: Section Header Part */}
          <div className="space-y-2 lg:max-w-2xl">
            {activeInfoTab === 'umak' && (
              <div className="animate-fade-in">
                <span className="font-sans font-semibold text-xs uppercase tracking-wider text-[#47528a]">
                  City of Makati • Public Higher Education
                </span>
                <h2 className="font-sans font-bold text-3xl sm:text-4xl md:text-5xl text-[#111c4e] leading-tight">
                  University of Makati
                </h2>
                <span className="block text-[#47528a] text-xs md:text-sm font-normal mt-1">
                  Public University of the City of Makati • Established 1972
                </span>
              </div>
            )}

            {activeInfoTab === 'college' && (
              <div className="animate-fade-in">
                <span className="font-sans font-semibold text-xs uppercase tracking-wider text-[#57534E]">
                  University of Makati
                </span>
                <h2 className="font-sans font-black text-3xl md:text-5xl text-[#1A3C2E] leading-tight">
                  College of Computing and Information Sciences
                </h2>
                <span className="block italic text-[#57534E] text-xs md:text-sm font-medium mt-1">
                  (formerly College of Computer Science)
                </span>
              </div>
            )}

            {activeInfoTab === 'org' && (
              <div className="animate-fade-in">
                <span className="font-sans font-semibold text-xs uppercase tracking-wider text-[#57534E]">
                  {selectedOrg.category}
                </span>
                <h2 className="font-sans font-black text-3xl md:text-5xl text-[#1A3C2E] leading-tight">
                  {selectedOrg.name}
                </h2>
                <span className="block italic text-[#57534E] text-xs md:text-sm font-medium mt-1">
                  {selectedOrg.tagline}
                </span>
              </div>
            )}

            <div
              className={`h-1 w-20 rounded-full mt-3 ${isUmak ? 'bg-[#f5ec3a]' : activeInfoTab === 'org' ? '' : 'bg-[#F5B400]'}`}
              style={activeInfoTab === 'org' ? { backgroundColor: selectedOrg.theme.accent } : undefined}
            />
          </div>

          {/* Right: Logos in a Row (One Row Only Pagination Cluster) */}
          <div ref={orgMenuRef} className="relative shrink-0 self-start lg:self-center max-w-full">
            <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2.5 bg-white p-2 sm:p-2.5 rounded-lg border border-[#d0d5e8] shadow-xs max-w-full overflow-x-auto">
              {/* 1. UMak Logo Button */}
              <div
                onClick={() => handleTabSelect('umak')}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-md transition-all cursor-pointer hover:bg-[#eaecf4] shrink-0 select-none ${
                  activeInfoTab === 'umak' ? 'border-2 border-[#111c4e] bg-[#eaecf4]' : 'border border-transparent'
                }`}
                id="pagination-btn-umak"
                title="University of Makati"
              >
                <img src="/images/UMak_Logo.png" alt="UMak Logo" className="w-8 h-8 sm:w-9 sm:h-9 object-contain drop-shadow" />
                <div className="text-left leading-tight">
                  <span className="block text-xs font-bold text-[#111c4e]">UMak</span>
                  <span className="block text-[9px] font-sans text-[#47528a] uppercase tracking-wider">University</span>
                </div>
              </div>

              {/* 2. CCIS Logo Button */}
              <div
                onClick={() => handleTabSelect('college')}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-md transition-all cursor-pointer hover:bg-stone-50 shrink-0 select-none ${
                  activeInfoTab === 'college' ? 'border-2 border-[#1A3C2E] bg-[#FAF7EA]' : 'border border-transparent'
                }`}
                id="pagination-btn-college"
                title="College of Computing and Information Sciences"
              >
                <img src="/images/CCIS-Logo.png" alt="CCIS Logo" className="w-8 h-8 sm:w-9 sm:h-9 object-contain drop-shadow" />
                <div className="text-left leading-tight">
                  <span className="block text-xs font-bold text-[#1A3C2E]">CCIS</span>
                  <span className="block text-[9px] font-sans text-stone-500 uppercase tracking-wider">College Seal</span>
                </div>
              </div>

              {/* 3. Branded Student Organization Menu */}
              <button
                type="button"
                onClick={() => setIsOrgMenuOpen(open => !open)}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-md transition-all cursor-pointer hover:bg-[#FAF7EA] shrink-0 select-none ${
                  activeInfoTab === 'org' ? 'border-2 border-[#123524] bg-[#FAF7EA]' : 'border border-transparent'
                }`}
                id="pagination-btn-org"
                aria-haspopup="menu"
                aria-expanded={isOrgMenuOpen}
                aria-controls="student-org-menu"
                title="More student organizations"
              >
                <span className="flex -space-x-2" aria-hidden="true">
                  {STUDENT_ORGS.map(org => (
                    <img
                      key={org.id}
                      src={org.logo}
                      alt=""
                      className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-full bg-white border-2 border-white shadow-xs"
                    />
                  ))}
                </span>
                <span className="text-left leading-tight">
                  <span className="block text-xs font-bold text-[#123524]">More Orgs</span>
                  <span className="block text-[9px] font-sans text-stone-500 uppercase tracking-wider">Student Organizations</span>
                </span>
                <ChevronDown
                  size={14}
                  className={`text-[#123524] ml-0.5 shrink-0 transition-transform ${isOrgMenuOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
            </div>

            {isOrgMenuOpen && (
              <div
                id="student-org-menu"
                role="menu"
                aria-label="Student organizations"
                className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#123524]/25 bg-white shadow-2xl animate-fade-in"
              >
                <div className="bg-[#123524] px-4 py-3 text-left">
                  <span className="block font-marcellus text-sm text-white">Student Organizations</span>
                  <span className="block text-[10px] uppercase tracking-wider text-white/65">Choose an official CCIS organization</span>
                </div>
                <div className="space-y-2 p-2">
                  {STUDENT_ORGS.map(org => {
                    const isSelected = activeInfoTab === 'org' && selectedOrgId === org.id;
                    return (
                      <button
                        key={org.id}
                        type="button"
                        role="menuitem"
                        aria-current={isSelected ? 'page' : undefined}
                        onClick={() => {
                          setSelectedOrgId(org.id);
                          handleTabSelect('org');
                          setIsOrgMenuOpen(false);
                        }}
                        className={`w-full rounded-xl border p-3 text-left transition-all cursor-pointer flex items-center gap-3 ${
                          isSelected
                            ? 'bg-[#FAF7EA] shadow-sm'
                            : 'border-[#123524]/15 bg-white hover:border-[#123524]/45 hover:bg-stone-50'
                        }`}
                        style={{
                          borderColor: isSelected ? org.theme.primary : undefined,
                          borderLeftColor: org.theme.primary,
                          borderLeftWidth: '4px'
                        }}
                      >
                        <span
                          className="w-12 h-12 rounded-xl border bg-white p-1 shadow-xs shrink-0 flex items-center justify-center overflow-hidden"
                          style={{ borderColor: org.theme.accent }}
                        >
                          <img src={org.logo} alt={`${org.name} logo`} className="w-full h-full object-contain" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-marcellus text-sm text-[#123524] block leading-tight">{org.name}</span>
                          <span
                            className="text-[9px] font-bold uppercase tracking-wider block mt-0.5"
                            style={{ color: org.theme.heading }}
                          >
                            {org.category}
                          </span>
                          <span className="text-[10px] text-stone-500 block mt-1 truncate">{org.tagline}</span>
                        </span>
                        <CheckCircle2
                          size={18}
                          className={isSelected ? 'shrink-0' : 'text-stone-200 shrink-0'}
                          style={isSelected ? { color: org.theme.heading } : undefined}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Tab Content (Clean Authentic Cards — No AI Side Highlighting) */}
        <div className="w-full">
          
          {/* ========================================================================= */}
          {/* 1. ABOUT UMAK TAB CONTENT (Official UMak Identity Design System)          */}
          {/* ========================================================================= */}
          {activeInfoTab === 'umak' && (
            <div className="space-y-6 animate-fade-in text-left">
              
              {/* UMak Campus Showcase Hero Banner */}
              <div className="relative rounded-lg overflow-hidden border border-[#d0d5e8] shadow-xs bg-[#111c4e] min-h-[220px] sm:min-h-[260px] flex items-end p-6 sm:p-8">
                <img 
                  src="/images/umak_bg.jpg" 
                  alt="University of Makati Campus" 
                  className="absolute inset-0 w-full h-full object-cover object-center opacity-40 mix-blend-luminosity" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#111c4e] via-[#111c4e]/70 to-[#111c4e]/30" />
                
                <div className="relative z-10 space-y-2 max-w-2xl text-left">
                  <div className="inline-flex items-center gap-2 bg-[#f5ec3a] text-[#111c4e] px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wider shadow-xs">
                    <span>Official Campus Profile</span>
                  </div>
                  <h3 className="font-sans font-bold text-2xl sm:text-3xl text-white leading-tight">
                    Center of Glocal Higher Education
                  </h3>
                  <p className="text-xs sm:text-sm text-[#e8eaf2] leading-relaxed max-w-xl">
                    Located in the heart of Makati City, the University of Makati provides premier education, modern academic laboratories, and holistic youth leadership development.
                  </p>
                </div>
              </div>

              {/* Overview & Philosophy box */}
              <div className="bg-white p-6 rounded-lg border border-[#d0d5e8] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e4e8f4] pb-4">
                  <div>
                    <h3 className="font-sans font-bold text-xl md:text-2xl text-[#111c4e]">
                      Overview &amp; Philosophy
                    </h3>
                    <p className="text-xs text-[#47528a] mt-0.5">
                      University of Makati — Official Institutional Profile
                    </p>
                  </div>
                  <a
                    href="https://www.umak.edu.ph/about/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#111c4e] hover:bg-[#47528a] text-white px-5 py-2.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors shadow-xs shrink-0"
                  >
                    <span>Visit Official Website</span>
                    <ExternalLink size={13} />
                  </a>
                </div>

                <p className="text-sm md:text-base text-[#222222] leading-relaxed">
                  The <strong className="text-[#111c4e] font-semibold">University of Makati (UMak)</strong> is the public university of the City of Makati. Its core mandate is to serve the children of less privileged citizens of Makati, enabling them to participate in and benefit from the city's economic progress.
                </p>

                {/* Philosophy Quote Banner with Campus Photo Ambient Backdrop */}
                <div className="relative overflow-hidden bg-[#111c4e] text-white p-5 rounded-lg border border-[#28336b] space-y-2">
                  <img 
                    src="/images/umak_bg.jpg" 
                    alt="" 
                    className="absolute inset-0 w-full h-full object-cover opacity-15 pointer-events-none" 
                  />
                  <div className="relative z-10">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#f5ec3a]">
                      Institutional Philosophy
                    </span>
                    <blockquote className="font-sans text-sm sm:text-base md:text-lg italic text-white leading-relaxed mt-1">
                      "We must never forget who we are, whom we are for, and what we have to do for those for whom we are."
                    </blockquote>
                    <p className="text-xs text-[#c0d5f0] pt-2">
                      Founding: Established in 1972 as the Makati Polytechnic Community College.
                    </p>
                  </div>
                </div>
              </div>

              {/* Vision & Mission Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg border border-[#d0d5e8] space-y-2">
                  <span className="block text-xs font-bold uppercase tracking-wider text-[#105389]">
                    Vision
                  </span>
                  <p className="text-sm md:text-base text-[#222222] leading-relaxed">
                    To be a premier globally recognized local university where integrated and sustainable quality education translates to social equity and excellence.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-[#d0d5e8] space-y-2">
                  <span className="block text-xs font-bold uppercase tracking-wider text-[#105389]">
                    Mission
                  </span>
                  <p className="text-sm md:text-base text-[#222222] leading-relaxed">
                    To develop resilient, innovative, socially responsible, and excellent industry-ready practitioners and leaders through instruction, research, extension, and production; and to nurture highly competent and committed human resources.
                  </p>
                </div>
              </div>

              {/* Core Values & Goals Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Core Values */}
                <div className="lg:col-span-7 bg-white p-6 rounded-lg border border-[#d0d5e8] space-y-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-[#111c4e] border-b border-[#e4e8f4] pb-2">
                    Core Values (R.I.S.E.)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded bg-[#f5f6fa] border border-[#d0d5e8]">
                      <strong className="text-[#111c4e] block text-sm font-bold">Resilience</strong>
                      <span className="text-[#47528a] text-xs leading-normal block mt-1">Adaptability and steadfastness in times of crisis.</span>
                    </div>
                    <div className="p-3.5 rounded bg-[#f5f6fa] border border-[#d0d5e8]">
                      <strong className="text-[#111c4e] block text-sm font-bold">Innovativeness</strong>
                      <span className="text-[#47528a] text-xs leading-normal block mt-1">Pioneering creative solutions and progressive education.</span>
                    </div>
                    <div className="p-3.5 rounded bg-[#f5f6fa] border border-[#d0d5e8]">
                      <strong className="text-[#111c4e] block text-sm font-bold">Social Responsibility</strong>
                      <span className="text-[#47528a] text-xs leading-normal block mt-1">Commitment to community upliftment and ethical service.</span>
                    </div>
                    <div className="p-3.5 rounded bg-[#f5f6fa] border border-[#d0d5e8]">
                      <strong className="text-[#111c4e] block text-sm font-bold">Excellence</strong>
                      <span className="text-[#47528a] text-xs leading-normal block mt-1">Setting benchmarks in academic and professional standards.</span>
                    </div>
                  </div>
                </div>

                {/* Goals */}
                <div className="lg:col-span-5 bg-white p-6 rounded-lg border border-[#d0d5e8] space-y-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-[#111c4e] border-b border-[#e4e8f4] pb-2">
                    Institutional Goals
                  </h4>
                  <ul className="list-disc list-inside text-[#222222] text-xs md:text-sm space-y-2">
                    <li>Become the builder of sectoral and industry practitioners and leaders.</li>
                    <li>Produce impactful research and sustainable extension services for community growth.</li>
                    <li>Excel in UMak–distinct, glocal professional and skills-based programs.</li>
                    <li>Adhere to the principles of good governance and public service.</li>
                  </ul>
                </div>
              </div>

              {/* Quick Figures & Official Songs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg border border-[#d0d5e8] space-y-3">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-[#111c4e] border-b border-[#e4e8f4] pb-2">
                    Quick Figures &amp; Operations
                  </h4>
                  <div className="space-y-2 text-xs md:text-sm text-[#222222]">
                    <p><strong className="text-[#111c4e]">Students:</strong> Tens of thousands of regular college, senior high, and graduate students.</p>
                    <p><strong className="text-[#111c4e]">Operations:</strong> Features numerous programs granted with COPC (Certificate of Program Compliance) and hundreds of academic and administrative employees.</p>
                    <p><strong className="text-[#111c4e]">Programs:</strong> All programs are recognized by the Commission on Higher Education (CHED).</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-[#d0d5e8] space-y-3">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-[#111c4e] border-b border-[#e4e8f4] pb-2">
                    Governance &amp; Official Songs
                  </h4>
                  <div className="space-y-2 text-xs md:text-sm text-[#222222]">
                    <p><strong className="text-[#111c4e]">Governance & Leadership:</strong> Managed by a Board of Regents and an Executive Committee, led by the University President.</p>
                    <p><strong className="text-[#111c4e]">UMak Hymn:</strong> Focuses on the pride of Makati and the role of students as future builders of the land.</p>
                    <p><strong className="text-[#111c4e]">Makati March:</strong> A song dedicated to the city of Makati, its progress, and the spirit of its people.</p>
                  </div>
                </div>
              </div>

              {/* University Branding & Resources Card */}
              <div className="bg-white p-6 rounded-lg border border-[#d0d5e8] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-left space-y-1">
                  <span className="text-[11px] font-bold text-[#111c4e] uppercase tracking-wider">
                    University Branding &amp; Resources
                  </span>
                  <p className="text-xs text-[#47528a]">
                    The institution is registered as a trademark of the University of Makati (Philippines). For official inquiries or specific policy documents, visit the official website.
                  </p>
                </div>
                <a
                  href="https://www.umak.edu.ph/about/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#111c4e] hover:bg-[#47528a] text-white px-4 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-colors shadow-xs shrink-0"
                >
                  <span>umak.edu.ph/about</span>
                  <ExternalLink size={13} />
                </a>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. ABOUT CCIS COLLEGE TAB CONTENT (Clean Cards without Side Highlighting) */}
          {/* ========================================================================= */}
          {activeInfoTab === 'college' && (
            <div className="space-y-6 animate-fade-in text-left">
              {/* Welcome box */}
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#1A3C2E]/25 shadow-xs space-y-4">
                <h4 className="font-marcellus text-lg md:text-2xl text-[#1A3C2E] uppercase tracking-wide">
                  Welcome to College of Computing and Information Sciences!
                </h4>
                <p className="text-sm md:text-base text-stone-700 leading-relaxed font-sans">
                  The College of Computing and Information Sciences (CCIS) is the leading college in ICT education programs of the university by providing competitive, relevant and functional IT Curriculum responsive to the needs of the industrial and business organizations. The college has the following functions:
                </p>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-stone-700 list-disc list-inside font-sans">
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
                <div className="bg-white p-6 rounded-2xl border border-[#1A3C2E]/25 shadow-xs space-y-2">
                  <span className="block text-xs font-bold text-[#1A3C2E] uppercase tracking-wider font-sans">Vision</span>
                  <p className="text-sm md:text-base text-stone-700 leading-relaxed font-sans">
                    The college envisions to lead in the development of excellent professionals and champions of social equity in the global field of computing and information sciences.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-[#1A3C2E]/25 shadow-xs space-y-2">
                  <span className="block text-xs font-bold text-[#1A3C2E] uppercase tracking-wider font-sans">Mission</span>
                  <p className="text-sm md:text-base text-stone-700 leading-relaxed font-sans">
                    Guided by its vision, the college produces practitioners and leaders in computing and information sciences who are resilient, industry-ready, and socially responsible through innovative curriculum design and dynamic delivery systems.
                  </p>
                </div>
              </div>

              {/* Core Values & Program Offerings Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Core Values */}
                <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-[#1A3C2E]/25 shadow-xs space-y-4">
                  <span className="block text-xs font-bold text-[#1A3C2E] uppercase tracking-wider border-b border-[#1A3C2E]/15 pb-2 font-sans">Core Values</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-[#FAF7EA] border border-[#1A3C2E]/20">
                      <strong className="text-[#1A3C2E] block text-sm font-bold font-sans">God Fearing</strong>
                      <span className="text-stone-600 text-xs leading-snug block mt-0.5 font-sans">Reverence and moral uprightness.</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#FAF7EA] border border-[#1A3C2E]/20">
                      <strong className="text-[#1A3C2E] block text-sm font-bold font-sans">Industry</strong>
                      <span className="text-stone-600 text-xs leading-snug block mt-0.5 font-sans">Diligence in pursuing tasks.</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#FAF7EA] border border-[#1A3C2E]/20">
                      <strong className="text-[#1A3C2E] block text-sm font-bold font-sans">Fortitude</strong>
                      <span className="text-stone-600 text-xs leading-snug block mt-0.5 font-sans">Courage and strength in character.</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#FAF7EA] border border-[#1A3C2E]/20">
                      <strong className="text-[#1A3C2E] block text-sm font-bold font-sans">Trustworthy</strong>
                      <span className="text-stone-600 text-xs leading-snug block mt-0.5 font-sans">Deserving of confidence.</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#FAF7EA] border border-[#1A3C2E]/20 sm:col-span-2">
                      <strong className="text-[#1A3C2E] block text-sm font-bold font-sans">Creativity</strong>
                      <span className="text-stone-600 text-xs leading-snug block mt-0.5 font-sans">Ability to make new ideas and innovative solutions.</span>
                    </div>
                  </div>
                </div>

                {/* Offerings */}
                <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-[#1A3C2E]/25 shadow-xs space-y-4">
                  <span className="block text-xs font-bold text-[#1A3C2E] uppercase tracking-wider border-b border-[#1A3C2E]/15 pb-2 font-sans">Program Offerings</span>
                  <div className="space-y-4 font-sans">
                    <div className="text-sm">
                      <span className="font-bold text-[#1A3C2E] block mb-1">Baccalaureate Programs</span>
                      <ul className="list-disc list-inside text-stone-600 text-xs space-y-1">
                        <li>B.S. in Information Technology (INS Track)</li>
                        <li>B.S. in Computer Science (CDS Track)</li>
                        <li>B.S. in Computer Science (AppDev Track)</li>
                      </ul>
                    </div>
                    <div className="text-sm border-t border-[#1A3C2E]/15 pt-2">
                      <span className="font-bold text-[#1A3C2E] block mb-1">Non-Baccalaureate Programs</span>
                      <ul className="list-disc list-inside text-stone-600 text-xs space-y-1">
                        <li>Diploma in Application Development</li>
                        <li>Diploma in Computer Network Administration</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. STUDENT ORGANIZATIONS TAB CONTENT                                      */}
          {/* ========================================================================= */}
          {activeInfoTab === 'org' && (
            <div className="space-y-6 animate-fade-in text-left">
              <div
                className="bg-white p-5 sm:p-6 rounded-2xl border shadow-xs flex flex-col sm:flex-row items-start sm:items-center gap-5"
                style={{ borderColor: selectedOrg.theme.primary }}
              >
                <div
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white p-2 border-2 shadow-sm shrink-0 flex items-center justify-center overflow-hidden"
                  style={{ borderColor: selectedOrg.theme.accent }}
                >
                  <img
                    src={selectedOrg.logo}
                    alt={`${selectedOrg.name} logo`}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="space-y-2 min-w-0">
                  <span
                    className="inline-flex px-3 py-1 rounded-full border text-[9px] font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: selectedOrg.theme.primary,
                      borderColor: selectedOrg.theme.accent,
                      color: selectedOrg.theme.onPrimary
                    }}
                  >
                    {selectedOrg.shortName}
                  </span>
                  <h3 className="font-marcellus text-xl sm:text-2xl text-[#123524] leading-tight">
                    Organization Profile
                  </h3>
                  <p className="text-stone-600 text-xs sm:text-sm leading-relaxed font-sans">
                    {selectedOrg.description}
                  </p>
                </div>
              </div>

              <p className="text-stone-800 text-base md:text-lg leading-relaxed font-sans">
                {selectedOrg.overview}
              </p>
              
              <div
                className="p-5 rounded-2xl border"
                style={{
                  backgroundColor: selectedOrg.theme.primary,
                  borderColor: selectedOrg.theme.accent,
                  color: selectedOrg.theme.onPrimary
                }}
              >
                <blockquote className="font-sans text-sm sm:text-base italic leading-relaxed">
                  {selectedOrg.missionQuote}
                </blockquote>
              </div>

              <div
                className="bg-white p-6 rounded-2xl border shadow-xs space-y-4"
                style={{ borderColor: selectedOrg.theme.primary }}
              >
                <h4
                  className="font-marcellus text-base md:text-lg text-[#123524] uppercase tracking-wide border-b pb-2"
                  style={{ borderBottomColor: selectedOrg.theme.accent }}
                >
                  Key Functions &amp; Objectives
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedOrg.functions.map((fn, idx) => (
                    <div
                      key={idx}
                      className="bg-[#FAF7EA] p-4 rounded-xl border flex gap-3"
                      style={{ borderColor: selectedOrg.theme.primary }}
                    >
                      <CheckCircle2
                        size={20}
                        className="shrink-0 mt-0.5"
                        style={{ color: selectedOrg.theme.heading }}
                      />
                      <div className="font-sans">
                        <strong className="text-[#123524] block text-sm font-bold mb-0.5">{fn.title}</strong>
                        <span className="text-stone-600 text-xs leading-relaxed">{fn.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* ================================================================= */}
      {/* LEADERSHIP DIRECTORY (Shown for Student Orgs tab)                 */}
      {/* ================================================================= */}
      {activeInfoTab === 'org' && (
        <section className="py-16 bg-white border-b border-stone-200 animate-fade-in" id="officer-directory">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center mb-12">
              <span className="font-sans font-semibold text-xs uppercase tracking-wider text-stone-500">Leadership</span>
              <h2 className="font-sans font-bold text-3xl md:text-4xl text-[#1A3C2E] mt-1">
                {selectedOrg.name} Officers
              </h2>
              <p className="text-stone-500 text-xs md:text-sm mt-1 uppercase tracking-wider">
                {selectedOrg.tagline}
              </p>
              <div
                className="h-1 w-16 mx-auto mt-3 rounded-full mb-6"
                style={{ backgroundColor: selectedOrg.theme.accent }}
              />
              
              {/* Switcher & Academic Year Selection */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
                <div className="flex flex-wrap items-center justify-center gap-1.5 bg-[#FAF7EA] rounded-2xl border border-stone-200 p-1 shadow-xs font-sans">
                  {STUDENT_ORGS.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => setSelectedOrgId(org.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        selectedOrgId === org.id
                          ? 'shadow-xs'
                          : 'text-stone-600 hover:text-[#1A3C2E]'
                      }`}
                      style={selectedOrgId === org.id ? {
                        backgroundColor: org.theme.primary,
                        color: org.theme.onPrimary
                      } : undefined}
                    >
                      <img
                        src={org.logo}
                        alt=""
                        className="w-5 h-5 rounded-full bg-white object-contain border border-white/70"
                        aria-hidden="true"
                      />
                      {org.shortName}
                    </button>
                  ))}
                </div>

                {/* Academic Year Dropdown */}
                <div className="relative inline-flex items-center">
                  <select
                    value={selectedTerm}
                    onChange={(e) => setSelectedTerm(e.target.value)}
                    className="appearance-none bg-[#FAF7EA] hover:bg-white text-[#1A3C2E] text-xs font-bold font-sans rounded-full border border-stone-200 pl-4 pr-9 py-2 shadow-xs outline-none focus:border-[#F5B400] transition-all cursor-pointer"
                    id="officer-year-select"
                  >
                    {['2026-2027', '2025-2026', '2024-2025'].map((t) => (
                      <option key={t} value={t} className="bg-white text-stone-800 font-sans">
                        AY {t}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-600 pointer-events-none" />
                </div>
              </div>
            </div>

            {filteredOfficers.length === 0 ? (
              <div className="text-center py-12 bg-[#FAF7EA]/30 rounded-lg border border-stone-200 max-w-lg mx-auto">
                <Shield className="mx-auto text-stone-300 mb-3" size={36} />
                <h3 className="font-sans font-bold text-stone-600 text-sm">No Officer Records</h3>
                <p className="text-stone-400 text-xs mt-1">No officers have been registered for {selectedOrg.name} in AY {selectedTerm} yet.</p>
              </div>
            ) : (
              <>
                {/* Executive Board Section */}
                {execBoard.length > 0 && (
                  <div className="mb-16">
                    <div className="text-left mb-6">
                      <h3 className="font-sans font-bold text-[#1A3C2E] text-base md:text-lg uppercase tracking-wider border-b border-stone-200 pb-2">
                        Executive Board
                      </h3>
                    </div>
                    <div className="space-y-6 md:space-y-8">
                      <div className="flex flex-wrap gap-6 md:gap-8 justify-center">
                        {execBoard.slice(0, 3).map(renderOfficerCard)}
                      </div>
                      {execBoard.length > 3 && (
                        <div className="flex flex-wrap gap-6 md:gap-8 justify-center">
                          {execBoard.slice(3).map(renderOfficerCard)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Year Level Representatives Section */}
                {yearReps.length > 0 && (
                  <div className="mb-16">
                    <div className="text-left mb-6">
                      <h3 className="font-sans font-bold text-[#1A3C2E] text-base md:text-lg uppercase tracking-wider border-b border-stone-200 pb-2">
                        Year Level Representatives
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-6 md:gap-8 justify-center">
                      {yearReps.map(renderOfficerCard)}
                    </div>
                  </div>
                )}

                {/* Executive Committee (ExeCom) / Committee Heads Section */}
                {(committeeHeads.length > 0 || otherOfficers.length > 0) && (
                  <div>
                    <div className="text-left mb-6">
                      <div className="border-b border-stone-200 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <h3 className="font-sans font-bold text-[#1A3C2E] text-base md:text-lg uppercase tracking-wider flex items-center gap-2">
                          <span>Executive Committee</span>
                          <span className="text-[10px] font-bold text-[#1A3C2E] bg-[#F5B400] px-2 py-0.5 rounded uppercase">ExeCom</span>
                        </h3>
                        <span className="text-xs text-stone-500 font-sans">Working Committee Heads & Division Chairs</span>
                      </div>
                      <p className="text-xs text-stone-500 font-sans mt-1.5">
                        Leading our specialized working committees, operations, and student initiatives.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-6 md:gap-8 justify-center">
                      {[...committeeHeads, ...otherOfficers].map(renderOfficerCard)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* 4.4.3 Committee Directory Tabs (Shown for Student Council)        */}
      {/* ================================================================= */}
      {activeInfoTab === 'org' && selectedOrgId === 'council' && (
        <section className="py-16 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8 border-b border-[#1A3C2E]/20 animate-fade-in" id="committees-directory">
          <div className="text-center mb-10">
            <span className="font-mono font-semibold text-xs uppercase tracking-wider text-stone-500">Divisions</span>
            <h2 className="font-marcellus text-3xl md:text-4xl text-[#1A3C2E] mt-1">Our Working Committees</h2>
            <p className="text-stone-500 text-xs md:text-sm mt-1 uppercase tracking-wider font-mono">Driven by dedication, shaped by technology</p>
            <div className="h-1 w-16 bg-[#F5B400] mx-auto mt-3 rounded-full" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-left">
            
            {/* Navigation Tab Column */}
            <div className="lg:col-span-4 flex flex-col gap-2 pr-2">
              {committees.map((com) => (
                <button
                  key={com.id}
                  onClick={() => setActiveCommitteeTab(com.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left border font-sans font-bold text-xs tracking-wide transition-all cursor-pointer ${
                    activeCommitteeTab === com.id
                      ? 'bg-white border-[#1A3C2E]/40 text-[#1A3C2E] shadow-sm'
                      : 'bg-stone-50 border-[#1A3C2E]/20 text-stone-600 hover:bg-white hover:text-[#1A3C2E]'
                  }`}
                >
                  {getCommitteeIcon(com.slug || '')}
                  {com.name}
                </button>
              ))}
            </div>

            {/* Details Content Box */}
            <div className="lg:col-span-8 bg-white p-6 md:p-8 rounded-2xl border border-[#1A3C2E]/25 shadow-xs min-h-[300px]">
              {committees.filter(c => c.id === activeCommitteeTab).map((com) => (
                <div key={com.id} className="space-y-6 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-[#FAF7EA] rounded-xl border border-[#1A3C2E]/20 flex items-center justify-center">
                      {getCommitteeIcon(com.slug || '')}
                    </div>
                    <div>
                      <h3 className="font-marcellus text-lg md:text-2xl text-[#1A3C2E]">
                        {com.name}
                      </h3>
                      <span className="text-xs text-stone-500 uppercase tracking-wider flex flex-wrap items-center gap-2 mt-0.5">
                        <Award size={12} className="text-[#F5B400] shrink-0" />
                        <span>Committee Head:</span>
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

                  <div className="space-y-3">
                    <h4 className="font-sans font-bold text-[#1A3C2E] text-xs uppercase tracking-wider border-b border-stone-100 pb-2">
                      Primary Responsibilities
                    </h4>
                    <ul className="grid grid-cols-1 gap-2">
                      {com.responsibilities.map((resp, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm my-0.5">
                          <span className="inline-flex items-center justify-center bg-[#FAF7EA] border border-stone-200 text-[#1A3C2E] font-mono text-[11px] rounded-full w-4 h-4 flex-shrink-0 font-bold mt-0.5">
                            {i + 1}
                          </span>
                          <span className="text-stone-700 leading-relaxed font-sans">{resp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {com.id === 'com-advertising' && (
                    <div className="mt-6 space-y-3">
                      <h4 className="font-sans font-bold text-[#1A3C2E] text-xs uppercase tracking-wider border-b border-stone-100 pb-2">
                        Specialized Sub-Teams
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-[#FAF7EA] border border-stone-200 p-3 rounded">
                          <span className="block font-sans font-bold text-xs text-[#1A3C2E] uppercase">Publicity Team</span>
                          <p className="text-[11px] text-stone-600 mt-1 leading-relaxed">
                            Writes captions, formal announcements, taglines, and storylines for council communications and films.
                          </p>
                        </div>
                        <div className="bg-[#FAF7EA] border border-stone-200 p-3 rounded">
                          <span className="block font-sans font-bold text-xs text-[#1A3C2E] uppercase">Creatives Team</span>
                          <p className="text-[11px] text-stone-600 mt-1 leading-relaxed">
                            Produces graphics, digital art, posters, illustrations, layouts, and multimedia motion designs.
                          </p>
                        </div>
                        <div className="bg-[#FAF7EA] border border-stone-200 p-3 rounded">
                          <span className="block font-sans font-bold text-xs text-[#1A3C2E] uppercase">Documentation Team</span>
                          <p className="text-[11px] text-stone-600 mt-1 leading-relaxed">
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
      )}

    </div>
  );
}
