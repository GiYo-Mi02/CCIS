import React, { useState, useEffect, Suspense, lazy } from 'react';
import App from './App';
import LoadingScreen from './components/LoadingScreen';

const AdminApp = lazy(() => import('./admin/AdminApp'));
import { useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
import { applyTheme, DEFAULT_THEME } from './utils/theme';

export default function RootRouter() {
  const { isAdmin } = useAuth();
  const [mode, setMode] = useState<'public' | 'admin'>(() =>
    window.location.pathname.toLowerCase().startsWith('/admin') ? 'admin' : 'public',
  );

  // Fetch active theme from Supabase on mount, fallback to default
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const { data, error } = await supabase
          .from('theme_settings')
          .select('id, preset_name, primary_color, accent_color, canvas_color, is_active, created_at')
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
    setMode('admin');
  };

  const switchToPublic = () => {
    setMode('public');
  };

  if (mode === 'admin') {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-[#1A3C2E] flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-[#F5B400] border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <AdminApp onExitAdmin={switchToPublic} />
      </Suspense>
    );
  }

  return <App onAdminSwitch={switchToAdmin} />;
}
