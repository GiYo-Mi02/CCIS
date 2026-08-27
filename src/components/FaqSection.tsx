import React, { useState, useEffect } from 'react';
import { Plus, Minus, HelpCircle } from 'lucide-react';
import { FAQItem } from '../types';
import { supabase } from '../lib/supabase';
import { FaqSkeleton } from './common/Skeleton';

export default function FaqSection() {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const fetchFaqs = async () => {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .eq('is_active', true)
        .order('display_order')
        .limit(100);
      if (!error && data) {
        setFaqs(data.map((f: any) => ({
          id: f.id,
          question: f.question,
          answer: f.answer
        })));
      }
      setLoading(false);
    };
    fetchFaqs();
  }, []);

  const toggleFaq = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  if (loading) {
    return (
      <section className="py-16 bg-[#FAF7EA]/50 border-b border-[#1A3C2E]/10" id="faq-accordions">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <FaqSkeleton />
        </div>
      </section>
    );
  }

  if (faqs.length === 0) return null;

  return (
    <section className="py-16 bg-[#FAF7EA]/50 border-b border-[#1A3C2E]/10" id="faq-accordions">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        
        <div className="text-center mb-10">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#5E6E64] font-bold">Inquiries</span>
          <h2 className="font-sans font-extrabold text-3xl text-[#1A3C2E] mt-1">Frequently Asked Questions</h2>
          <div className="h-1 w-16 bg-[#F5B400] mx-auto mt-3 rounded-full" />
        </div>

        <div className="space-y-3.5 font-sans">
          {faqs.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                className={`overflow-hidden rounded-xl border-y border-l-4 border-r-0 bg-white shadow-sm transition-all duration-300 ${
                  isOpen 
                    ? 'border-l-[#FFBC00] border-y-zinc-200'
                    : 'border-l-[#123524] border-y-zinc-100'
                }`}
                id={`faq-accordion-item-${item.id}`}
              >
                <button
                  onClick={() => toggleFaq(item.id)}
                  className="flex w-full items-start justify-between gap-3 p-4 text-left text-sm font-bold text-[#123524] transition-colors hover:text-[#FFBC00] focus:outline-none sm:items-center sm:p-5 md:text-base"
                  aria-expanded={isOpen}
                >
                  <span className="flex min-w-0 items-start gap-3 leading-relaxed sm:items-center">
                    <HelpCircle size={18} className="mt-0.5 flex-shrink-0 text-[#FFBC00] sm:mt-0" />
                    {item.question}
                  </span>
                  <span className="shrink-0 rounded-full bg-[#FAF7EA] p-1.5 text-[#123524]">
                    {isOpen ? <Minus size={15} /> : <Plus size={15} />}
                  </span>
                </button>

                <div
                  className={`border-t border-zinc-100/50 transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-96 bg-zinc-50/50 p-4 opacity-100 sm:p-5' : 'max-h-0 overflow-hidden opacity-0'
                  }`}
                >
                  <p className="pl-1 text-sm leading-relaxed text-stone-600 md:text-base">
                    {item.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
