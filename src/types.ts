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
  term?: string;
  organization?: string;
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
  slotsLeft?: number | null;
  registeredCount: number;
  description: string;
  event_type?: 'competition' | 'general';
  banner_url?: string | null;
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
