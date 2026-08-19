import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useAdmin } from '../AdminContext';

const TOAST_STYLES = {
  success: { bg: 'bg-[#2E7D32]', icon: CheckCircle },
  error: { bg: 'bg-[#C0392B]', icon: XCircle },
  warning: { bg: 'bg-[#E0A100]', icon: AlertTriangle },
  info: { bg: 'bg-[#1A3C2E]', icon: Info },
};

export default function ToastContainer() {
  const { toasts, dismissToast } = useAdmin();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[60] space-y-2 w-80" id="admin-toast-container">
      {toasts.map((toast) => {
        const style = TOAST_STYLES[toast.type];
        const Icon = style.icon;
        return (
          <div
            key={toast.id}
            className={`${style.bg} text-white px-4 py-3 rounded-xl shadow-xl flex items-start gap-3 animate-toast-in`}
          >
            <Icon size={18} className="shrink-0 mt-0.5" />
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="p-0.5 rounded hover:bg-white/20 transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
