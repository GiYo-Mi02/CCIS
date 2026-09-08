import React, { useState, useEffect, Suspense, lazy } from 'react';
import NavBar from './components/NavBar';
import Hero from './components/Hero';
import Footer from './components/Footer';
import { FullPageSkeleton } from './components/common/Skeleton';
import { CalendarDays, Zap } from 'lucide-react';

const AuthPage = lazy(() => import('./pages/AuthPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const GalleryPage = lazy(() => import('./pages/GalleryPage'));
const BukasKabanPage = lazy(() => import('./pages/BukasKabanPage'));
const PatchPage = lazy(() => import('./pages/PatchPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const InfoHub = lazy(() => import('./components/InfoHub'));
const LoadingScreen = lazy(() => import('./components/LoadingScreen'));
const Announcements = lazy(() => import('./components/Announcements'));
const PublicEventCalendar = lazy(() => import('./components/PublicEventCalendar'));
const UpcomingEventsList = lazy(() => import('./components/PublicEventCalendar').then(({ UpcomingEventsList }) => ({ default: UpcomingEventsList })));
const FaqSection = lazy(() => import('./components/FaqSection'));
const DeveloperDedication = lazy(() => import('./components/DeveloperDedication'));
const RegistrationSection = lazy(() => import('./components/Registration'));

import { useAuth } from './context/AuthContext';
import { useRolePreview } from './context/RolePreviewContext';
import { canManagePublicPage } from './admin/roleAccess';
import { ROLE_LABELS, type UserRole } from './types/database';
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
  const { effectiveRole, isRolePreviewing, previewRole, startRolePreview, exitRolePreview } = useRolePreview();

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
  const previewingManagedPage = isRolePreviewing && ['gallery', 'transparency', 'patch'].includes(activeTab);
  const blockPreviewInteraction = (event: React.SyntheticEvent) => {
    if (!previewingManagedPage) return;
    event.preventDefault();
    event.stopPropagation();
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
      <Suspense fallback={null}>
        <LoadingScreen />
      </Suspense>

      {/* 1. Header Navigation Bar */}
      <NavBar activeTab={activeTab} setActiveTab={handleNavigate} isUmakTheme={isUmakTheme} />

      {isRolePreviewing && (
        <div role="status" aria-live="polite" className="flex flex-wrap items-center justify-center gap-2 border-b border-[#123524]/25 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-900">
          <span>Public role preview: viewing {effectiveRole?.replace('_', ' ')}. Management controls are read-only.</span>
          {profile?.role === 'devcom_head' && (
            <>
              <label className="sr-only" htmlFor="public-role-preview">Preview public role</label>
              <select
                id="public-role-preview"
                value={previewRole ?? ''}
                onChange={(event) => {
                  const role = event.target.value as UserRole;
                  if (role) startRolePreview(role);
                  else exitRolePreview();
                }}
                className="rounded border border-[#123524]/25 bg-white px-2 py-1 text-xs font-semibold text-[#123524]"
              >
                <option value="">Preview role</option>
                {(Object.keys(ROLE_LABELS) as UserRole[]).map(role => (
                  <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                ))}
              </select>
            </>
          )}
          <button type="button" onClick={exitRolePreview} className="underline underline-offset-2">Exit preview</button>
        </div>
      )}

      {/* 2. Primary Layout Render */}
      <main
        inert={previewingManagedPage}
        onClickCapture={blockPreviewInteraction}
        onKeyDownCapture={blockPreviewInteraction}
        onSubmitCapture={blockPreviewInteraction}
        className="flex-1"
      >
        {activeTab === 'home' && (
          <div className="animate-fade-in">
            {/* Hero welcome sector */}
            <Hero 
              onLearnMoreClick={handleLearnMore} 
              onAnnouncementsClick={handleAnnouncementsRoute} 
            />
            
            {/* Announcements Board Quick Strip */}
            <Suspense fallback={null}>
              <Announcements previewMode={true} onViewAllClick={handleAnnouncementsRoute} />
            </Suspense>
            
            {/* Academic & Council Calendar (Timetable) */}
            <section className="mx-auto max-w-7xl border-b border-[#123524]/10 px-4 py-16 sm:px-6 lg:px-8" id="event-calendar">
              <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 xl:gap-12">
                
                <div className="lg:col-span-5 space-y-6">
                  <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#5E6E64]">Timetables</span>
                  <h2 className="font-marcellus text-3xl leading-tight text-[#123524] md:text-4xl">
                    Academic &amp; Council Calendar
                  </h2>
                  <p className="text-sm leading-relaxed text-[#5E6E64] md:text-base">
                    Track major student events, academic milestones, and council assemblies.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-xl border border-[#123524]/10 bg-white p-4 shadow-sm">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#FAF7EA] text-[#123524]">
                        <CalendarDays size={18} aria-hidden="true" />
                      </span>
                      <div>
                        <span className="block text-sm font-bold text-[#123524]">General Event Activity</span>
                        <span className="text-xs text-[#5E6E64]">Assemblies, volunteer calls, tutorials</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-[#FFBC00]/40 bg-[#FFBC00]/10 p-4 shadow-sm">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#FFBC00]/20 text-[#8b6800]">
                        <Zap size={18} aria-hidden="true" />
                      </span>
                      <div>
                        <span className="block text-sm font-bold text-[#123524]">Priority Academic / Deadline Event</span>
                        <span className="text-xs text-[#5E6E64]">Midterms and high-priority deadlines</span>
                      </div>
                    </div>
                  </div>

                  <Suspense fallback={null}>
                    <UpcomingEventsList onNavigate={handleNavigate} />
                  </Suspense>
                </div>

                <div className="rounded-2xl border border-[#123524]/10 bg-white p-5 shadow-sm md:p-7 lg:col-span-7">
                  <Suspense fallback={null}>
                    <PublicEventCalendar onNavigate={handleNavigate} />
                  </Suspense>
                </div>

              </div>
            </section>
            
            {/* Developer dedication section */}
            <Suspense fallback={null}>
              <DeveloperDedication />
            </Suspense>
            
            {/* Common FAQ collapsible stack */}
            <Suspense fallback={null}>
              <FaqSection />
            </Suspense>
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
              <GalleryPage isAdmin={isAdmin && canManagePublicPage(effectiveRole, 'gallery')} />
            </div>
          )}

          {activeTab === 'transparency' && (
            <div className="animate-fade-in">
              <BukasKabanPage isAdmin={isAdmin && canManagePublicPage(effectiveRole, 'transparency')} />
            </div>
          )}

          {activeTab === 'patch' && (
            <div className="animate-fade-in">
              <PatchPage isAdmin={isAdmin && canManagePublicPage(effectiveRole, 'patch')} />
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
      {activeTab !== 'messages' && <SupportWidget onNavigate={handleNavigate} />}
    </div>
  );
}
