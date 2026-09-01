import { ADMIN_ROLES, type UserRole } from '../types/database';

export const ADMIN_SECTIONS = [
  'dashboard', 'announcements', 'registration', 'scanner', 'verification',
  'officers', 'users', 'messages', 'calendar', 'faqs', 'settings',
] as const;

export type AdminSection = typeof ADMIN_SECTIONS[number];

const sectionRoles: Record<AdminSection, readonly UserRole[]> = {
  dashboard: ADMIN_ROLES,
  announcements: ['devcom_head', 'comm_content'],
  registration: ['devcom_head', 'comm_registration'],
  scanner: ['devcom_head', 'comm_registration'],
  verification: ['devcom_head', 'comm_registration'],
  officers: ['devcom_head'],
  users: ['devcom_head'],
  messages: ['devcom_head', 'officer'],
  calendar: ['devcom_head', 'comm_content'],
  faqs: ['devcom_head', 'comm_content'],
  settings: ['devcom_head'],
};

export const isAdminSection = (section: string): section is AdminSection =>
  ADMIN_SECTIONS.includes(section as AdminSection);

export const canAccessAdminSection = (role: UserRole | null | undefined, section: string): boolean =>
  Boolean(role && isAdminSection(section) && sectionRoles[section].includes(role));

export const canPreviewRoles = (role: UserRole | null | undefined): boolean => role === 'devcom_head';

export const canManagePublicPage = (role: UserRole | null | undefined, page: 'gallery' | 'transparency' | 'patch'): boolean => {
  if (role === 'devcom_head') return true;
  return (page === 'gallery' && role === 'comm_photobooth')
    || (page === 'transparency' && role === 'officer')
    || (page === 'patch' && role === 'comm_content');
};
