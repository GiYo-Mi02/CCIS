import React, { useState, useEffect } from 'react';
import NavBar from './components/NavBar';
import Hero from './components/Hero';
import Announcements from './components/Announcements';
import InfoHub from './components/InfoHub';
import RegistrationSection from './components/Registration';
import PublicEventCalendar, { UpcomingEventsList } from './components/PublicEventCalendar';
import FaqSection from './components/FaqSection';
import Footer from './components/Footer';
import LoadingScreen from './components/LoadingScreen';
import AuthPage from './pages/AuthPage';
import AccountPage from './pages/AccountPage';
import MessagesPage from './pages/MessagesPage';
import { useAuth } from './context/AuthContext';

interface AppProps {
  onAdminSwitch?: () => void;
}

export default function App({ onAdminSwitch }: AppProps) {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [preselectedEventId, setPreselectedEventId] = useState<string | null>(null);
  const { user, profile } = useAuth();

  // Multi-route smooth scroll coordinator (e.g. for scrolling to contact desks)
  useEffect(() => {
    if (activeTab === 'contact') {
      setActiveTab('messages');
    }
  }, [activeTab]);

  const handleLearnMore = () => {
    setActiveTab('info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAnnouncementsRoute = () => {
    setActiveTab('announcements');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (tab: string, eventId?: string) => {
    if (tab === 'admin' && onAdminSwitch) {
      onAdminSwitch();
      return;
    }
    setActiveTab(tab);
    if (tab === 'registration' && eventId) {
      setPreselectedEventId(eventId);
    } else if (tab !== 'registration') {
      setPreselectedEventId(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Full-screen pages (no navbar/footer)
  if (activeTab === 'login' || (user && profile && !profile.profile_complete)) {
    return <AuthPage onNavigate={handleNavigate} />;
  }

  return (
    <div className="min-h-screen bg-[#FAF7EA] flex flex-col justify-between text-stone-800" id="ccis-root-layout">
      {/* GSAP Loading Screen overlay */}
      <LoadingScreen />

      {/* 1. Header Navigation Bar */}
      <NavBar activeTab={activeTab} setActiveTab={handleNavigate} />

      {/* 2. Primary Layout Render */}
      <main className="flex-1">
        {activeTab === 'home' && (
          <div className="animate-fade-in">
            {/* Hero welcome sector */}
            <Hero 
              onLearnMoreClick={handleLearnMore} 
              onAnnouncementsClick={handleAnnouncementsRoute} 
            />
            
            {/* Announcements Board Quick Strip */}
            <Announcements previewMode={true} onViewAllClick={handleAnnouncementsRoute} />
            
            {/* Academic & Council Calendar (Timetable) */}
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

                  <UpcomingEventsList onNavigate={handleNavigate} />
                </div>

                <div className="lg:col-span-7 bg-white p-6 md:p-8 rounded-3xl border border-zinc-100 shadow-sm">
                  <PublicEventCalendar onNavigate={handleNavigate} />
                </div>

              </div>
            </section>
            
            {/* Common FAQ collapsible stack */}
            <FaqSection />
          </div>
        )}

        {/* 3. Dedicated Inner Section Views */}
        {activeTab === 'info' && (
          <div className="animate-fade-in border-b border-[#1A3C2E]/10">
            <InfoHub onNavigate={handleNavigate} />
          </div>
        )}

        {activeTab === 'announcements' && (
          <div className="animate-fade-in">
            <Announcements previewMode={false} />
          </div>
        )}

        {activeTab === 'registration' && (
          <div className="animate-fade-in">
            <RegistrationSection 
              onNavigate={handleNavigate} 
              preselectedEventId={preselectedEventId}
              onClearPreselected={() => setPreselectedEventId(null)}
            />
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="animate-fade-in">
            {user && profile ? (
              <MessagesPage onNavigate={handleNavigate} />
            ) : (
              <AuthPage onNavigate={handleNavigate} />
            )}
          </div>
        )}

        {activeTab === 'account' && (
          <div className="animate-fade-in">
            {user && profile ? (
              <AccountPage onNavigate={handleNavigate} />
            ) : (
              <AuthPage onNavigate={handleNavigate} />
            )}
          </div>
        )}
      </main>

      {/* 4. Foot banner site footer */}
      <Footer onNavClick={handleNavigate} onAdminSwitch={onAdminSwitch} />
    </div>
  );
}
