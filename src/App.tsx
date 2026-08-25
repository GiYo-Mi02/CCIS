import React, { useState, useEffect, Suspense, lazy } from 'react';
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
import { FullPageSkeleton } from './components/common/Skeleton';

const AuthPage = lazy(() => import('./pages/AuthPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const GalleryPage = lazy(() => import('./pages/GalleryPage'));
const BukasKabanPage = lazy(() => import('./pages/BukasKabanPage'));
const PatchPage = lazy(() => import('./pages/PatchPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

import { useAuth } from './context/AuthContext';
import SubscriptionPreferenceModal from './components/SubscriptionPreferenceModal';
import SupportWidget from './components/SupportWidget';

interface AppProps {
  onAdminSwitch?: () => void;
}

export default function App({ onAdminSwitch }: AppProps) {
  const [activeTab, setActiveTab] = useState<string>(() => window.location.pathname === '/privacy' ? 'privacy' : 'home');
  const [infoSubTab, setInfoSubTab] = useState<'umak' | 'college' | 'org'>('umak');
  const [preselectedEventId, setPreselectedEventId] = useState<string | null>(null);
  const { user, profile, setEmailPreferences, isPending, isUnverified, isAdmin, loading } = useAuth();

  const isUmakTheme = activeTab === 'info' && infoSubTab === 'umak';

  // Privacy is a linkable public page; other legacy views remain tab-based.
  useEffect(() => {
    if (!['/', '', '/privacy'].includes(window.location.pathname)) {
      window.history.replaceState(null, '', '/');
    }
    const handlePopState = () => setActiveTab(window.location.pathname === '/privacy' ? 'privacy' : 'home');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Multi-route smooth scroll coordinator (e.g. for scrolling to contact desks)
  useEffect(() => {
    if (activeTab === 'contact') {
      setActiveTab('messages');
    }
  }, [activeTab]);

  // Restore post-OAuth redirect return (e.g. returning to event registration after Google login)
  useEffect(() => {
    const savedTab = localStorage.getItem('ccis_auth_redirect_tab');
    const savedEvent = localStorage.getItem('ccis_auth_redirect_event');
    if (savedTab) {
      setActiveTab(savedTab);
      localStorage.removeItem('ccis_auth_redirect_tab');
    }
    if (savedEvent) {
      setPreselectedEventId(savedEvent);
      localStorage.removeItem('ccis_auth_redirect_event');
    }
  }, [user]);

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
    const targetPath = tab === 'privacy' ? '/privacy' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
    if (tab === 'registration' && eventId) {
      setPreselectedEventId(eventId);
    } else if (tab !== 'registration') {
      setPreselectedEventId(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  // Full-screen pages (no navbar/footer)
  if (activeTab === 'login' || (activeTab !== 'privacy' && user && !isAdmin && (!profile || !profile.profile_complete || (isPending && !isUnverified)))) {
    return (
      <Suspense fallback={<FullPageSkeleton />}>
        <AuthPage onNavigate={handleNavigate} />
      </Suspense>
    );
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
      <NavBar activeTab={activeTab} setActiveTab={handleNavigate} isUmakTheme={isUmakTheme} />

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
        <Suspense fallback={<FullPageSkeleton />}>
          {activeTab === 'info' && (
            <div className="animate-fade-in border-b border-[#1A3C2E]/10">
              <InfoHub 
                onNavigate={handleNavigate} 
                activeSubTab={infoSubTab}
                onSubTabChange={setInfoSubTab}
              />
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

          {activeTab === 'privacy' && (
            <div className="animate-fade-in">
              <PrivacyPolicyPage onNavigate={handleNavigate} />
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
        </Suspense>
      </main>

      {/* 5. Onboarding / Sign-in Subscription Preference Modal */}
      {user && profile && profile.profile_complete && !profile.email_subscription_decided && (
        <SubscriptionPreferenceModal
          isOpen={true}
          onClose={() => {
            void setEmailPreferences(false);
          }}
          onSave={async (subscribed) => {
            await setEmailPreferences(subscribed);
          }}
          userEmail={user.email || ''}
        />
      )}

      {/* 4. Foot banner site footer */}
      <Footer onNavClick={handleNavigate} onAdminSwitch={onAdminSwitch} isUmakTheme={isUmakTheme} />

      {/* Floating Support Chat Widget */}
      <SupportWidget onNavigate={handleNavigate} />
    </div>
  );
}
