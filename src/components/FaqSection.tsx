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
                className={`bg-white rounded-xl border transition-all duration-300 shadow-sm overflow-hidden ${
                  isOpen 
                    ? 'border-l-4 border-l-[#F5B400] border-t-zinc-200 border-r-zinc-200 border-b-zinc-200' 
                    : 'border-l-4 border-l-[#1A3C2E] border-t-zinc-100 border-r-zinc-100 border-b-zinc-100'
                }`}
                id={`faq-accordion-item-${item.id}`}
              >
                <button
                  onClick={() => toggleFaq(item.id)}
                  className="w-full flex items-center justify-between p-5 text-left text-sm md:text-base font-bold text-[#1A3C2E] hover:text-[#F5B400] transition-colors focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="flex items-center gap-3">
                    <HelpCircle size={18} className="text-[#F5B400] flex-shrink-0" />
                    {item.question}
                  </span>
                  <span className="p-1 rounded-full bg-zinc-50 border border-zinc-100 text-[#1A3C2E]">
                    {isOpen ? <Minus size={15} /> : <Plus size={15} />}
                  </span>
                </button>

                <div
                  className={`transition-all duration-300 ease-in-out border-t border-zinc-100/50 ${
                    isOpen ? 'max-h-96 opacity-100 p-5 bg-zinc-50/50' : 'max-h-0 opacity-0 overflow-hidden'
                  }`}
                >
                  <p className="text-stone-600 text-sm md:text-base leading-relaxed pl-1">
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
