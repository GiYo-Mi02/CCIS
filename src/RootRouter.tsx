import React, { useState, useEffect } from 'react';
import App from './App';
import AdminApp from './admin/AdminApp';
import { useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
import { applyTheme, DEFAULT_THEME } from './utils/theme';

export default function RootRouter() {
  const { isAdmin } = useAuth();
  const [mode, setMode] = useState<'public' | 'admin'>('public');

  // Fetch active theme from Supabase on mount, fallback to default
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const { data, error } = await supabase
          .from('theme_settings')
          .select('*')
          .eq('is_active', true)
          .single();

        if (data && !error) {
          applyTheme({
            primaryGreen: data.primary_color,
            accentGold: data.accent_color,
            bgCream: data.canvas_color,
          });
        } else {
          applyTheme(DEFAULT_THEME);
        }
      } catch {
        applyTheme(DEFAULT_THEME);
      }
    };

    loadTheme();
  }, []);

  const switchToAdmin = () => {
    if (isAdmin) {
      setMode('admin');
    }
  };

  const switchToPublic = () => {
    setMode('public');
  };

  if (mode === 'admin' && isAdmin) {
    return <AdminApp onExitAdmin={switchToPublic} />;
  }

  return <App onAdminSwitch={switchToAdmin} />;
}
