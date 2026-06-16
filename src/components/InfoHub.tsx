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
import PublicEventCalendar, { UpcomingEventsList } from './PublicEventCalendar';

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

export default function InfoHub() {
  const { user, profile } = useAuth();
  const [activeCommitteeTab, setActiveCommitteeTab] = useState<string>('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  
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
          </div>

          <div className="lg:col-span-5 flex justify-center bg-white p-8 rounded-3xl shadow-md border border-[#1A3C2E]/5">
            <div className="flex flex-col items-center text-center space-y-4">
              <CouncilSeal size={150} interactive={true} />
              <div>
                <h4 className="font-sans font-bold text-lg text-[#1A3C2E]">CCIS Official Seal</h4>
                <p className="text-xs text-[#5E6E64] font-mono mt-1 uppercase tracking-wider">
                  Forest Green • Gold • Cream Canvas
                </p>
              </div>
            </div>
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
          <div className="lg:col-span-4 flex flex-col gap-2.5 lg:max-h-[500px] overflow-y-auto pr-2 admin-scrollbar">
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

      {/* 4.4.4 Event Calendar Section */}
      <section className="py-16 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8 border-b border-[#1A3C2E]/10" id="event-calendar">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          <div className="lg:col-span-5 space-y-6">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#5E6E64] font-bold">Timetables</span>
            <h2 className="font-sans font-black text-3xl md:text-4xl text-[#1A3C2E]">
              Academic &amp; Council Calendar
            </h2>
            <p className="text-[#5E6E64] text-sm md:text-base leading-relaxed">
              Track major student events, academic milestones, and council assemblies. Color markings differentiate priority timelines:
            </p>
            
            <div className="space-y-3 font-sans">
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-zinc-100">
                <span className="w-3.5 h-3.5 rounded-full bg-[#123524] flex-shrink-0" />
                <div>
                  <span className="block font-bold text-sm text-[#123524]">General Event Activity</span>
                  <span className="text-xs text-[#5E6E64]">Assemblies, sport volunteer calls, tutorials</span>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-zinc-100">
                <span className="w-3.5 h-3.5 rounded-full bg-[#FFBC00] flex-shrink-0" />
                <div>
                  <span className="block font-bold text-sm text-[#123524]">Priority Academic / Deadline Event</span>
                  <span className="text-xs text-[#5E6E64]">Midterms, high-priority submission dates</span>
                </div>
              </div>
            </div>

            <UpcomingEventsList />
          </div>

          <div className="lg:col-span-7 bg-white p-6 md:p-8 rounded-3xl border border-zinc-100 shadow-sm">
            <PublicEventCalendar />
          </div>

        </div>
      </section>



    </div>
  );
}
