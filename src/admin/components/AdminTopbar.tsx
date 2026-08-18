import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, LogOut, Menu, X } from 'lucide-react';
import { useAdmin } from '../AdminContext';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from '../../types/database';

interface AdminTopbarProps {
  sidebarCollapsed: boolean;
  onMobileMenuToggle: () => void;
  mobileMenuOpen: boolean;
}

const SECTION_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  announcements: 'Announcements Manager',
  registration: 'Registration Manager',
  photobooth: 'Photobooth Manager',
  officers: 'Officers & Committees',
  concerns: 'Concerns Inbox',
  messages: 'Concern Inbox',
  calendar: 'Event Calendar',
  settings: 'Settings & Roles',
};

export default function AdminTopbar({ sidebarCollapsed, onMobileMenuToggle, mobileMenuOpen }: AdminTopbarProps) {
  const { profile, signOut } = useAuth();
  const { activeSection } = useAdmin();
  const [showNotifs, setShowNotifs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const notifRef = useRef<HTMLDivElement>(null);

  // Close notifications on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 bg-white border-b border-gray-200 h-16 flex items-center px-4 md:px-6 gap-4 transition-all duration-300`}
      id="admin-topbar"
    >
      {/* Mobile menu toggle */}
      <button
        onClick={onMobileMenuToggle}
        aria-label={mobileMenuOpen ? 'Close admin menu' : 'Open admin menu'}
        aria-expanded={mobileMenuOpen}
        className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        id="admin-mobile-menu-toggle"
      >
        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Page title */}
      <h1 className="font-sans font-bold text-lg text-[#1A3C2E] tracking-tight hidden sm:block" id="admin-page-title">
        {SECTION_TITLES[activeSection] || 'Dashboard'}
      </h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="relative hidden md:block w-64">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..."
          className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-700 outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400] transition-colors"
          id="admin-global-search"
        />
      </div>

      {/* Notifications (lightweight placeholder — no DB table for notifs) */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setShowNotifs(!showNotifs)}
          aria-label="Notifications"
          aria-expanded={showNotifs}
          className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          id="admin-notifications-btn"
        >
          <Bell size={19} />
        </button>

        {showNotifs && (
          <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-slide-in-up z-50" id="admin-notif-dropdown">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-sans font-bold text-sm text-[#1A3C2E]">Notifications</span>
            </div>
            <div className="p-6 text-center text-sm text-gray-400">
              No new notifications
            </div>
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-[#1A3C2E] border-2 border-[#FAF7EA] flex items-center justify-center text-[#F5B400] font-black text-xs shadow-sm">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            (profile?.full_name || 'A')[0].toUpperCase()
          )}
        </div>
        <div className="hidden lg:flex flex-col min-w-0">
          <span className="text-xs font-bold text-[#222B26] truncate">{profile?.full_name || 'Admin'}</span>
          <span className="text-[10px] text-gray-400 font-mono truncate">
            {profile?.role ? ROLE_LABELS[profile.role] : 'Admin'}
          </span>
        </div>
        <button
          onClick={() => signOut()}
          aria-label="Log out"
          className="p-2 rounded-lg text-gray-400 hover:text-[#C0392B] hover:bg-red-50 transition-colors"
          title="Logout"
          id="admin-logout-btn"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
