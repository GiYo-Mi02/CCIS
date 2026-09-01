import React, { lazy, Suspense, useState } from 'react';
import { AdminProvider, useAdmin } from './AdminContext';
import AdminLogin from './AdminLogin';
import AdminSidebar from './components/AdminSidebar';
import AdminTopbar from './components/AdminTopbar';
import ToastContainer from './components/Toast';
import { useAuth } from '../context/AuthContext';

const Dashboard = lazy(() => import('./sections/Dashboard'));
const AnnouncementsManager = lazy(() => import('./sections/AnnouncementsManager'));
const RegistrationManager = lazy(() => import('./sections/RegistrationManager'));
const TicketScanner = lazy(() => import('./sections/TicketScanner'));
const OfficersManager = lazy(() => import('./sections/OfficersManager'));
const MessagesInbox = lazy(() => import('./sections/MessagesInbox'));
const EventCalendar = lazy(() => import('./sections/EventCalendar'));
const SettingsRoles = lazy(() => import('./sections/SettingsRoles'));
const UserManager = lazy(() => import('./sections/UserManager'));
const FaqManager = lazy(() => import('./sections/FaqManager'));
const VerificationManager = lazy(() => import('./sections/VerificationManager'));

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
    if (window.location.pathname.startsWith('/admin')) {
      window.history.replaceState({}, '', '/');
    }
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
      case 'users':
        if (role === 'devcom_head') return <UserManager />;
        return <Dashboard />;
      case 'verification':
        if (role === 'devcom_head' || role === 'comm_registration') return <VerificationManager />;
        return <Dashboard />;
      case 'faqs':
        if (role === 'devcom_head' || role === 'comm_content') return <FaqManager />;
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
          <button
            type="button"
            aria-label="Close mobile navigation"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <AdminSidebar
            collapsed={false}
            onToggle={() => setMobileMenuOpen(false)}
            onExitAdmin={() => { setMobileMenuOpen(false); onExitAdmin(); }}
          />
        </div>
      )}

      {/* Main content area */}
      <div className={`flex-1 min-w-0 w-full flex flex-col min-h-screen transition-all duration-300 ${
        sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[260px]'
      }`}>
        <AdminTopbar
          sidebarCollapsed={sidebarCollapsed}
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          mobileMenuOpen={mobileMenuOpen}
        />

        {/* Page content */}
        <main className="flex-1 min-h-0 w-full p-4 md:p-6 overflow-y-auto admin-scrollbar">
          <Suspense fallback={<div className="p-8 text-sm text-[#5E6E64]">Loading section...</div>}>
            {renderSection()}
          </Suspense>
        </main>
      </div>

      {/* Toast container */}
      <ToastContainer />
    </div>
  );
}
