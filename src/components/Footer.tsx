import React from 'react';
import { Mail, Facebook, Github, Globe, Heart, Lock, Instagram } from 'lucide-react';
import CouncilSeal from './CouncilSeal';
import { useAuth } from '../context/AuthContext';

interface FooterProps {
  onNavClick: (tabId: string) => void;
  onAdminSwitch?: () => void;
  isUmakTheme?: boolean;
}

export default function Footer({ onNavClick, onAdminSwitch, isUmakTheme = false }: FooterProps) {
  const { isAdmin } = useAuth();
  const links = [
    { id: 'info', label: 'Council Information' },
    { id: 'announcements', label: 'Advisory Center' },
    { id: 'registration', label: 'Event Booking Pass' },
    { id: 'messages', label: 'Direct Messages' }
  ];

  return (
    <footer 
      className={`text-[#FAF7EA] py-12 border-t-2 font-sans transition-colors duration-500 ${
        isUmakTheme ? 'bg-[#111c4e] border-[#f5ec3a]' : 'bg-[#1A3C2E] border-[#F5B400]'
      }`} 
      id="app-footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10 items-start pb-8">
          
          {/* Column 1: Organization brand info (4 cols on desktop) */}
          <div className="lg:col-span-4 md:col-span-2 space-y-4">
            {/* Institutional Brand Logo Block (Identical to Navbar) */}
            <button
              type="button"
              className="flex items-center gap-3 cursor-pointer select-none group inline-flex" 
              onClick={() => {
                onNavClick('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              id="footer-brand-logo"
            >
              {/* Logos: UMak Seal then CCIS Seal */}
              <div className="flex items-center gap-2 shrink-0">
                <img
                  src="/images/UMak_Logo.png"
                  alt="University of Makati Seal"
                  className="w-10 h-10 md:w-11 md:h-11 object-contain drop-shadow"
                />
                <CouncilSeal 
                  size={42} 
                  interactive={false} 
                  src="/images/CCIS-Logo.png" 
                  className="w-10 h-10 md:w-11 md:h-11 drop-shadow"
                />
              </div>

              {/* Institutional Brand Text Lockup */}
              <div className="flex flex-col justify-center">
                <span className="font-marcellus uppercase text-[15px] sm:text-base md:text-[17px] font-normal tracking-[0.04em] text-[#FAF7EA] leading-none mb-1 group-hover:text-[#F5B400] transition-colors whitespace-nowrap">
                  UNIVERSITY OF MAKATI
                </span>
                <span className="font-sans text-[8.5px] sm:text-[9.5px] md:text-[10px] font-medium text-[#FAF7EA]/80 leading-tight group-hover:text-white transition-colors whitespace-nowrap">
                  College of Computing and Information Sciences
                </span>
              </div>
            </button>
            
            <p className="text-stone-300 text-xs leading-relaxed max-w-sm">
              Serving our herons with modern technical foundations, devoted administrative governance, and creative college spirits.
            </p>
          </div>

          {/* Column 2: Quick Links (2 cols on desktop) */}
          <div className="lg:col-span-2 md:col-span-1 space-y-3.5">
            <h4 className="font-sans font-bold text-[#F5B400] text-xs uppercase tracking-widest">
              Quick Links
            </h4>
            <ul className="space-y-2 text-xs">
              {links.map((link) => (
                <li key={link.id}>
                  <button
                    onClick={() => {
                      onNavClick(link.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-stone-300 hover:text-white hover:underline transition-colors focus:outline-none"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Contact information (3 cols on desktop) */}
          <div className="lg:col-span-3 md:col-span-1 space-y-3.5">
            <h4 className="font-sans font-bold text-[#F5B400] text-xs uppercase tracking-widest">
              Officer Helpdesk
            </h4>
            <ul className="space-y-2 text-xs text-stone-300">
              <li className="flex items-center gap-1.5">
                <Mail size={12} className="text-[#F5B400]" />
                <span>umakccissc@umak.edu.ph</span>
              </li>
              <li className="flex items-center gap-1.5 font-mono">
                <Globe size={12} className="text-[#F5B400]" />
                <span>umakccissc@umak.edu.ph</span>
              </li>
              <li className="text-[11px] leading-relaxed italic text-stone-400">
                CCIS Office, Admin Building, 3rd Floor
              </li>
              <li className="text-[11px] leading-relaxed italic text-stone-400">
                CCIS Student Council, Admin Building, 5th Floor
              </li>
            </ul>
          </div>

          {/* Column 4: Social Accounts (3 cols on desktop) */}
          <div className="lg:col-span-3 md:col-span-1 space-y-3.5">
            <h4 className="font-sans font-bold text-[#F5B400] text-xs uppercase tracking-widest">
              Connect Online
            </h4>
            <p className="text-xs text-stone-300">Stay attached on local social feeds:</p>
            <div className="flex items-center gap-2.5">
              <a
                href="https://web.facebook.com/umakccissc"
                target="_blank"
                rel="noreferrer"
                className="bg-white/5 hover:bg-white/10 p-2 rounded-full border border-white/10 text-[#F5B400] transition-colors"
                aria-label="Facebook"
              >
                <Facebook size={14} />
              </a>
              <a
                href="https://www.instagram.com/umakccissc/"
                target="_blank"
                rel="noreferrer"
                className="bg-white/5 hover:bg-white/10 p-2 rounded-full border border-white/10 text-[#F5B400] transition-colors"
                 aria-label="Instagram"
              >
                <Instagram size={14} />
              </a>
            </div>
          </div>

        </div>

        {/* Divider bar */}
        <div className="h-[1px] bg-stone-700/50 w-full mb-6" />

        {/* Bottom bar copyrights */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[10.5px] font-mono text-stone-400">
          <span>
            © 2026 CCIS Student Council. All Rights Reserved.
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                onNavClick('privacy');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-[#F5B400] hover:underline transition-colors"
            >
              Privacy Policy
            </button>
            <span className="flex items-center gap-1">
              Built with <Heart size={10} className="fill-rose-600 text-rose-600 animate-pulse" /> by CCIS Student Council
            </span>
            {onAdminSwitch && isAdmin && (
              <button
                onClick={onAdminSwitch}
                className="flex items-center gap-1 text-stone-500 hover:text-[#F5B400] transition-colors"
                id="footer-admin-link"
              >
                <Lock size={9} />
                Admin Portal
              </button>
            )}
          </div>
        </div>

      </div>
    </footer>
  );
}
