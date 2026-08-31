import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'draft';

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-[#e6f5ed] text-[#1a7a4a] border-[#1a7a4a]/25',
  warning: 'bg-[#fffbea] text-[#b8860b] border-[#b8860b]/25',
  danger:  'bg-[#fdecea] text-[#c0392b] border-[#c0392b]/25',
  info:    'bg-[#c0d5f0] text-[#105389] border-[#105389]/25',
  neutral: 'bg-[#eaecf4] text-[#47528a] border-[#47528a]/20',
  draft:   'bg-[#eaecf4] text-[#47528a] border-[#47528a]/20',
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
function getAnnouncementBadge(status: string): { variant: BadgeVariant; label: string } {
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

function getConcernBadge(status: string): { variant: BadgeVariant; label: string } {
  switch (status) {
    case 'new': return { variant: 'info', label: 'New' };
    case 'in_progress': return { variant: 'warning', label: 'In Progress' };
    case 'resolved': return { variant: 'success', label: 'Resolved' };
    default: return { variant: 'neutral', label: status };
  }
}
