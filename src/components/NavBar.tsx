import React, { useState, useRef, useEffect } from 'react';
import { Menu, X, LogOut, User, Shield, MessageSquare } from 'lucide-react';
import CouncilSeal from './CouncilSeal';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface NavBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isUmakTheme?: boolean;
}

export default function NavBar({ activeTab, setActiveTab, isUmakTheme = false }: NavBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, profile, isAdmin, signOut, loading } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);

  // Check unread support messages for student
  useEffect(() => {
    if (!user) {
      setHasUnread(false);
      return;
    }

    let active = true;
    let inFlight = false;
    let lastCheckedAt = 0;

    const checkUnread = async (force = false) => {
      if (inFlight || (!force && Date.now() - lastCheckedAt < 60_000)) return;
      inFlight = true;
      try {
        const { data: con } = await supabase
          .from('conversations')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (con) {
          const { data: unread } = await supabase
            .from('messages')
            .select('id')
            .eq('conversation_id', con.id)
            .eq('sender_role', 'admin')
            .eq('read_by_student', false)
            .limit(1);

          if (active) setHasUnread(Boolean(unread?.length));
        } else {
          if (active) setHasUnread(false);
        }
      } catch (err) {
        console.error('Error checking unread messages:', err);
      } finally {
        lastCheckedAt = Date.now();
        inFlight = false;
      }
    };

    void checkUnread(true);

    const handleFocus = () => void checkUnread();
    const handleChatRead = () => setHasUnread(false);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('student-chat-read', handleChatRead);

    return () => {
      active = false;
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('student-chat-read', handleChatRead);
    };
  }, [user?.id]);

  // Close user menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'info', label: 'About' },
    { id: 'announcements', label: 'Announcements' },
    { id: 'registration', label: 'Our Events' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'transparency', label: 'Bukas Kaban' },
    { id: 'patch', label: 'Patch' },
  ];

  const handleNavClick = async (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await signOut();
    handleNavClick('home');
  };

  const isPatch = activeTab === 'patch';

  return (
    <nav 
      className={`z-50 w-full text-[#FAF7EA] shrink-0 transition-colors duration-500 ${
        isPatch
          ? 'absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/35 to-transparent border-b border-white/10 backdrop-blur-[2px]'
          : isUmakTheme 
            ? 'sticky top-0 bg-[#111c4e] border-b-2 border-[#f5ec3a]' 
            : 'sticky top-0 bg-[#1A3C2E] border-b-2 border-[#F5B400]'
      }`} 
      id="nav-bar"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Left: Brand Logo Block */}
          <div className="flex items-center gap-3 cursor-pointer select-none group" onClick={() => handleNavClick('home')} id="nav-brand-logo">
            {/* Logos: UMak Seal then CCIS Seal */}
            <div className="flex items-center gap-2 shrink-0">
              <img
                src="/images/UMak_Logo.png"
                alt="University of Makati Seal"
                className="w-10 h-10 md:w-11 md:h-11 object-contain drop-shadow"
              />
              <CouncilSeal 
                size={42} 
                interactive={false} 
                src="/images/CCIS-Logo.png" 
                className="w-10 h-10 md:w-11 md:h-11 drop-shadow"
              />
            </div>

            {/* Institutional Brand Text Lockup */}
            <div className="flex flex-col justify-center min-w-0">
              <span className="font-marcellus uppercase text-base sm:text-[17px] md:text-lg lg:text-[19px] font-normal tracking-[0.04em] text-[#FAF7EA] leading-none mb-0.5 group-hover:text-[#F5B400] transition-colors truncate">
                UNIVERSITY OF MAKATI
              </span>
              <span className="font-sans text-[7.5px] sm:text-[8.5px] md:text-[9.5px] lg:text-[10px] font-medium text-[#FAF7EA]/80 leading-tight group-hover:text-white transition-colors truncate">
                College of Computing and Information Sciences
              </span>
            </div>
          </div>

          {/* Center/Right: Desktop Navigation Items */}
          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`relative py-1 text-xs font-bold uppercase tracking-widest transition-colors duration-300 ${
                  activeTab === item.id 
                    ? 'text-[#F5B400] border-b border-[#F5B400]' 
                    : 'text-[#FAF7EA] hover:text-[#F5B400]'
                }`}
                id={`nav-item-${item.id}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Rightmost: Auth Action */}
          <div className="hidden md:flex items-center">
            {!loading && user && profile ? (
              /* Logged-in: Avatar + dropdown */
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full pl-1 pr-3 py-1 transition-colors relative"
                  id="nav-user-menu-toggle"
                >
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-white/10 border border-[#F5B400]/40 flex items-center justify-center flex-shrink-0">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-white font-black text-xs">
                        {(profile.full_name || 'U')[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-white/80 max-w-[100px] truncate">
                    {profile.full_name?.split(' ')[0] || 'Account'}
                  </span>
                  {hasUnread && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse border border-[#1A3C2E]" />
                  )}
                </button>

                {/* Dropdown */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-[#1A3C2E] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-fade-in z-50">
                    <div className="px-4 py-3 border-b border-white/5">
                      <p className="text-xs font-bold text-white truncate">{profile.full_name}</p>
                      <p className="text-[10px] font-mono text-white/40 truncate">{profile.email}</p>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => { setUserMenuOpen(false); handleNavClick('account'); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <User size={13} /> My Account
                      </button>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleNavClick('messages');
                        }}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <MessageSquare size={13} /> Message Support
                        </span>
                        {hasUnread && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        )}
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => { setUserMenuOpen(false); handleNavClick('admin'); }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-[#F5B400]/70 hover:text-[#F5B400] hover:bg-white/5 transition-colors"
                        >
                          <Shield size={13} /> Admin Panel
                        </button>
                      )}
                      <div className="border-t border-white/5 mt-1 pt-1">
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-rose-400/70 hover:text-rose-400 hover:bg-white/5 transition-colors"
                        >
                          <LogOut size={13} /> Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : !loading ? (
              /* Logged-out: Sign In button */
              <button
                onClick={() => handleNavClick('login')}
                className="bg-[#F5B400] text-[#1A3C2E] px-5 py-2 rounded font-sans font-black text-[11px] uppercase tracking-widest shadow-sm hover:bg-[#ffc522] transition-colors"
                id="nav-cta-signin"
              >
                SIGN IN
              </button>
            ) : null}
          </div>

          {/* Hamburger Menu Toggle (Mobile) */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-white hover:text-[#F5B400] hover:bg-white/5 transition-colors focus:outline-none relative"
              aria-label="Toggle Menu"
              id="mobile-menu-toggle"
            >
              {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
              {!mobileMenuOpen && hasUnread && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse border border-[#1A3C2E]" />
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer */}
      <div
        className={`md:hidden overflow-hidden transition-colors duration-300 ease-in-out border-t border-[#F5B400]/10 ${
          mobileMenuOpen 
            ? `max-h-[500px] opacity-100 py-3 ${
                isPatch 
                  ? 'bg-[#0a1510]/95 backdrop-blur-md border-b border-white/10' 
                  : isUmakTheme 
                    ? 'bg-[#060e33]' 
                    : 'bg-[#132d22]'
              }` 
            : 'max-h-0 opacity-0'
        }`}
        id="mobile-nav-panel"
      >
        <div className="px-3 pb-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium tracking-wide transition-colors ${
                activeTab === item.id
                  ? 'bg-[#1A3C2E] text-[#F5B400] border-l-4 border-[#F5B400] font-semibold pl-3'
                  : 'text-white/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
          <div className="pt-4 px-4">
            {user && profile ? (
              <div className="space-y-2">
                <button
                  onClick={() => handleNavClick('account')}
                  className="w-full flex items-center justify-center gap-2 bg-white/10 text-white py-3 rounded-full font-sans font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  <User size={14} /> My Account
                </button>
                <button
                  onClick={() => {
                    handleNavClick('messages');
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-white/10 text-white py-3 rounded-full font-sans font-bold text-xs uppercase tracking-wider transition-colors relative"
                >
                  <MessageSquare size={14} /> Message Support
                  {hasUnread && (
                    <span className="absolute top-3.5 right-6 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  )}
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleNavClick('admin')}
                    className="w-full flex items-center justify-center gap-2 bg-[#F5B400]/15 border border-[#F5B400]/30 text-[#F5B400] py-3 rounded-full font-sans font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    <Shield size={14} /> Admin Panel
                  </button>
                )}
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-300 py-2.5 rounded-full font-sans font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleNavClick('login')}
                className="w-full flex items-center justify-center gap-2 bg-[#F5B400] text-[#1A3C2E] py-3 rounded-full font-sans font-bold text-xs uppercase tracking-wider shadow-md transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
