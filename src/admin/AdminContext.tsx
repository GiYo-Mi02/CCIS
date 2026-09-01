import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { ToastMessage, UserRole } from '../types/database';
import { canPreviewRoles } from './roleAccess';
import { useAuth } from '../context/AuthContext';

interface AdminContextType {
  // Navigation
  activeSection: string;
  setActiveSection: (s: string) => void;
  previewRole: UserRole | null;
  effectiveRole: UserRole | null;
  isRolePreviewing: boolean;
  startRolePreview: (role: UserRole) => void;
  exitRolePreview: () => void;

  // Toast
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function useAdmin(): AdminContextType {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}

const sectionToPathMap: Record<string, string> = {
  dashboard: '/admin/dashboard',
  announcements: '/admin/announcements',
  registration: '/admin/events',
  scanner: '/admin/scanner',
  officers: '/admin/officers',
  messages: '/admin/messages',
  calendar: '/admin/calendar',
  settings: '/admin/settings',
  users: '/admin/users',
  verification: '/admin/verification',
  faqs: '/admin/faqs',
};

const pathToSectionMap: Record<string, string> = {
  '/admin': 'dashboard',
  '/admin/': 'dashboard',
  '/admin/dashboard': 'dashboard',
  '/admin/announcements': 'announcements',
  '/admin/events': 'registration',
  '/admin/registration': 'registration',
  '/admin/scanner': 'scanner',
  '/admin/officers': 'officers',
  '/admin/messages': 'messages',
  '/admin/inbox': 'messages',
  '/admin/calendar': 'calendar',
  '/admin/settings': 'settings',
  '/admin/roles': 'settings',
  '/admin/users': 'users',
  '/admin/verification': 'verification',
  '/admin/faqs': 'faqs',
};

function getInitialSection() {
  const path = window.location.pathname.toLowerCase();
  return pathToSectionMap[path] || 'dashboard';
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  // Navigation
  const [activeSection, setActiveSectionState] = useState(getInitialSection);
  const [previewRole, setPreviewRole] = useState<UserRole | null>(null);
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);

  React.useEffect(() => {
    if (previewUserId !== (profile?.id ?? null)) {
      setPreviewRole(null);
      setPreviewUserId(null);
    }
  }, [previewUserId, profile?.id]);

  // Listen to browser back/forward navigation within admin
  React.useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      if (path.startsWith('/admin')) {
        const section = pathToSectionMap[path] || 'dashboard';
        setActiveSectionState(section);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setActiveSection = useCallback((section: string) => {
    setActiveSectionState(section);
    const targetPath = sectionToPathMap[section] || '/admin/dashboard';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ section }, '', targetPath);
    }
  }, []);

  const startRolePreview = useCallback((role: UserRole) => {
    if (profile?.role !== 'devcom_head') return;
    setPreviewRole(role);
    setPreviewUserId(profile.id);
    setActiveSection('dashboard');
  }, [profile?.id, profile?.role, setActiveSection]);

  const exitRolePreview = useCallback(() => {
    setPreviewRole(null);
    setPreviewUserId(null);
  }, []);
  const isRolePreviewing = previewRole !== null
    && previewUserId === profile?.id
    && canPreviewRoles(profile?.role);
  const effectiveRole = isRolePreviewing ? previewRole : profile?.role ?? null;

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const value = useMemo(() => ({
    activeSection, setActiveSection,
    previewRole: isRolePreviewing ? previewRole : null,
    effectiveRole, isRolePreviewing, startRolePreview, exitRolePreview,
    toasts, showToast, dismissToast,
  }), [activeSection, setActiveSection, previewRole, effectiveRole, isRolePreviewing, startRolePreview, exitRolePreview, toasts, showToast, dismissToast]);

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}
