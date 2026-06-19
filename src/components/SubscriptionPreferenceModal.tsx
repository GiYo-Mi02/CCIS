import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Mail, Megaphone, Calendar, Check, Info } from 'lucide-react';

interface SubscriptionPreferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (subscribed: boolean) => Promise<void>;
  userEmail: string;
}

export default function SubscriptionPreferenceModal({
  isOpen,
  onClose,
  onSave,
  userEmail
}: SubscriptionPreferenceModalProps) {
  const [subscribed, setSubsubscribed] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(subscribed);
      onClose();
    } catch (err) {
      console.error("Failed to save email preferences:", err);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={() => !saving && onClose()} />

      {/* Modal Container */}
      <div className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-zinc-150 p-6 sm:p-8 text-center space-y-6 animate-scale-up text-[#1A3C2E]">
        
        {/* Visual Icon Header */}
        <div className="relative flex justify-center">
          <div className="w-16 h-16 bg-[#FAF7EA] border border-[#1A3C2E]/10 rounded-full flex items-center justify-center text-[#1A3C2E] shadow-xs">
            <Mail size={28} className="stroke-[1.5]" />
          </div>
          <div className="absolute top-0 right-1/3 w-6 h-6 bg-[#F5B400] rounded-full flex items-center justify-center border-2 border-white text-[10px] text-[#1A3C2E] font-black animate-bounce shadow-xs">
            !
          </div>
        </div>

        {/* Text Headers */}
        <div className="space-y-1">
          <h2 className="font-sans font-black text-xl tracking-tight leading-tight">
            Stay in the Loop!
          </h2>
          <p className="font-mono text-[9px] uppercase tracking-widest text-[#5E6E64]">
            Email Subscription Preferences
          </p>
        </div>

        <p className="text-stone-600 text-xs sm:text-sm leading-relaxed text-center max-w-sm mx-auto">
          Get official announcements, key deadlines, and upcoming event invitations sent straight to your UMak inbox.
        </p>

        {/* Feature Cards Grid (Visual aid) */}
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="bg-[#FAF7EA]/50 border border-zinc-100 p-3 rounded-2xl flex items-start gap-2.5">
            <Megaphone size={16} className="text-[#F5B400] shrink-0 mt-0.5" />
            <div>
              <span className="block text-[11px] font-bold">Announcements</span>
              <span className="text-[9px] text-[#5E6E64] leading-tight block">Important updates &amp; academic rules.</span>
            </div>
          </div>
          <div className="bg-[#FAF7EA]/50 border border-zinc-100 p-3 rounded-2xl flex items-start gap-2.5">
            <Calendar size={16} className="text-[#F5B400] shrink-0 mt-0.5" />
            <div>
              <span className="block text-[11px] font-bold">Computing Events</span>
              <span className="text-[9px] text-[#5E6E64] leading-tight block">Workshops, hackathons, and seminars.</span>
            </div>
          </div>
        </div>

        {/* Interactive Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex items-start gap-3 bg-zinc-50 border border-zinc-150 p-4 rounded-2xl cursor-pointer select-none text-left hover:bg-zinc-100/50 transition-colors">
            <div className="relative flex items-center mt-0.5">
              <input
                type="checkbox"
                checked={subscribed}
                onChange={(e) => setSubsubscribed(e.target.checked)}
                className="peer sr-only"
              />
              <div className="w-5 h-5 border-2 border-zinc-300 rounded-md bg-white peer-checked:bg-[var(--color-primary-green,#1A3C2E)] peer-checked:border-[var(--color-primary-green,#1A3C2E)] transition-all flex items-center justify-center">
                <Check size={14} className="text-white opacity-0 peer-checked:opacity-100 transition-opacity stroke-[3]" />
              </div>
            </div>
            <div className="space-y-0.5">
              <span className="block text-xs font-bold leading-tight">
                Yes, send me announcements &amp; events
              </span>
              <span className="block text-[10px] text-[#5E6E64] leading-tight">
                Direct to: <strong className="font-mono text-[9px]">{userEmail}</strong>
              </span>
            </div>
          </label>

          {/* Mandatory Ticket Advisory */}
          <div className="bg-amber-50/50 border border-amber-200/50 p-3 rounded-2xl text-[10px] text-amber-800 text-left flex items-start gap-2">
            <Info size={13} className="shrink-0 text-amber-600 mt-0.5" />
            <span className="leading-normal">
              <strong>Mandatory seat pass receipts:</strong> Booking event tickets will always dispatch a boarding pass email, even if you opt out here.
            </span>
          </div>

          {/* Action buttons */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] py-3 rounded-xl font-sans font-bold text-xs uppercase tracking-wider shadow-md transition-all active:scale-98 flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-[#1A3C2E]/30 border-t-[#1A3C2E] rounded-full animate-spin" />
                Saving preferences...
              </>
            ) : (
              'Save & Continue'
            )}
          </button>
        </form>

      </div>
    </div>,
    document.body
  );
}
