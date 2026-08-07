import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import RootRouter from './RootRouter';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// One-time cleanup of legacy localStorage keys from the mock-data version
const LEGACY_KEYS = [
  'ccis_announcements', 'ccis_officers', 'ccis_committees', 'ccis_events',
  'ccis_registrations', 'ccis_concerns', 'ccis_calendar', 'ccis_photos',
  'ccis_sessions', 'ccis_frames', 'ccis_admin_users', 'ccis_admin_auth',
  'ccis_admin_user', 'ccis_booth_settings', 'ccis_notifications',
  'ccis_photobooth_photos', 'ccis_app_mode',
];

if (!localStorage.getItem('ccis_v2_migrated')) {
  LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
  localStorage.setItem('ccis_v2_migrated', 'true');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <RootRouter />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
