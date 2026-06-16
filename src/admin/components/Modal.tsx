import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  mode?: 'center' | 'slideOver';
  maxWidth?: string;
}

export default function Modal({ isOpen, onClose, title, children, mode = 'center', maxWidth = 'max-w-2xl' }: ModalProps) {
  if (!isOpen) return null;

  if (mode === 'slideOver') {
    return (
      <div className="fixed inset-0 z-50 flex justify-end" id="admin-modal-overlay">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

        {/* Slide-over panel */}
        <div className={`relative w-full ${maxWidth} bg-white shadow-2xl flex flex-col animate-slide-in-right`}>
          {/* Green header */}
          <div className="bg-[#1A3C2E] px-6 py-4 flex items-center justify-between shrink-0">
            <h3 className="font-sans font-bold text-white text-sm tracking-wide">{title}</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              id="admin-modal-close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto admin-scrollbar p-6">
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Center modal
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="admin-modal-overlay">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className={`relative w-full ${maxWidth} bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-in-up flex flex-col max-h-[90vh]`}>
        {/* Green header */}
        <div className="bg-[#1A3C2E] px-6 py-4 flex items-center justify-between shrink-0">
          <h3 className="font-sans font-bold text-white text-sm tracking-wide">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            id="admin-modal-close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto admin-scrollbar p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
