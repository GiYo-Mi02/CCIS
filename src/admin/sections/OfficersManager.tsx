import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Users, ChevronUp, ChevronDown, Trash } from 'lucide-react';
import { useAdmin } from '../AdminContext';
import { supabase } from '../../lib/supabase';
import { Officer, Committee } from '../../types/database';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

type Tab = 'officers' | 'committees';

export default function OfficersManager() {
  const { showToast } = useAdmin();
  const [tab, setTab] = useState<Tab>('officers');
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingOfficer, setEditingOfficer] = useState<Partial<Officer> | null>(null);
  const [editingCommittee, setEditingCommittee] = useState<Partial<Committee> | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchData = async () => {
    const [offRes, commRes] = await Promise.all([
      supabase.from('officers').select('*').order('display_order'),
      supabase.from('committees').select('*').order('name'),
    ]);
    if (offRes.data) setOfficers(offRes.data as Officer[]);
    if (commRes.data) setCommittees(commRes.data as Committee[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const moveOfficer = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...officers].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex(o => o.id === id);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === sorted.length - 1)) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const orderA = sorted[idx].display_order;
    const orderB = sorted[swapIdx].display_order;
    await Promise.all([
      supabase.from('officers').update({ display_order: orderB }).eq('id', sorted[idx].id),
      supabase.from('officers').update({ display_order: orderA }).eq('id', sorted[swapIdx].id),
    ]);
    fetchData();
  };

  const deleteOfficer = async (id: string) => {
    const { error } = await supabase.from('officers').delete().eq('id', id);
    if (error) { showToast('Failed to delete', 'error'); return; }
    setOfficers(prev => prev.filter(o => o.id !== id));
    showToast('Officer removed', 'error');
  };

  const saveOfficer = async (form: Partial<Officer>) => {
    if (isCreating) {
      const { error } = await supabase.from('officers').insert({
        name: form.name, position: form.position, committee_id: form.committee_id,
        photo_url: form.photo_url, email: form.email, display_order: officers.length + 1,
      });
      if (error) { showToast('Failed to add officer', 'error'); return; }
      showToast('Officer added!');
    } else {
      const { error } = await supabase.from('officers').update({
        name: form.name, position: form.position, committee_id: form.committee_id,
        photo_url: form.photo_url, email: form.email,
      }).eq('id', form.id);
      if (error) { showToast('Failed to update', 'error'); return; }
      showToast('Officer updated!');
    }
    setEditingOfficer(null);
    setIsCreating(false);
    fetchData();
  };

  const deleteCommittee = async (id: string) => {
    const { error } = await supabase.from('committees').delete().eq('id', id);
    if (error) { showToast('Failed to delete', 'error'); return; }
    setCommittees(prev => prev.filter(c => c.id !== id));
    showToast('Committee removed', 'error');
  };

  const saveCommittee = async (form: Partial<Committee>) => {
    if (isCreating) {
      const { error } = await supabase.from('committees').insert({
        name: form.name, description: form.description, head_name: form.head_name,
        responsibilities: form.responsibilities || [], icon: form.icon,
      });
      if (error) { showToast('Failed to add committee', 'error'); return; }
      showToast('Committee added!');
    } else {
      const { error } = await supabase.from('committees').update({
        name: form.name, description: form.description, head_name: form.head_name,
        responsibilities: form.responsibilities || [], icon: form.icon,
      }).eq('id', form.id);
      if (error) { showToast('Failed to update', 'error'); return; }
      showToast('Committee updated!');
    }
    setEditingCommittee(null);
    setIsCreating(false);
    fetchData();
  };

  const handleDeleteAllOfficers = async () => {
    const { error } = await supabase.from('officers').delete().neq('id', '');
    if (error) { showToast('Failed to delete all', 'error'); return; }
    setOfficers([]);
    showToast('All officers deleted', 'error');
  };

  const handleDeleteAllCommittees = async () => {
    const { error } = await supabase.from('committees').delete().neq('id', '');
    if (error) { showToast('Failed to delete all', 'error'); return; }
    setCommittees([]);
    showToast('All committees deleted', 'error');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-[#F5B400] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sortedOfficers = [...officers].sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-100 p-1 shadow-sm">
          <button onClick={() => setTab('officers')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${tab === 'officers' ? 'bg-[#F5B400] text-[#1A3C2E] shadow-sm' : 'text-gray-500 hover:text-[#1A3C2E] hover:bg-gray-50'}`}>Officers</button>
          <button onClick={() => setTab('committees')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${tab === 'committees' ? 'bg-[#F5B400] text-[#1A3C2E] shadow-sm' : 'text-gray-500 hover:text-[#1A3C2E] hover:bg-gray-50'}`}>Committees</button>
        </div>
        <div className="flex-1" />
        {tab === 'officers' && officers.length > 0 && (
          <button onClick={handleDeleteAllOfficers} className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors">
            <Trash size={13} /> Delete All
          </button>
        )}
        {tab === 'committees' && committees.length > 0 && (
          <button onClick={handleDeleteAllCommittees} className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors">
            <Trash size={13} /> Delete All
          </button>
        )}
        <button
          onClick={() => {
            setIsCreating(true);
            if (tab === 'officers') {
              setEditingOfficer({ name: '', position: '', committee_id: committees[0]?.id, photo_url: '', email: '', display_order: officers.length + 1 });
            } else {
              setEditingCommittee({ name: '', description: '', head_name: '', responsibilities: [] });
            }
          }}
          className="bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus size={15} /> Add {tab === 'officers' ? 'Officer' : 'Committee'}
        </button>
      </div>

      {/* Officers Tab */}
      {tab === 'officers' && (
        sortedOfficers.length === 0 ? (
          <EmptyState icon={Users} title="No officers yet" description="Add your first officer to get started." />
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="w-10 px-3 py-3"></th>
                  <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-gray-400">Photo</th>
                  <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-gray-400">Name</th>
                  <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-gray-400">Position</th>
                  <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-gray-400">Email</th>
                  <th className="text-right px-5 py-3 font-bold text-[10px] uppercase tracking-wider text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedOfficers.map((off, idx) => (
                  <tr key={off.id} className="hover:bg-[#1A3C2E]/[0.02] transition-colors">
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-center gap-0.5">
                        <button disabled={idx === 0} onClick={() => moveOfficer(off.id, 'up')} className="text-gray-300 hover:text-gray-500 disabled:opacity-30 transition-colors"><ChevronUp size={14} /></button>
                        <button disabled={idx === sortedOfficers.length - 1} onClick={() => moveOfficer(off.id, 'down')} className="text-gray-300 hover:text-gray-500 disabled:opacity-30 transition-colors"><ChevronDown size={14} /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-9 h-9 rounded-full bg-[#1A3C2E]/10 overflow-hidden border-2 border-[#FAF7EA]">
                        <img src={off.photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${off.name}`} alt={off.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${off.name}`; }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#222B26]">{off.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{off.position}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{off.email}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setIsCreating(false); setEditingOfficer(off); }} className="p-1.5 rounded-lg text-gray-400 hover:text-[#1A3C2E] hover:bg-gray-100 transition-colors"><Edit3 size={14} /></button>
                        <button onClick={() => deleteOfficer(off.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#C0392B] hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Committees Tab */}
      {tab === 'committees' && (
        committees.length === 0 ? (
          <EmptyState icon={Users} title="No committees yet" description="Add your first committee to get started." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {committees.map(comm => (
              <div key={comm.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-sans font-bold text-sm text-[#1A3C2E]">{comm.name}</h3>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setIsCreating(false); setEditingCommittee(comm); }} className="p-1.5 rounded-lg text-gray-400 hover:text-[#1A3C2E] hover:bg-gray-100 transition-colors"><Edit3 size={13} /></button>
                    <button onClick={() => deleteCommittee(comm.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#C0392B] hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mb-3">{comm.description}</p>
                <div className="flex items-center gap-3 text-[10px] font-mono text-gray-400">
                  <span>Head: <strong className="text-[#222B26]">{comm.head_name}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Officer edit/create modal */}
      {editingOfficer && (
        <Modal isOpen={true} onClose={() => { setEditingOfficer(null); setIsCreating(false); }} title={isCreating ? 'Add Officer' : 'Edit Officer'}>
          <OfficerForm officer={editingOfficer} committees={committees} onSave={saveOfficer} onClose={() => { setEditingOfficer(null); setIsCreating(false); }} />
        </Modal>
      )}

      {/* Committee edit/create modal */}
      {editingCommittee && (
        <Modal isOpen={true} onClose={() => { setEditingCommittee(null); setIsCreating(false); }} title={isCreating ? 'Add Committee' : 'Edit Committee'}>
          <CommitteeForm committee={editingCommittee} onSave={saveCommittee} onClose={() => { setEditingCommittee(null); setIsCreating(false); }} />
        </Modal>
      )}
    </div>
  );
}

function OfficerForm({ officer, committees, onSave, onClose }: { officer: Partial<Officer>; committees: Committee[]; onSave: (o: Partial<Officer>) => void; onClose: () => void }) {
  const [form, setForm] = useState({ ...officer });
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Name</label>
        <input type="text" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Position</label>
          <input type="text" value={form.position || ''} onChange={(e) => setForm({ ...form, position: e.target.value })} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Committee</label>
          <select value={form.committee_id || ''} onChange={(e) => setForm({ ...form, committee_id: e.target.value })} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400]">
            <option value="">Select...</option>
            {committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Photo URL</label>
        <input type="text" value={form.photo_url || ''} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]" />
        {form.photo_url && <div className="mt-2 w-16 h-16 rounded-full overflow-hidden border-2 border-[#FAF7EA]"><img src={form.photo_url} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" /></div>}
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Email</label>
        <input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]" />
      </div>
      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <button onClick={() => onSave(form)} className="px-5 py-2.5 bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm transition-colors">Save Officer</button>
        <button onClick={onClose} className="px-4 py-2.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
      </div>
    </div>
  );
}

function CommitteeForm({ committee, onSave, onClose }: { committee: Partial<Committee>; onSave: (c: Partial<Committee>) => void; onClose: () => void }) {
  const [form, setForm] = useState({ ...committee });
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Committee Name</label>
        <input type="text" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]" />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Description</label>
        <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400] resize-none" />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Head</label>
        <input type="text" value={form.head_name || ''} onChange={(e) => setForm({ ...form, head_name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]" />
      </div>
      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <button onClick={() => onSave(form)} className="px-5 py-2.5 bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm transition-colors">Save Committee</button>
        <button onClick={onClose} className="px-4 py-2.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
      </div>
    </div>
  );
}
