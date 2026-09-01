import React, { lazy, Suspense, useEffect, useState } from 'react';
import { AdminProvider, useAdmin } from './AdminContext';
import AdminLogin from './AdminLogin';
import AdminSidebar from './components/AdminSidebar';
import AdminTopbar from './components/AdminTopbar';
import ToastContainer from './components/Toast';
import { useAuth } from '../context/AuthContext';
import { useRolePreview } from '../context/RolePreviewContext';
import { canAccessAdminSection } from './roleAccess';

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
  const { isAdmin, loading } = useAuth();
  const { activeSection, setActiveSection } = useAdmin();
  const { effectiveRole, isRolePreviewing } = useRolePreview();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const blockPreviewInteraction = (event: React.SyntheticEvent) => {
    if (!isRolePreviewing) return;
    event.preventDefault();
    event.stopPropagation();
  };

  useEffect(() => {
    if (isRolePreviewing && effectiveRole !== 'student' && !canAccessAdminSection(effectiveRole, activeSection)) {
      setActiveSection('dashboard');
    }
  }, [activeSection, effectiveRole, isRolePreviewing, setActiveSection]);

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
    if (!canAccessAdminSection(effectiveRole, activeSection)) {
      if (!isRolePreviewing) return <Dashboard />;
      return (
        <div className="rounded-xl border border-[#123524]/25 bg-white p-8 text-center text-sm text-[#5E6E64]">
          Student view: this role does not have access to the admin portal.
        </div>
      );
    }

    switch (activeSection) {
      case 'dashboard': return <Dashboard />;
      case 'announcements': return <AnnouncementsManager />;
      case 'registration': return <RegistrationManager />;
      case 'scanner': return <TicketScanner />;
      case 'officers': return <OfficersManager />;
      case 'messages': return <MessagesInbox />;
      case 'calendar': return <EventCalendar />;
      case 'settings': return <SettingsRoles />;
      case 'users': return <UserManager />;
      case 'verification': return <VerificationManager />;
      case 'faqs': return <FaqManager />;
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

        {isRolePreviewing && (
          <div role="status" aria-live="polite" className="border-b border-[#123524]/25 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-900">
            Role preview only. Content uses your DevCom access; admin controls are disabled and no changes can be saved.
          </div>
        )}

        {/* Page content */}
        <main
          inert={isRolePreviewing}
          onClickCapture={blockPreviewInteraction}
          onKeyDownCapture={blockPreviewInteraction}
          onSubmitCapture={blockPreviewInteraction}
          className="flex-1 min-h-0 w-full p-4 md:p-6 overflow-y-auto admin-scrollbar"
        >
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
