import React, { useState } from 'react';
import { AdminProvider, useAdmin } from './AdminContext';
import AdminLogin from './AdminLogin';
import AdminSidebar from './components/AdminSidebar';
import AdminTopbar from './components/AdminTopbar';
import ToastContainer from './components/Toast';
import Dashboard from './sections/Dashboard';
import AnnouncementsManager from './sections/AnnouncementsManager';
import RegistrationManager from './sections/RegistrationManager';
import TicketScanner from './sections/TicketScanner';
import OfficersManager from './sections/OfficersManager';
import MessagesInbox from './sections/MessagesInbox';
import EventCalendar from './sections/EventCalendar';
import SettingsRoles from './sections/SettingsRoles';
import { useAuth } from '../context/AuthContext';

interface AdminAppProps {
  onExitAdmin: () => void;
}

export default function AdminApp({ onExitAdmin }: AdminAppProps) {
  return (
    <AdminProvider>
      <AdminAppInner onExitAdmin={onExitAdmin} />
    </AdminProvider>
  );
}

function AdminAppInner({ onExitAdmin }: AdminAppProps) {
  const { isAdmin, loading, profile } = useAuth();
  const { activeSection } = useAdmin();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A3C2E] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#F5B400] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return <AdminLogin />;
  }

  const renderSection = () => {
    // Role-based section visibility
    const role = profile?.role;
    switch (activeSection) {
      case 'dashboard': return <Dashboard />;
      case 'announcements':
        if (role === 'devcom_head' || role === 'comm_content') return <AnnouncementsManager />;
        return <Dashboard />;
      case 'registration':
        if (role === 'devcom_head' || role === 'comm_registration') return <RegistrationManager />;
        return <Dashboard />;
      case 'scanner':
        if (role === 'devcom_head' || role === 'comm_registration') return <TicketScanner />;
        return <Dashboard />;
      case 'officers':
        if (role === 'devcom_head') return <OfficersManager />;
        return <Dashboard />;
      case 'messages':
        if (role === 'devcom_head' || role === 'officer') return <MessagesInbox />;
        return <Dashboard />;
      case 'calendar':
        if (role === 'devcom_head' || role === 'comm_content') return <EventCalendar />;
        return <Dashboard />;
      case 'settings':
        if (role === 'devcom_head') return <SettingsRoles />;
        return <Dashboard />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F4] flex" id="admin-root">
      {/* Sidebar — desktop */}
      <div className="hidden md:block">
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onExitAdmin={onExitAdmin}
        />
      </div>

      {/* Mobile sidebar drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <AdminSidebar
            collapsed={false}
            onToggle={() => setMobileMenuOpen(false)}
            onExitAdmin={() => { setMobileMenuOpen(false); onExitAdmin(); }}
          />
        </div>
      )}

      {/* Main content area */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
        sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[260px]'
      }`}>
        <AdminTopbar
          sidebarCollapsed={sidebarCollapsed}
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          mobileMenuOpen={mobileMenuOpen}
        />

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto admin-scrollbar">
          {renderSection()}
        </main>
      </div>

      {/* Toast container */}
      <ToastContainer />
    </div>
  );
}
