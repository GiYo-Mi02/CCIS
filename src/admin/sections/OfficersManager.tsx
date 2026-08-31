import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit3, Trash2, Users, ChevronUp, ChevronDown, Trash, Upload, X, Link as LinkIcon, Image as ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import { useAdmin } from '../AdminContext';
import { supabase } from '../../lib/supabase';
import { Officer, Committee } from '../../types/database';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { deleteManagedOptimizedImage, deleteManagedOptimizedImageByUrl, uploadOptimizedImage } from '../../lib/media/uploadOptimizedImage';
import type { MediaAsset } from '../../lib/media/types';

type Tab = 'officers' | 'committees';

export default function OfficersManager() {
  const { showToast } = useAdmin();
  const [tab, setTab] = useState<Tab>('officers');
  const [selectedTerm, setSelectedTerm] = useState<string>('2026-2027');
  const [selectedOrg, setSelectedOrg] = useState<string>('Student Council');
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingOfficer, setEditingOfficer] = useState<Partial<Officer> | null>(null);
  const [editingCommittee, setEditingCommittee] = useState<Partial<Committee> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const deletingAllOfficersRef = useRef(false);
  const deletingAllCommitteesRef = useRef(false);

  const fetchData = async () => {
    const [offRes, commRes] = await Promise.all([
      supabase.from('officers').select('id, name, position, committee_id, photo_url, email, display_order, created_at, quote, term, organization').order('display_order'),
      supabase.from('committees').select('id, name, slug, description, icon, responsibilities, display_order, head_name, created_at').order('name'),
    ]);
    if (offRes.data) setOfficers(offRes.data as Officer[]);
    if (commRes.data) setCommittees(commRes.data as Committee[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const moveOfficer = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...officers]
      .filter(o => 
        (o.term || '2026-2027') === selectedTerm && 
        (o.organization || 'Student Council') === selectedOrg
      )
      .sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex(o => o.id === id);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === sorted.length - 1)) return;
    const { error } = await supabase.rpc('swap_officer_order', {
      p_officer_id: id,
      p_direction: direction,
    });
    if (error) { showToast('Failed to update officer order', 'error'); return; }
    await fetchData();
  };

  const deleteOfficer = async (id: string) => {
    if (deleting || !window.confirm('Remove this officer? This action cannot be undone.')) return;
    const deletedOfficer = officers.find(officer => officer.id === id);
    setDeleting(`officer:${id}`);
    try {
      const { error } = await supabase.from('officers').delete().eq('id', id);
      if (error) { showToast('Failed to delete', 'error'); return; }
      await deleteManagedOptimizedImageByUrl(deletedOfficer?.photo_url, 'gallery-images').catch(error =>
        console.error('Failed to clean up managed officer image:', error));
      setOfficers(prev => prev.filter(o => o.id !== id));
      showToast('Officer removed', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const saveOfficer = async (form: Partial<Officer>) => {
    // If committee_id is empty string, convert to null for Executive Board classification
    const commId = form.committee_id === '' ? null : form.committee_id;
    const orgVal = form.organization || 'Student Council';
    
    // Calculate display order relative to the active organization and term
    const orgOfficers = officers.filter(o => 
      (o.term || '2026-2027') === (form.term || selectedTerm) && 
      (o.organization || 'Student Council') === orgVal
    );

    if (isCreating) {
      const { error } = await supabase.from('officers').insert({
        name: form.name, position: form.position, committee_id: commId,
        photo_url: form.photo_url, email: form.email, quote: form.quote,
        term: form.term || '2026-2027',
        organization: orgVal,
        display_order: orgOfficers.length + 1,
      });
      if (error) { showToast('Failed to add officer', 'error'); throw error; }
      showToast('Officer added!');
    } else {
      const { error } = await supabase.from('officers').update({
        name: form.name, position: form.position, committee_id: commId,
        photo_url: form.photo_url, email: form.email, quote: form.quote,
        term: form.term || '2026-2027',
        organization: orgVal,
      }).eq('id', form.id);
      if (error) { showToast('Failed to update', 'error'); throw error; }
      showToast('Officer updated!');
    }
    setEditingOfficer(null);
    setIsCreating(false);
    fetchData();
  };

  const deleteCommittee = async (id: string) => {
    if (deleting || !window.confirm('Remove this committee? This action cannot be undone.')) return;
    setDeleting(`committee:${id}`);
    try {
      const { error } = await supabase.from('committees').delete().eq('id', id);
      if (error) { showToast('Failed to delete', 'error'); return; }
      setCommittees(prev => prev.filter(c => c.id !== id));
      showToast('Committee removed', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const saveCommittee = async (form: Partial<Committee>) => {
    if (isCreating) {
      const generatedSlug = form.slug || form.name?.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || '';
      const { error } = await supabase.from('committees').insert({
        name: form.name,
        slug: generatedSlug,
        description: form.description,
        head_name: form.head_name,
        responsibilities: form.responsibilities || [],
        icon: form.icon || 'users',
        display_order: committees.length + 1,
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
    if (deletingAllOfficersRef.current || deleting || !window.confirm('Delete all officers? This action cannot be undone.')) return;
    deletingAllOfficersRef.current = true;
    setDeleting('officers:all');
    try {
      const { error } = await supabase.from('officers').delete().not('id', 'is', null);
      if (error) { showToast('Failed to delete all', 'error'); return; }
      setOfficers([]);
      showToast('All officers deleted', 'error');
    } finally {
      deletingAllOfficersRef.current = false;
      setDeleting(null);
    }
  };

  const handleDeleteAllCommittees = async () => {
    if (deletingAllCommitteesRef.current || deleting || !window.confirm('Delete all committees? This action cannot be undone.')) return;
    deletingAllCommitteesRef.current = true;
    setDeleting('committees:all');
    try {
      const { error } = await supabase.from('committees').delete().not('id', 'is', null);
      if (error) { showToast('Failed to delete all', 'error'); return; }
      setCommittees([]);
      showToast('All committees deleted', 'error');
    } finally {
      deletingAllCommitteesRef.current = false;
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-[#F5B400] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sortedOfficers = [...officers]
    .filter(o => 
      (o.term || '2026-2027') === selectedTerm &&
      (o.organization || 'Student Council') === selectedOrg
    )
    .sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-100 p-1 shadow-sm">
          <button onClick={() => setTab('officers')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${tab === 'officers' ? 'bg-[#F5B400] text-[#1A3C2E] shadow-sm' : 'text-gray-500 hover:text-[#1A3C2E] hover:bg-gray-50'}`}>Officers</button>
          <button onClick={() => setTab('committees')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${tab === 'committees' ? 'bg-[#F5B400] text-[#1A3C2E] shadow-sm' : 'text-gray-500 hover:text-[#1A3C2E] hover:bg-gray-50'}`}>Committees</button>
        </div>

        {tab === 'officers' && (
          <div className="flex gap-2">
            <select 
              value={selectedTerm} 
              onChange={(e) => setSelectedTerm(e.target.value)} 
              className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-500 shadow-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]"
            >
              <option value="2026-2027">AY 2026-2027</option>
              <option value="2025-2026">AY 2025-2026</option>
              <option value="2024-2025">AY 2024-2025</option>
            </select>
            <select 
              value={selectedOrg} 
              onChange={(e) => setSelectedOrg(e.target.value)} 
              className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-500 shadow-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]"
            >
              <option value="Student Council">Student Council</option>
              <option value="Computer Society">Computer Society</option>
              <option value="Society of Innovative Computing">Society of Innovative Computing</option>
            </select>
          </div>
        )}

        <div className="flex-1" />
        {tab === 'officers' && officers.length > 0 && (
           <button onClick={handleDeleteAllOfficers} disabled={deleting !== null} className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Trash size={13} /> Delete All
          </button>
        )}
        {tab === 'committees' && committees.length > 0 && (
           <button onClick={handleDeleteAllCommittees} disabled={deleting !== null} className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Trash size={13} /> Delete All
          </button>
        )}
        <button
          onClick={() => {
            setIsCreating(true);
            if (tab === 'officers') {
              const orgOfficers = officers.filter(o => 
                (o.term || '2026-2027') === selectedTerm && 
                (o.organization || 'Student Council') === selectedOrg
              );
              setEditingOfficer({ 
                name: '', 
                position: '', 
                committee_id: '', 
                photo_url: '', 
                email: '', 
                term: selectedTerm, 
                organization: selectedOrg, 
                display_order: orgOfficers.length + 1 
              });
            } else {
              setEditingCommittee({ name: '', description: '', head_name: '', responsibilities: [] });
            }
          }}
          className="bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
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
            <div className="overflow-x-auto">
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
                         <button onClick={() => deleteOfficer(off.id)} disabled={deleting !== null} className="p-1.5 rounded-lg text-gray-400 hover:text-[#C0392B] hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                     <button onClick={() => deleteCommittee(comm.id)} disabled={deleting !== null} className="p-1.5 rounded-lg text-gray-400 hover:text-[#C0392B] hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"><Trash2 size={13} /></button>
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

function OfficerForm({ officer, committees, onSave, onClose }: { officer: Partial<Officer>; committees: Committee[]; onSave: (o: Partial<Officer>) => Promise<void> | void; onClose: () => void }) {
  const { showToast } = useAdmin();
  const [form, setForm] = useState({ ...officer });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(officer.photo_url || '');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [photoInputMode, setPhotoInputMode] = useState<'upload' | 'link'>('upload');
  const [optimizationSummary, setOptimizationSummary] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const validateFile = (file: File): string | null => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return `File format ${file.type} is not supported. Use JPG, PNG or WEBP.`;
    }
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return `File "${file.name}" exceeds the 10MB size limit.`;
    }
    return null;
  };

  const handleFileChange = (file: File) => {
    const errorMsg = validateFile(file);
    if (errorMsg) {
      showToast(errorMsg, 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
    setForm(prev => ({ ...prev, photo_url: objectUrl }));
    showToast('Image selected! Save officer to upload.', 'info');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemovePhoto = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl('');
    setForm(prev => ({ ...prev, photo_url: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
    showToast('Photo link removed', 'info');
  };

  const handleSave = async () => {
    if (!form.name || !form.name.trim()) {
      showToast('Please provide officer name', 'error');
      return;
    }

    setIsUploading(true);
    let finalPhotoUrl = form.photo_url || '';
    let uploadedAsset: MediaAsset | null = null;

    try {
      if (selectedFile) {
        setUploadProgress(25);
        setUploadProgress(50);
        const result = await uploadOptimizedImage(selectedFile, {
          category: 'officer',
          bucket: 'gallery-images',
          folder: 'officers',
          entityType: 'officers',
          entityId: officer.id,
        });
        uploadedAsset = result.asset;
        setUploadProgress(85);
        finalPhotoUrl = result.asset.publicUrl;
        setOptimizationSummary(
          `${(result.originalSizeBytes / 1024).toFixed(0)} KB original to ${(result.optimizedSizeBytes / 1024).toFixed(0)} KB WebP (${result.percentageSaved.toFixed(0)}% saved)`,
        );
      }

      await onSave({
        ...form,
        photo_url: finalPhotoUrl,
      });
      if (officer.photo_url && officer.photo_url !== finalPhotoUrl) {
        await deleteManagedOptimizedImageByUrl(officer.photo_url, 'gallery-images').catch(error =>
          console.error('Failed to clean up replaced officer image:', error));
      }
    } catch (err: unknown) {
      if (uploadedAsset) await deleteManagedOptimizedImage(uploadedAsset).catch(() => undefined);
      console.error('Error uploading officer photo:', err);
      showToast(err instanceof Error ? err.message : 'Failed to upload photo', 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  return (
    <div className="space-y-4 text-left">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
          Full Name <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          value={form.name || ''}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Juan Dela Cruz"
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Position</label>
          <input
            type="text"
            value={form.position || ''}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
            placeholder="e.g. Vice Chairperson"
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Committee / Classification</label>
          <select
            value={form.committee_id || ''}
            onChange={(e) => setForm({ ...form, committee_id: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400]"
          >
            <option value="">Executive Officers (Executive Board / ExeBoard)</option>
            {committees.map(c => <option key={c.id} value={c.id}>{c.name} (Executive Committee / ExeCom)</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Academic Year (Term)</label>
          <select
            value={form.term || '2026-2027'}
            onChange={(e) => setForm({ ...form, term: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400]"
          >
            <option value="2026-2027">AY 2026-2027</option>
            <option value="2025-2026">AY 2025-2026</option>
            <option value="2024-2025">AY 2024-2025</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Organization</label>
          <select
            value={form.organization || 'Student Council'}
            onChange={(e) => setForm({ ...form, organization: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400]"
          >
            <option value="Student Council">Student Council</option>
            <option value="Computer Society">Computer Society</option>
            <option value="Society of Innovative Computing">Society of Innovative Computing</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Quote / Campaign Tagline</label>
        <input
          type="text"
          value={form.quote || ''}
          onChange={(e) => setForm({ ...form, quote: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]"
          placeholder="Enter campaign tagline or quote..."
        />
      </div>

      {/* Officer Photo Management Section */}
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
            Officer Photo
          </label>
          {previewUrl && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold">
              {selectedFile ? 'New Image Ready' : 'Photo Attached'}
            </span>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileChange(e.target.files[0]);
            }
          }}
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          id="officer-photo-file-input"
        />

        {previewUrl ? (
          /* Active Image Card View with Clear/Remove Option */
          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-[#F5B400] bg-gray-100 flex-shrink-0">
              <img
                src={previewUrl}
                alt="Officer preview"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${form.name || 'Officer'}`;
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-800 truncate">
                {selectedFile ? selectedFile.name : (form.photo_url || 'Active Photo')}
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                {selectedFile
                  ? `${(selectedFile.size / 1024).toFixed(1)} KB (Local File)`
                  : (form.photo_url?.startsWith('http') ? 'External / Storage Link' : 'Image preview active')}
              </p>
              {optimizationSummary && (
                <p className="mt-1 text-[10px] font-mono text-emerald-700">{optimizationSummary}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-1 transition-colors"
                title="Replace photo"
              >
                <RefreshCw size={12} /> Replace
              </button>
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="px-2.5 py-1.5 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                title="Remove photo link"
              >
                <Trash2 size={12} /> Remove Link Photo
              </button>
            </div>
          </div>
        ) : (
          /* Empty Photo State: Drag & Drop + Direct URL Tab Options */
          <div className="space-y-3">
            {/* Input Mode Selector */}
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
              <button
                type="button"
                onClick={() => setPhotoInputMode('upload')}
                className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                  photoInputMode === 'upload'
                    ? 'bg-[#F5B400] text-[#1A3C2E]'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Upload size={12} /> Drop / Upload Image
              </button>
              <button
                type="button"
                onClick={() => setPhotoInputMode('link')}
                className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                  photoInputMode === 'link'
                    ? 'bg-[#F5B400] text-[#1A3C2E]'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                <LinkIcon size={12} /> Paste Image Link
              </button>
            </div>

            {photoInputMode === 'upload' ? (
              /* Drag and Drop Zone */
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors duration-200 ${
                  isDragging
                    ? 'border-[#F5B400] bg-[#FAF7EA] scale-[1.01]'
                    : 'border-gray-300 hover:border-[#F5B400] bg-white hover:bg-gray-50'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-[#FAF7EA] text-[#1A3C2E] flex items-center justify-center mx-auto mb-2 border border-[#F5B400]/30">
                  <Upload size={18} />
                </div>
                <p className="text-xs font-bold text-gray-700">
                  {isDragging ? 'Drop photo here to upload' : 'Click or Drag & Drop photo here'}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  Supports JPG, PNG, WEBP (Max 10MB)
                </p>
              </div>
            ) : (
              /* Direct URL Input Field (Preserved Link) */
              <div>
                <input
                  type="text"
                  value={form.photo_url || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm({ ...form, photo_url: val });
                    setPreviewUrl(val);
                  }}
                  placeholder="https://example.com/officer_photo.jpg"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Enter a direct web image URL to link an existing photo.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Email</label>
        <input
          type="email"
          value={form.email || ''}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="officer@ccis-council.org"
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]"
        />
      </div>

      {/* Progress Bar Indicator */}
      {uploadProgress !== null && (
        <div className="w-full space-y-1 pt-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-gray-500">
            <span>Uploading photo to storage...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#F5B400] transition-[width] duration-300 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={handleSave}
          disabled={isUploading}
          className="px-5 py-2.5 bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {isUploading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Saving Officer...
            </>
          ) : (
            'Save Officer'
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isUploading}
          className="px-4 py-2.5 text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
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
