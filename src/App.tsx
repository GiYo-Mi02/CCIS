import React, { useState, useEffect } from 'react';
import NavBar from './components/NavBar';
import Hero from './components/Hero';
import Announcements from './components/Announcements';
import InfoHub from './components/InfoHub';
import RegistrationSection from './components/Registration';
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

  const handleNavigate = (tab: string) => {
    if (tab === 'admin' && onAdminSwitch) {
      onAdminSwitch();
      return;
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Full-screen pages (no navbar/footer)
  if (activeTab === 'login') {
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
            
            {/* Common FAQ collapsible stack */}
            <FaqSection />
          </div>
        )}

        {/* 3. Dedicated Inner Section Views */}
        {activeTab === 'info' && (
          <div className="animate-fade-in border-b border-[#1A3C2E]/10">
            <InfoHub />
          </div>
        )}

        {activeTab === 'announcements' && (
          <div className="animate-fade-in">
            <Announcements previewMode={false} />
          </div>
        )}

        {activeTab === 'registration' && (
          <div className="animate-fade-in">
            <RegistrationSection onNavigate={handleNavigate} />
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
