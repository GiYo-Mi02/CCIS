import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit3, Trash2, HelpCircle, ChevronUp, ChevronDown, 
  X, CheckCircle, AlertCircle, Info 
} from 'lucide-react';
import { useAdmin } from '../AdminContext';
import { supabase } from '../../lib/supabase';
import { FAQ } from '../../types/database';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

export default function FaqManager() {
  const { showToast } = useAdmin();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [editingFaq, setEditingFaq] = useState<Partial<FAQ> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch FAQ entries
  const fetchFaqs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      if (data) {
        setFaqs(data as FAQ[]);
      }
    } catch (err: any) {
      showToast('Failed to fetch FAQs: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaqs();
  }, []);

  // Reorder FAQs (Move Up/Down)
  const moveFaq = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...faqs].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex(f => f.id === id);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === sorted.length - 1)) return;

    try {
      const { error } = await supabase.rpc('swap_faq_order', {
        p_faq_id: id,
        p_direction: direction,
      });
      if (error) throw error;

      await fetchFaqs();
      showToast('FAQ display order updated', 'success');
    } catch {
      showToast('Failed to update FAQ order', 'error');
    }
  };

  // Delete FAQ
  const handleDeleteFaq = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this FAQ? It will instantly stop rendering on the student site.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('faqs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setFaqs(prev => prev.filter(f => f.id !== id));
      showToast('FAQ removed successfully', 'success');
    } catch (err: any) {
      showToast('Failed to delete FAQ: ' + err.message, 'error');
    }
  };

  // Save/Create FAQ Form Submission
  const handleSaveFaq = async (form: Partial<FAQ>) => {
    if (!form.question?.trim() || !form.answer?.trim()) {
      showToast('Please enter both question and answer fields.', 'warning');
      return;
    }

    setSaving(true);
    try {
      if (isCreating) {
        // Insert new FAQ
        const nextOrder = faqs.length > 0 ? Math.max(...faqs.map(f => f.display_order)) + 1 : 1;
        const { data, error } = await supabase
          .from('faqs')
          .insert({
            question: form.question.trim(),
            answer: form.answer.trim(),
            display_order: form.display_order || nextOrder,
            is_active: form.is_active !== undefined ? form.is_active : true
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          showToast('FAQ created successfully!', 'success');
        }
      } else {
        // Update existing FAQ
        const { error } = await supabase
          .from('faqs')
          .update({
            question: form.question.trim(),
            answer: form.answer.trim(),
            display_order: form.display_order,
            is_active: form.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', form.id);

        if (error) throw error;
        showToast('FAQ updated successfully!', 'success');
      }

      setEditingFaq(null);
      setIsCreating(false);
      fetchFaqs();
    } catch (err: any) {
      showToast('Failed to save FAQ: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 font-sans animate-fade-in">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
        <div>
          <h1 className="text-2xl font-black text-[#1A3C2E]">FAQ Manager Portal</h1>
          <p className="text-stone-500 text-sm">
            Manage student-facing Frequently Asked Questions. Deleted or deactivated FAQs are instantly hidden on the portal.
          </p>
        </div>
        <button
          onClick={() => {
            setIsCreating(true);
            setEditingFaq({
              question: '',
              answer: '',
              display_order: faqs.length + 1,
              is_active: true
            });
          }}
          className="bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-xs transition-colors self-start sm:self-center"
        >
          <Plus size={14} /> Add FAQ
        </button>
      </div>

      {/* Main FAQ list */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-20 flex flex-col items-center justify-center shadow-sm">
          <div className="w-8 h-8 border-3 border-[#F5B400] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-stone-400 font-mono text-xs uppercase tracking-wider">Syncing FAQs...</p>
        </div>
      ) : faqs.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title="No FAQ entries yet"
          description="Create your first portal FAQ by clicking the 'Add FAQ' button above."
        />
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-stone-50 border-b border-stone-100 text-stone-500 font-mono text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="w-12 px-3 py-3 text-center">Order</th>
                  <th className="px-5 py-3">Question &amp; Answer Details</th>
                  <th className="w-24 px-4 py-3 text-center">Status</th>
                  <th className="w-28 px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {faqs.map((faq, index) => (
                  <tr key={faq.id} className="hover:bg-zinc-50/50 transition-colors">
                    {/* Shift Reordering Arrows */}
                    <td className="px-3 py-4">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          disabled={index === 0}
                          onClick={() => moveFaq(faq.id, 'up')}
                          className="text-stone-300 hover:text-stone-600 disabled:opacity-30 transition-colors"
                          title="Move Up"
                        >
                          <ChevronUp size={15} />
                        </button>
                        <span className="font-mono text-[10px] font-black text-[#1A3C2E] select-none">
                          {faq.display_order}
                        </span>
                        <button
                          disabled={index === faqs.length - 1}
                          onClick={() => moveFaq(faq.id, 'down')}
                          className="text-stone-300 hover:text-stone-600 disabled:opacity-30 transition-colors"
                          title="Move Down"
                        >
                          <ChevronDown size={15} />
                        </button>
                      </div>
                    </td>

                    {/* Question & Answer texts */}
                    <td className="px-5 py-4 space-y-1">
                      <div className="flex items-start gap-2">
                        <HelpCircle size={15} className="text-[#F5B400] shrink-0 mt-0.5" />
                        <span className="font-bold text-stone-800 text-xs md:text-sm">
                          {faq.question}
                        </span>
                      </div>
                      <p className="text-stone-500 text-xs pl-6 leading-relaxed max-w-2xl whitespace-pre-wrap">
                        {faq.answer}
                      </p>
                    </td>

                    {/* Active Checkbox/Badge Status */}
                    <td className="px-4 py-4 text-center">
                      {faq.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-50 text-stone-400 border border-stone-200">
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Action buttons */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setIsCreating(false);
                            setEditingFaq(faq);
                          }}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-[#1A3C2E] hover:bg-stone-100 transition-colors"
                          title="Edit FAQ"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteFaq(faq.id)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete FAQ"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE & EDIT FORM MODAL */}
      {editingFaq && (
        <Modal 
          isOpen={true} 
          onClose={() => { setEditingFaq(null); setIsCreating(false); }} 
          title={isCreating ? 'Add FAQ Entry' : 'Modify FAQ Entry'}
        >
          <FaqForm 
            faq={editingFaq} 
            saving={saving} 
            onSave={handleSaveFaq} 
            onClose={() => { setEditingFaq(null); setIsCreating(false); }} 
          />
        </Modal>
      )}
    </div>
  );
}

interface FaqFormProps {
  faq: Partial<FAQ>;
  saving: boolean;
  onSave: (f: Partial<FAQ>) => void;
  onClose: () => void;
}

function FaqForm({ faq, saving, onSave, onClose }: FaqFormProps) {
  const [form, setForm] = useState({
    id: faq.id,
    question: faq.question || '',
    answer: faq.answer || '',
    display_order: faq.display_order || 0,
    is_active: faq.is_active !== undefined ? faq.is_active : true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 font-sans text-stone-800">
      {/* Question */}
      <div className="space-y-1">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-500">
          Question Text
        </label>
        <input 
          type="text" 
          value={form.question} 
          onChange={(e) => setForm({ ...form, question: e.target.value })} 
          placeholder="e.g. Can I register for multiple events?"
          className="w-full border border-zinc-200 rounded-lg px-4 py-2 text-xs outline-none focus:border-[#F5B400] transition-colors"
          required
        />
      </div>

      {/* Answer */}
      <div className="space-y-1">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-500">
          Answer Content
        </label>
        <textarea 
          value={form.answer} 
          onChange={(e) => setForm({ ...form, answer: e.target.value })} 
          placeholder="Provide a clear, helpful answer to students..."
          rows={4} 
          className="w-full border border-zinc-200 rounded-lg px-4 py-2 text-xs outline-none focus:border-[#F5B400] transition-colors resize-none"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Display Order */}
        <div className="space-y-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-500">
            Display Order
          </label>
          <input 
            type="number" 
            value={form.display_order} 
            onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} 
            className="w-full border border-zinc-200 rounded-lg px-4 py-2 text-xs outline-none focus:border-[#F5B400] transition-colors"
            required
          />
        </div>

        {/* Active Toggle */}
        <div className="flex flex-col justify-end pb-1.5 pl-2">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-stone-600">
            <input 
              type="checkbox" 
              checked={form.is_active} 
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 rounded text-[#1A3C2E] border-zinc-300 focus:ring-[#FAF7EA] focus:ring-0 cursor-pointer"
            />
            <span>Publish FAQ (Active)</span>
          </label>
        </div>
      </div>

      {/* Info Warning */}
      <div className="flex gap-2 p-3 bg-amber-50/50 border border-amber-100 rounded-lg text-amber-900 text-[10px] leading-relaxed">
        <Info size={14} className="shrink-0 text-[#F5B400] mt-0.5" />
        <div>
          Active status determines whether this question appears on the home portal. Unchecking it will archive it silently in the dashboard.
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100">
        <button 
          type="button"
          onClick={onClose} 
          disabled={saving}
          className="px-4 py-2 rounded-lg text-xs font-bold bg-stone-50 text-stone-500 hover:bg-stone-100 transition-colors"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={saving}
          className="px-5 py-2 bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] rounded-lg font-bold text-xs uppercase tracking-wider shadow-xs transition-colors disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save FAQ'}
        </button>
      </div>
    </form>
  );
}
