import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit3, Pin, Trash2, Megaphone, Trash, ImageIcon } from 'lucide-react';
import { useAdmin } from '../AdminContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Announcement } from '../../types/database';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

export default function AnnouncementsManager() {
  const { showToast } = useAdmin();
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*, profiles(full_name)')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    if (!error && data) setAnnouncements(data as Announcement[]);
    setLoading(false);
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  const filtered = announcements.filter(a => {
    const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleDelete = async (id: string) => {
    if (deleting || !window.confirm('Delete this announcement? This action cannot be undone.')) return;
    setDeleting(id);
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) { showToast('Failed to delete', 'error'); return; }
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      showToast('Announcement deleted', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteAll = async () => {
    if (deleting || !window.confirm('Delete all announcements? This action cannot be undone.')) return;
    setDeleting('all');
    try {
      const { error } = await supabase.from('announcements').delete().not('id', 'is', null);
      if (error) { showToast('Failed to delete all', 'error'); return; }
      setAnnouncements([]);
      showToast('All announcements deleted', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const handleTogglePin = async (id: string) => {
    const ann = announcements.find(a => a.id === id);
    if (!ann) return;
    const newPinned = !ann.pinned;
    const { error } = await supabase.from('announcements').update({ pinned: newPinned }).eq('id', id);
    if (error) { showToast('Failed to update pin', 'error'); return; }
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, pinned: newPinned } : a));
    showToast('Pin status updated');
  };

  const handleSave = async (ann: Partial<Announcement>, creating: boolean) => {
    if (creating) {
      const { data, error } = await supabase.from('announcements').insert({
        title: ann.title,
        content: ann.content,
        category: ann.category,
        status: ann.status,
        pinned: ann.pinned || false,
        banner_url: ann.banner_url,
        author_id: user?.id,
        published_at: ann.status === 'published' ? new Date().toISOString() : null,
      }).select('*, profiles(full_name)').single();
      if (error) { showToast('Failed to create', 'error'); return; }
      setAnnouncements(prev => [data as Announcement, ...prev]);
      showToast('Announcement created!');
    } else {
      const { error } = await supabase.from('announcements').update({
        title: ann.title,
        content: ann.content,
        category: ann.category,
        status: ann.status,
        pinned: ann.pinned,
        banner_url: ann.banner_url,
        published_at: ann.status === 'published' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', ann.id);
      if (error) { showToast('Failed to update', 'error'); return; }
      await fetchAnnouncements();
      showToast('Announcement updated!');
    }
    setEditingAnn(null);
    setIsCreating(false);
  };

  const openCreate = () => {
    setIsCreating(true);
    setEditingAnn({
      id: '',
      title: '',
      content: '',
      category: 'general',
      status: 'draft',
      pinned: false,
      banner_url: null,
      author_id: user?.id || null,
      published_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-[#F5B400] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openCreate}
            className="bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] px-5 py-2.5 rounded-lg font-sans font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm transition-colors flex-1 sm:flex-initial justify-center"
          >
            <Plus size={15} /> New Announcement
          </button>
          {announcements.length > 0 && (
            <button
              onClick={handleDeleteAll}
              disabled={deleting !== null}
              className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-colors flex-1 sm:flex-initial justify-center"
            >
              <Trash size={14} /> Delete All
            </button>
          )}
        </div>
        <div className="hidden md:block flex-1" />
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search announcements..."
              className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400] transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#F5B400] text-[#222B26] w-full sm:w-auto"
          >
            <option value="ALL">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements found"
          description="Create your first announcement to get started."
          actionLabel="Create Announcement"
          onAction={openCreate}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-bold text-[10px] uppercase tracking-wider text-gray-400">Title</th>
                  <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-gray-400">Category</th>
                  <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-gray-400">Status</th>
                  <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-gray-400">Date</th>
                  <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-gray-400">Author</th>
                  <th className="text-right px-5 py-3 font-bold text-[10px] uppercase tracking-wider text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(ann => (
                  <tr key={ann.id} className="hover:bg-[#1A3C2E]/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-[#222B26] truncate max-w-xs">{ann.title}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {ann.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge variant={ann.status === 'published' ? 'success' : 'neutral'} label={ann.status} />
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 font-mono text-xs">
                      {new Date(ann.published_at || ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 text-xs">{ann.profiles?.full_name || 'Admin'}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setIsCreating(false); setEditingAnn(ann); }} className="p-1.5 rounded-lg text-gray-400 hover:text-[#1A3C2E] hover:bg-gray-100 transition-colors" title="Edit">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => handleTogglePin(ann.id)} className={`p-1.5 rounded-lg transition-colors ${ann.pinned ? 'text-[#F5B400] bg-[#F5B400]/10' : 'text-gray-400 hover:text-[#F5B400] hover:bg-[#F5B400]/10'}`} title="Toggle Pin">
                          <Pin size={14} />
                        </button>
                         <button onClick={() => handleDelete(ann.id)} disabled={deleting !== null} className="p-1.5 rounded-lg text-gray-400 hover:text-[#C0392B] hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title="Delete">
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

      {/* Edit / Create Modal */}
      {editingAnn && (
        <AnnouncementForm
          announcement={editingAnn}
          isCreating={isCreating}
          onSave={(ann) => handleSave(ann, isCreating)}
          onClose={() => { setEditingAnn(null); setIsCreating(false); }}
        />
      )}
    </div>
  );
}

function AnnouncementForm({ announcement, isCreating, onSave, onClose }: {
  announcement: Announcement;
  isCreating: boolean;
  onSave: (a: Partial<Announcement>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(announcement.title);
  const [content, setContent] = useState(announcement.content);
  const [category, setCategory] = useState(announcement.category);
  const [bannerUrl, setBannerUrl] = useState(announcement.banner_url || '');
  const [pinned, setPinned] = useState(announcement.pinned);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be under 10MB.');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `announcements/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('banners')
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('banners')
        .getPublicUrl(fileName);

      setBannerUrl(urlData.publicUrl);
    } catch (err: any) {
      console.error(err);
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (status: 'draft' | 'published') => {
    onSave({
      id: announcement.id,
      title, content, category,
      status, pinned,
      banner_url: bannerUrl || null,
    });
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={isCreating ? 'New Announcement' : 'Edit Announcement'}>
      <div className="space-y-5">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400]"
            placeholder="Announcement title..." />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as any)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400]">
              <option value="event">Event</option>
              <option value="deadline">Deadline</option>
              <option value="result">Result</option>
              <option value="general">General</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Banner Image</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center relative flex-shrink-0">
                {bannerUrl ? (
                  <img src={bannerUrl} alt="Banner Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={20} className="text-stone-300" aria-hidden="true" />
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className="space-y-1 flex-1 font-sans">
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  onChange={handleUpload} 
                  className="hidden" 
                />
                <div className="flex gap-1.5">
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-3 py-1.5 border border-gray-200 hover:border-gray-300 text-[11px] font-bold rounded-lg text-gray-700 hover:bg-gray-50 transition-colors uppercase tracking-wider cursor-pointer"
                  >
                    {bannerUrl ? 'Change' : 'Choose'}
                  </button>
                  {bannerUrl && (
                    <button 
                      type="button"
                      onClick={() => setBannerUrl('')}
                      className="px-3 py-1.5 border border-rose-200 hover:border-rose-300 text-[11px] font-bold rounded-lg text-rose-600 hover:bg-rose-50 transition-colors uppercase tracking-wider cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[9px] text-gray-400">Max 5MB.</p>
              </div>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Content</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400] resize-none"
            placeholder="Write announcement content..." />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-[#F5B400] focus:ring-[#F5B400]" />
            <span className="text-xs font-bold text-[#222B26] uppercase tracking-wider">Pin this announcement</span>
          </label>
        </div>
        <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
          <button onClick={() => handleSubmit('draft')}
            className="px-5 py-2.5 border border-gray-200 rounded-lg font-bold text-xs uppercase tracking-wider text-gray-600 hover:bg-gray-50 transition-colors">
            Save as Draft
          </button>
          <button onClick={() => handleSubmit('published')}
            className="px-5 py-2.5 bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm transition-colors">
            Publish
          </button>
          <button onClick={onClose}
            className="ml-auto px-4 py-2.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
