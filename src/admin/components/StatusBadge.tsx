import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'draft';

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-[#2E7D32]/12 text-[#2E7D32] border-[#2E7D32]/25',
  warning: 'bg-[#E0A100]/12 text-[#B38600] border-[#E0A100]/25',
  danger: 'bg-[#C0392B]/12 text-[#C0392B] border-[#C0392B]/25',
  info: 'bg-[#F5B400]/12 text-[#B38600] border-[#F5B400]/25',
  neutral: 'bg-gray-100 text-gray-500 border-gray-200',
  draft: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function StatusBadge({ variant, label, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {label}
    </span>
  );
}

// Helper to determine badge variant from status strings
export function getAnnouncementBadge(status: string): { variant: BadgeVariant; label: string } {
  switch (status) {
    case 'published': return { variant: 'success', label: 'Published' };
    case 'pinned': return { variant: 'info', label: '📌 Pinned' };
    case 'draft': return { variant: 'draft', label: 'Draft' };
    default: return { variant: 'neutral', label: status };
  }
}

export function getRegistrationBadge(status: string): { variant: BadgeVariant; label: string } {
  switch (status) {
    case 'confirmed': return { variant: 'warning', label: 'Not Attended' };
    case 'pending': return { variant: 'warning', label: 'Not Attended' };
    case 'cancelled': return { variant: 'danger', label: 'Cancelled' };
    case 'attended': return { variant: 'success', label: 'Attended' };
    default: return { variant: 'neutral', label: status };
  }
}

export function getConcernBadge(status: string): { variant: BadgeVariant; label: string } {
  switch (status) {
    case 'new': return { variant: 'info', label: 'New' };
    case 'in_progress': return { variant: 'warning', label: 'In Progress' };
    case 'resolved': return { variant: 'success', label: 'Resolved' };
    default: return { variant: 'neutral', label: status };
  }
}
