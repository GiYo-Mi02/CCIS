import React, { useState, useRef, useEffect } from 'react';
import { Menu, X, LogOut, User, Shield, MessageSquare } from 'lucide-react';
import CouncilSeal from './CouncilSeal';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface NavBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function NavBar({ activeTab, setActiveTab }: NavBarProps) {
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

    const checkUnread = async () => {
      try {
        const { data: con } = await supabase
          .from('conversations')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (con) {
          // Fetch the latest admin message ID to check if dismissed in localStorage
          const { data: latestMsg } = await supabase
            .from('messages')
            .select('id')
            .eq('conversation_id', con.id)
            .eq('sender_role', 'admin')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestMsg) {
            const lastDismissedId = localStorage.getItem(`dismissed_msg_${user.id}`);
            if (lastDismissedId === latestMsg.id) {
              setHasUnread(false);
              return;
            }
          }

          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', con.id)
            .eq('sender_role', 'admin')
            .eq('read_by_student', false);
          
          setHasUnread((count || 0) > 0);
        } else {
          setHasUnread(false);
        }
      } catch (err) {
        console.error('Error checking unread messages:', err);
      }
    };

    checkUnread();

    const channelId = `navbar_unread_messages_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          checkUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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
    { id: 'info', label: 'About CCIS' },
    { id: 'announcements', label: 'Announcements' },
    { id: 'registration', label: 'Our Events' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'transparency', label: 'Bukas Kaban' },
    { id: 'patch', label: 'Patch' },
  ];

  const handleNavClick = async (tabId: string) => {
    if (tabId === 'messages' && user) {
      setHasUnread(false);
      try {
        const { data: con } = await supabase
          .from('conversations')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (con) {
          const { data: latestMsg } = await supabase
            .from('messages')
            .select('id')
            .eq('conversation_id', con.id)
            .eq('sender_role', 'admin')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestMsg) {
            localStorage.setItem(`dismissed_msg_${user.id}`, latestMsg.id);
          }

          // Mark all admin messages as read in this conversation
          await supabase
            .from('messages')
            .update({ read_by_student: true })
            .eq('conversation_id', con.id)
            .eq('sender_role', 'admin')
            .eq('read_by_student', false);
        }
      } catch (err) {
        console.error('Failed to dismiss unread notifications:', err);
      }
    }
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await signOut();
    handleNavClick('home');
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-[#1A3C2E] text-[#FAF7EA] border-b-2 border-[#F5B400] shrink-0" id="nav-bar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Left: Brand Logo Block */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavClick('home')}>
            <div className="w-11 h-11 bg-[#FAF7EA] rounded-full flex items-center justify-center shadow-md border border-[#F5B400] overflow-hidden">
              <CouncilSeal size={38} interactive={false} src="/images/ccis_logo.jpg" />
            </div>
            <div className="flex flex-col">
              <span className="font-sans font-black uppercase text-sm tracking-tight text-[#FAF7EA]">
                CCIS Student Council
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#F5B400] font-bold">
                Centralized Website
              </span>
            </div>
          </div>

          {/* Center/Right: Desktop Navigation Items */}
          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`relative py-1 text-xs font-bold uppercase tracking-widest transition-all duration-300 ${
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
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full pl-1 pr-3 py-1 transition-all relative"
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
                          setHasUnread(false);
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
                className="bg-[#F5B400] text-[#1A3C2E] px-5 py-2 rounded-full font-sans font-black text-[11px] uppercase tracking-widest shadow-sm hover:bg-[#ffc522] transition-colors"
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
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out border-t border-[#F5B400]/10 ${
          mobileMenuOpen ? 'max-h-[500px] opacity-100 py-3 bg-[#132d22]' : 'max-h-0 opacity-0'
        }`}
        id="mobile-nav-panel"
      >
        <div className="px-3 pb-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium tracking-wide transition-all ${
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
                    setHasUnread(false);
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
