import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  badgeCount?: number;
  badgeColor?: 'gold' | 'red' | 'green';
}

const badgeClasses = {
  gold: 'bg-[#F5B400]/15 text-[#F5B400]',
  red: 'bg-[#C0392B]/15 text-[#C0392B]',
  green: 'bg-[#2E7D32]/15 text-[#2E7D32]',
};

export default function StatCard({ label, value, subtitle, icon: Icon, badgeCount, badgeColor = 'gold' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow relative group" id="admin-stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="font-sans font-black text-3xl text-[#1A3C2E] tracking-tight">{value}</span>
            {badgeCount !== undefined && badgeCount > 0 && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClasses[badgeColor]}`}>
                +{badgeCount} new
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-[11px] text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        <div className="p-2.5 rounded-xl bg-[#F5B400]/10 text-[#F5B400] group-hover:bg-[#F5B400]/20 transition-colors">
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}
