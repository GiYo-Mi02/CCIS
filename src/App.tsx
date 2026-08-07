import React, { useState, useEffect } from 'react';
import NavBar from './components/NavBar';
import Hero from './components/Hero';
import Announcements from './components/Announcements';
import InfoHub from './components/InfoHub';
import RegistrationSection from './components/Registration';
import PublicEventCalendar, { UpcomingEventsList } from './components/PublicEventCalendar';
import FaqSection from './components/FaqSection';
import DeveloperDedication from './components/DeveloperDedication';
import Footer from './components/Footer';
import LoadingScreen from './components/LoadingScreen';
import AuthPage from './pages/AuthPage';
import AccountPage from './pages/AccountPage';
import MessagesPage from './pages/MessagesPage';
import GalleryPage from './pages/GalleryPage';
import BukasKabanPage from './pages/BukasKabanPage';
import PatchPage from './pages/PatchPage';
import NotFoundPage from './pages/NotFoundPage';
import { useAuth } from './context/AuthContext';
import SubscriptionPreferenceModal from './components/SubscriptionPreferenceModal';
import SupportWidget from './components/SupportWidget';

interface AppProps {
  onAdminSwitch?: () => void;
}

const tabToPathMap: Record<string, string> = {
  home: '/',
  info: '/about',
  announcements: '/announcements',
  registration: '/events',
  gallery: '/gallery',
  transparency: '/transparency',
  patch: '/patch',
  messages: '/helpdesk',
  account: '/account',
  login: '/login',
  admin: '/admin/dashboard',
};

const pathToTabMap: Record<string, string> = {
  '/': 'home',
  '/home': 'home',
  '/about': 'info',
  '/info': 'info',
  '/announcements': 'announcements',
  '/events': 'registration',
  '/registration': 'registration',
  '/gallery': 'gallery',
  '/transparency': 'transparency',
  '/bukas-kaban': 'transparency',
  '/patch': 'patch',
  '/devlog': 'patch',
  '/helpdesk': 'messages',
  '/messages': 'messages',
  '/account': 'account',
  '/profile': 'account',
  '/login': 'login',
};

export default function App({ onAdminSwitch }: AppProps) {
  const getInitialTab = () => {
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/admin')) {
      return 'admin';
    }
    if (pathToTabMap[path]) {
      return pathToTabMap[path];
    }
    if (path !== '/' && path !== '') {
      return '404';
    }
    return 'home';
  };

  const [activeTab, setActiveTab] = useState<string>(getInitialTab);
  const [preselectedEventId, setPreselectedEventId] = useState<string | null>(null);
  const { user, profile, updateProfile, isPending, isUnverified, isAdmin, loading } = useAuth();

  // Strict Admin Route Guard: If a non-admin attempts to access /admin URLs, sanitize the URL back to '/'
  useEffect(() => {
    if (!loading && !isAdmin && (activeTab === 'admin' || window.location.pathname.startsWith('/admin'))) {
      if (window.location.pathname.startsWith('/admin')) {
        window.history.replaceState({}, '', '/');
      }
      setActiveTab('home');
    }
  }, [loading, isAdmin, activeTab]);

  // Listen to browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      if (path.startsWith('/admin')) {
        if (!isAdmin) {
          window.history.replaceState({}, '', '/');
          setActiveTab('home');
        } else {
          setActiveTab('admin');
        }
      } else if (pathToTabMap[path]) {
        setActiveTab(pathToTabMap[path]);
      } else if (path !== '/' && path !== '') {
        setActiveTab('404');
      } else {
        setActiveTab('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAdmin]);

  // Multi-route smooth scroll coordinator (e.g. for scrolling to contact desks)
  useEffect(() => {
    if (activeTab === 'contact') {
      setActiveTab('messages');
    }
  }, [activeTab]);

  const handleLearnMore = () => {
    handleNavigate('info');
  };

  const handleAnnouncementsRoute = () => {
    handleNavigate('announcements');
  };

  const handleNavigate = (tab: string, eventId?: string) => {
    if (tab === 'admin' && onAdminSwitch) {
      onAdminSwitch();
      return;
    }
    setActiveTab(tab);
    const targetPath = tabToPathMap[tab] || '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ tab }, '', targetPath);
    }
    if (tab === 'registration' && eventId) {
      setPreselectedEventId(eventId);
    } else if (tab !== 'registration') {
      setPreselectedEventId(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  // Full-screen pages (no navbar/footer)
  if (activeTab === 'login' || (user && (!profile || !profile.profile_complete || (isPending && !isUnverified)))) {
    return <AuthPage onNavigate={handleNavigate} />;
  }

  return (
    <div className="min-h-screen bg-[#FAF7EA] flex flex-col justify-between text-stone-800" id="ccis-root-layout">
      {isUnverified && (
        <div className="bg-[#FFBC00] text-[#123524] px-4 py-2.5 text-center text-xs font-bold font-sans flex items-center justify-center gap-2 shadow-sm border-b border-[#FFBC00]/20 shrink-0">
          <span>⚠️ Your account is pending admin verification. Fallback access enabled. Some features may be limited.</span>
        </div>
      )}

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
            
            {/* Developer dedication section */}
            <DeveloperDedication />
            
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

        {activeTab === 'gallery' && (
          <div className="animate-fade-in">
            <GalleryPage isAdmin={isAdmin} />
          </div>
        )}

        {activeTab === 'transparency' && (
          <div className="animate-fade-in">
            <BukasKabanPage isAdmin={isAdmin} />
          </div>
        )}

        {activeTab === 'patch' && (
          <div className="animate-fade-in">
            <PatchPage isAdmin={isAdmin} />
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

        {activeTab === '404' && (
          <div className="animate-fade-in">
            <NotFoundPage onNavigate={handleNavigate} />
          </div>
        )}
      </main>

      {/* 5. Onboarding / Sign-in Subscription Preference Modal */}
      {user && profile && profile.profile_complete && !profile.email_subscription_decided && (
        <SubscriptionPreferenceModal
          isOpen={true}
          onClose={() => {
            updateProfile({ email_subscription_decided: true });
          }}
          onSave={async (subscribed) => {
            await updateProfile({
              subscribe_announcements_events: subscribed,
              email_subscription_decided: true
            });
          }}
          userEmail={user.email || ''}
        />
      )}

      {/* 4. Foot banner site footer */}
      <Footer onNavClick={handleNavigate} onAdminSwitch={onAdminSwitch} />

      {/* Floating Support Chat Widget */}
      <SupportWidget onNavigate={handleNavigate} />
    </div>
  );
}
