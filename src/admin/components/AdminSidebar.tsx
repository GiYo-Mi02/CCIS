import React from 'react';
import {
  LayoutDashboard, Megaphone, ClipboardList,
  Users, CalendarDays, Settings, ArrowLeft, ChevronLeft, ChevronRight, MessageSquare, Scan, UserCog, HelpCircle, UserCheck
} from 'lucide-react';
import { useAdmin } from '../AdminContext';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'registration', label: 'Registration', icon: ClipboardList },
  { id: 'scanner', label: 'Ticket Scanner', icon: Scan },
  { id: 'verification', label: 'Verifications', icon: UserCheck },
  { id: 'officers', label: 'Officers & Committees', icon: Users },
  { id: 'users', label: 'User Management', icon: UserCog },
  { id: 'messages', label: 'Concern Inbox', icon: MessageSquare },
  { id: 'calendar', label: 'Event Calendar', icon: CalendarDays },
  { id: 'faqs', label: 'FAQ Manager', icon: HelpCircle },
  { id: 'settings', label: 'Settings & Roles', icon: Settings },
];

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onExitAdmin: () => void;
}

export default function AdminSidebar({ collapsed, onToggle, onExitAdmin }: AdminSidebarProps) {
  const { activeSection, setActiveSection } = useAdmin();
  const { profile } = useAuth();

  // Filter items by role
  const visibleNavItems = NAV_ITEMS.filter(item => {
    const role = profile?.role;
    if (item.id === 'messages') {
      return role === 'devcom_head' || role === 'officer';
    }
    if (item.id === 'scanner') {
      return role === 'devcom_head' || role === 'comm_registration';
    }
    if (item.id === 'verification') {
      return role === 'devcom_head' || role === 'comm_registration';
    }
    if (item.id === 'users') {
      return role === 'devcom_head';
    }
    if (item.id === 'faqs') {
      return role === 'devcom_head' || role === 'comm_content';
    }
    return true;
  });

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 z-40 bg-[#1A3C2E] text-[#FAF7EA] border-r border-[#F5B400]/20 flex flex-col transition-all duration-300 ease-in-out shadow-md ${
        collapsed ? 'admin-sidebar-collapsed' : 'admin-sidebar-width'
      }`}
      id="admin-sidebar"
    >
      {/* Header: Logo + label */}
      <div className={`flex items-center gap-3 px-4 h-16 border-b border-white/10 shrink-0 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#F5B400]/50 bg-white/10 shrink-0">
          <img
            src="/images/CCIS-Logo.png"
            alt="CCIS"
            className="w-full h-full object-contain"
            onError={(e) => {
              const el = e.target as HTMLImageElement;
              el.style.display = 'none';
            }}
          />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="font-sans font-black text-xs uppercase tracking-tight text-white truncate">
              CCIS DevCom
            </span>
            <span className="font-sans font-medium text-[11px] uppercase tracking-widest text-[#F5B400] truncate">
              Admin Panel
            </span>
          </div>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto admin-scrollbar py-3 px-2 space-y-0.5">
        {visibleNavItems.map((item) => {
          const isActive = activeSection === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 rounded-lg transition-all duration-200 relative group ${
                collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
              } ${
                isActive
                  ? 'bg-white/10 text-[#F5B400] border-l-4 border-[#F5B400] shadow-sm'
                  : 'text-[#FAF7EA]/70 hover:bg-white/5 hover:text-white border-l-4 border-transparent'
              }`}
              id={`admin-nav-${item.id}`}
              title={collapsed ? item.label : undefined}
              aria-label={item.label}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && (
                <span className="text-xs font-semibold tracking-wide truncate">{item.label}</span>
              )}
              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-[#222B26] text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer: Back to public site + collapse toggle */}
      <div className="border-t border-white/10 p-3 space-y-2 shrink-0">
        <button
          onClick={onExitAdmin}
          className={`w-full flex items-center gap-2 text-[#FAF7EA]/50 hover:text-[#F5B400] transition-colors rounded-lg px-3 py-2 hover:bg-white/5 ${
            collapsed ? 'justify-center' : ''
          }`}
          title="Back to Public Site"
          aria-label="Back to public site"
          id="admin-back-to-public"
        >
          <ArrowLeft size={15} />
          {!collapsed && <span className="text-[10px] font-bold uppercase tracking-wider">Public Site</span>}
        </button>

        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center text-[#FAF7EA]/30 hover:text-[#FAF7EA]/60 transition-colors rounded-lg py-1.5 hover:bg-white/5"
          id="admin-sidebar-toggle"
          aria-label={collapsed ? 'Expand admin sidebar' : 'Collapse admin sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
