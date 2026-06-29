// ============================================================
// PUBLIC SITE TYPES
// ============================================================

export interface Announcement {
  id: string;
  title: string;
  date: string;
  category: 'EVENT' | 'DEADLINE' | 'RESULT' | 'GENERAL';
  content: string;
  author: string;
  isPinned?: boolean;
  image?: string;
  status: 'draft' | 'published' | 'pinned';
  scheduledDate?: string;
}

export interface Officer {
  id: string;
  name: string;
  position: string;
  committee: string;
  photoUrl: string;
  email: string;
  order: number;
  quote?: string;
}

export interface Committee {
  id: string;
  name: string;
  slug?: string;
  description: string;
  head: string;
  responsibilities: string[];
  icon?: string;
  memberCount?: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: 'general' | 'priority';
  description: string;
  link?: string;
}

export interface EventItem {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  slots: number;
  registeredCount: number;
  description: string;
}

export interface Registration {
  id: string;
  name: string;
  email: string;
  courseYear: string;
  studentNumber: string;
  college: string;
  section?: string;
  eventId: string;
  eventTitle: string;
  registeredAt: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'attended';
}

export interface Concern {
  id: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  date: string;
  status: 'new' | 'in_progress' | 'resolved';
  isRead: boolean;
  assignedTo?: string;
  reply?: string;
  repliedAt?: string;
}

export interface Photo {
  id: string;
  dataUrl: string;
  date: string;
  frameId: string;
  isFeatured?: boolean;
  sessionId?: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

// ============================================================
// ADMIN PANEL TYPES
// ============================================================

export type UserRole = 'devcom_head' | 'comm_content' | 'comm_registration' | 'comm_photobooth' | 'officer_readonly';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  lastActive: string;
}

export interface PhotoboothSession {
  id: string;
  timestamp: string;
  photoCount: number;
  photoIds: string[];
}

export interface FrameTemplate {
  id: string;
  name: string;
  previewUrl: string;
  isActive: boolean;
}

export interface PhotoboothSettings {
  enabled: boolean;
  maxPhotosPerSession: number;
  watermarkEnabled: boolean;
}

export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
  link?: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export const ROLE_LABELS: Record<UserRole, string> = {
  devcom_head: 'DevCom Head',
  comm_content: 'Comm — Content',
  comm_registration: 'Comm — Registration',
  comm_photobooth: 'Comm — Photobooth',
  officer_readonly: 'Officer (Read-Only)',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  devcom_head: 'bg-[#F5B400]/15 text-[#F5B400] border-[#F5B400]/30',
  comm_content: 'bg-[#2E7D32]/15 text-[#2E7D32] border-[#2E7D32]/30',
  comm_registration: 'bg-[#1565C0]/15 text-[#1565C0] border-[#1565C0]/30',
  comm_photobooth: 'bg-[#7B1FA2]/15 text-[#7B1FA2] border-[#7B1FA2]/30',
  officer_readonly: 'bg-[#546E7A]/15 text-[#546E7A] border-[#546E7A]/30',
};

export interface Conversation {
  id: string;
  profile_id: string;
  created_at: string;
  last_message_at: string;
  profiles?: { full_name: string | null; email: string; avatar_url: string | null } | null;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_role: 'student' | 'admin';
  content: string;
  read_by_student: boolean;
  read_by_admin: boolean;
  created_at: string;
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
}
