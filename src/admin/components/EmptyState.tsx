import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center" id="admin-empty-state">
      <div className="p-4 rounded-2xl bg-gray-50 mb-4">
        <Icon size={40} className="text-gray-300" strokeWidth={1.5} />
      </div>
      <h3 className="font-sans font-bold text-base text-[#222B26] mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-400 max-w-sm">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] px-5 py-2.5 rounded-lg font-sans font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
