// ============================================================
// DATABASE TYPES — mirrors Supabase schema
// ============================================================

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  student_number: string | null;
  year_level: number | null;
  program: string | null;
  section: string | null;
  role: UserRole;
  position: string | null;
  committee_id: string | null;
  profile_complete: boolean;
  banned: boolean;
  banned_until: string | null;
  subscribe_announcements_events: boolean;
  email_subscription_decided: boolean;
  status: 'pending' | 'approved' | 'rejected';
  privacy_agreed_at: string | null;
  submitted_at: string;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  contact_number: string | null;
  attendance_qr_code?: string | null;
  attendance_qr_generated_at?: string | null;
  last_ip: string | null;
  created_at: string;
  updated_at: string;
}

export type UserRole =
  | 'student'
  | 'officer'
  | 'devcom_head'
  | 'comm_content'
  | 'comm_registration'
  | 'comm_photobooth';

export interface Committee {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  responsibilities: string[];
  display_order: number;
  head_name?: string | null;
  created_at: string;
  committee_subteams?: CommitteeSubteam[];
}

export interface CommitteeSubteam {
  id: string;
  committee_id: string;
  name: string;
  description: string | null;
  display_order: number;
}

export interface Officer {
  id: string;
  name: string;
  position: string;
  committee_id: string | null;
  photo_url: string | null;
  email: string;
  display_order: number;
  created_at: string;
  quote?: string | null;
  committees?: { name: string } | null;
  term?: string | null;
  organization?: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'event' | 'deadline' | 'result' | 'general';
  status: 'draft' | 'published';
  pinned: boolean;
  banner_url: string | null;
  author_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  profiles?: { full_name: string | null } | null;
}

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  category: 'general' | 'priority';
  event_type?: 'competition' | 'general' | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  registration_required: boolean;
  registration_cap: number | null;
  created_by: string | null;
  created_at: string;
  banner_url: string | null;
  // Computed/joined
  registered_count?: number;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  profile_id: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'attended';
  registered_at: string;
  attended_at?: string | null;
  attendance_origin: 'registered' | 'walk_in';
  // Joined fields
  profiles?: { full_name: string | null; student_number: string | null; email: string; section: string | null } | null;
  events?: { title: string; event_date: string; location: string | null } | null;
}

export interface Concern {
  id: string;
  profile_id: string;
  category: string;
  subject: string;
  message: string;
  status: 'new' | 'in_progress' | 'resolved';
  assigned_committee_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  profiles?: { full_name: string | null; email: string } | null;
  concern_replies?: ConcernReply[];
}

export interface ConcernReply {
  id: string;
  concern_id: string;
  admin_id: string | null;
  message: string;
  created_at: string;
  // Joined
  profiles?: { full_name: string | null } | null;
}

export interface GalleryItem {
  id: string;
  profile_id: string | null;
  title: string;
  description: string | null;
  category: string;
  posted_by: string | null;
  image_url: string;
  thumbnails: string[];
  aspect_ratio: 'portrait' | 'landscape' | 'square' | null;
  featured: boolean;
  created_at: string;
}

export interface ThemeSetting {
  id: string;
  preset_name: string;
  primary_color: string;
  accent_color: string;
  canvas_color: string;
  is_active: boolean;
  created_at: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// UI-ONLY TYPES (not in database)
// ============================================================

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export const ROLE_LABELS: Record<UserRole, string> = {
  student: 'Student',
  officer: 'Officer',
  devcom_head: 'DevCom Head',
  comm_content: 'Comm — Content',
  comm_registration: 'Comm — Registration',
  comm_photobooth: 'Comm — Photobooth',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  student: 'bg-[#78909C]/15 text-[#78909C] border-[#78909C]/30',
  officer: 'bg-[#546E7A]/15 text-[#546E7A] border-[#546E7A]/30',
  devcom_head: 'bg-[#F5B400]/15 text-[#F5B400] border-[#F5B400]/30',
  comm_content: 'bg-[#2E7D32]/15 text-[#2E7D32] border-[#2E7D32]/30',
  comm_registration: 'bg-[#1565C0]/15 text-[#1565C0] border-[#1565C0]/30',
  comm_photobooth: 'bg-[#7B1FA2]/15 text-[#7B1FA2] border-[#7B1FA2]/30',
};

// Admin roles that can access the admin portal
export const ADMIN_ROLES: UserRole[] = [
  'devcom_head',
  'comm_content',
  'comm_registration',
  'comm_photobooth',
  'officer',
];

export const isAdminRole = (role: UserRole): boolean =>
  ADMIN_ROLES.includes(role);

export interface Conversation {
  id: string;
  profile_id: string;
  created_at: string;
  last_message_at: string;
  // joined fields
  profiles?: { full_name: string | null; email: string; avatar_url: string | null } | null;
  unread_count?: number; // UI computed
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
  // joined fields
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
}
