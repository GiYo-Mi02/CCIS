import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { ToastMessage } from '../types/database';

interface AdminContextType {
  // Navigation
  activeSection: string;
  setActiveSection: (s: string) => void;

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
  // Navigation
  const [activeSection, setActiveSectionState] = useState(getInitialSection);

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
    toasts, showToast, dismissToast,
  }), [activeSection, setActiveSection, toasts, showToast, dismissToast]);

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}
