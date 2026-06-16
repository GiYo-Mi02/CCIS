import React, { createContext, useContext, useState, useCallback } from 'react';
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

export function AdminProvider({ children }: { children: React.ReactNode }) {
  // Navigation
  const [activeSection, setActiveSection] = useState('dashboard');

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

  return (
    <AdminContext.Provider value={{
      activeSection, setActiveSection,
      toasts, showToast, dismissToast,
    }}>
      {children}
    </AdminContext.Provider>
  );
}
