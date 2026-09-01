type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'draft';

export function getRegistrationBadge(status: string): { variant: BadgeVariant; label: string } {
  switch (status) {
    case 'confirmed': return { variant: 'warning', label: 'Not Attended' };
    case 'pending': return { variant: 'warning', label: 'Not Attended' };
    case 'cancelled': return { variant: 'danger', label: 'Cancelled' };
    case 'attended': return { variant: 'success', label: 'Attended' };
    default: return { variant: 'neutral', label: status };
  }
}
