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
        .select('id, question, answer, display_order, is_active, created_at, updated_at')
        .eq('is_active', true)
        .order('display_order')
        .limit(100);
      if (!error && data) {
        setFaqs(data.map((f) => ({
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
      <section className="border-b border-[#123524]/10 bg-[#FAF7EA]/50 py-16" id="faq-accordions">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <FaqSkeleton />
        </div>
      </section>
    );
  }

  if (faqs.length === 0) return null;

  return (
    <section className="border-b border-[#123524]/10 bg-[#FAF7EA]/50 py-16" id="faq-accordions">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        
        <div className="mb-10 text-center">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#5E6E64]">Inquiries</span>
          <h2 className="mt-1 font-marcellus text-3xl text-[#123524] sm:text-[2rem]">Frequently Asked Questions</h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-[#FFBC00]" />
        </div>

        <div className="space-y-3.5">
          {faqs.map((item) => {
            const isOpen = openId === item.id;
            const answerId = `faq-answer-${item.id}`;
            return (
              <div
                key={item.id}
                className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-colors duration-200 ${
                  isOpen 
                    ? 'border-[#FFBC00]/40'
                    : 'border-[#123524]/10'
                }`}
                id={`faq-accordion-item-${item.id}`}
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(item.id)}
                  className="group flex min-h-[68px] w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-medium leading-6 text-[#123524] transition-colors hover:text-[#8b6800] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FFBC00] sm:px-5 md:text-base"
                  id={`faq-question-${item.id}`}
                  aria-expanded={isOpen}
                  aria-controls={answerId}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <HelpCircle size={18} strokeWidth={2} className="flex-shrink-0 text-[#FFBC00]" aria-hidden="true" />
                    {item.question}
                  </span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FAF7EA] text-[#123524] transition-transform duration-200 group-active:scale-95">
                    {isOpen ? <Minus size={15} strokeWidth={2} aria-hidden="true" /> : <Plus size={15} strokeWidth={2} aria-hidden="true" />}
                  </span>
                </button>

                <div
                  id={answerId}
                  role="region"
                  aria-labelledby={`faq-question-${item.id}`}
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <p className="border-t border-[#123524]/10 px-5 py-4 text-sm leading-relaxed text-stone-600 md:text-base">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
