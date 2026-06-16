import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Shield, Paintbrush, RotateCcw, Search, UserCheck, X } from 'lucide-react';
import { useAdmin } from '../AdminContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Profile, ThemeSetting, UserRole, ROLE_LABELS, ROLE_COLORS, ADMIN_ROLES } from '../../types/database';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { applyTheme } from '../../utils/theme';

type Tab = 'roles' | 'theme';

export default function SettingsRoles() {
  const { showToast } = useAdmin();
  const { profile: currentAuthProfile } = useAuth();
  
  const [tab, setTab] = useState<Tab>('roles');
  const [adminUsers, setAdminUsers] = useState<Profile[]>([]);
  const [themes, setThemes] = useState<ThemeSetting[]>([]);
  const [activeTheme, setActiveTheme] = useState<ThemeSetting | null>(null);
  
  // Loading states
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingThemes, setLoadingThemes] = useState(true);

  // Promoting user modal states
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [nonAdmins, setNonAdmins] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [promotingUser, setPromotingUser] = useState<Profile | null>(null);
  const [assigningRole, setAssigningRole] = useState<UserRole>('officer');
  const [assigningPosition, setAssigningPosition] = useState('');

  // Editing role modal states
  const [editingUser, setEditingUser] = useState<Profile | null>(null);

  // Custom colors form state (live customizer)
  const [customPrimary, setCustomPrimary] = useState('#1A3C2E');
  const [customAccent, setCustomAccent] = useState('#F5B400');
  const [customCanvas, setCustomCanvas] = useState('#FAF7EA');

  const fetchThemes = async () => {
    setLoadingThemes(true);
    const { data, error } = await supabase
      .from('theme_settings')
      .select('*')
      .order('created_at');

    if (error) {
      showToast('Failed to load themes', 'error');
    } else if (data) {
      setThemes(data as ThemeSetting[]);
      const active = data.find(t => t.is_active);
      if (active) {
        setActiveTheme(active);
        setCustomPrimary(active.primary_color);
        setCustomAccent(active.accent_color);
        setCustomCanvas(active.canvas_color);
      }
    }
    setLoadingThemes(false);
  };

  const fetchAdminUsers = async () => {
    setLoadingUsers(true);
    // Fetch profiles that have administrative roles
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ADMIN_ROLES)
      .order('full_name');

    if (error) {
      showToast('Failed to load admin users', 'error');
    } else if (data) {
      setAdminUsers(data as Profile[]);
    }
    setLoadingUsers(false);
  };

  useEffect(() => {
    fetchAdminUsers();
    fetchThemes();
  }, []);

  // Fetch student/non-admin users to promote
  const fetchNonAdmins = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('full_name')
      .limit(50); // limit for efficiency

    if (!error && data) {
      setNonAdmins(data as Profile[]);
    }
  };

  useEffect(() => {
    if (showPromoteModal) {
      fetchNonAdmins();
    }
  }, [showPromoteModal]);

  const handlePromoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promotingUser) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        role: assigningRole,
        position: assigningPosition || 'Committee Member',
        profile_complete: true
      })
      .eq('id', promotingUser.id);

    if (error) {
      showToast('Failed to assign role', 'error');
    } else {
      showToast(`Successfully promoted ${promotingUser.full_name || promotingUser.email} to admin`, 'success');
      setShowPromoteModal(false);
      setPromotingUser(null);
      setAssigningPosition('');
      fetchAdminUsers();
    }
  };

  const handleEditRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        role: editingUser.role,
        position: editingUser.position
      })
      .eq('id', editingUser.id);

    if (error) {
      showToast('Failed to update credentials', 'error');
    } else {
      showToast('Admin profile updated', 'success');
      setEditingUser(null);
      fetchAdminUsers();
    }
  };

  const handleDemote = async (userToDemote: Profile) => {
    // Prevent self demotion
    if (userToDemote.id === currentAuthProfile?.id) {
      showToast('Safety guard: You cannot demote yourself!', 'warning');
      return;
    }

    if (!confirm(`Are you sure you want to remove admin access for ${userToDemote.full_name || userToDemote.email}? This will set their role back to Student.`)) {
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        role: 'student',
        position: null
      })
      .eq('id', userToDemote.id);

    if (error) {
      showToast('Failed to revoke privileges', 'error');
    } else {
      setAdminUsers(prev => prev.filter(u => u.id !== userToDemote.id));
      showToast('Admin access revoked successfully', 'info');
    }
  };

  const handleApplyTheme = async (theme: ThemeSetting) => {
    setLoadingThemes(true);
    
    // 1. Reset all themes to inactive in DB
    const { error: resetError } = await supabase
      .from('theme_settings')
      .update({ is_active: false })
      .eq('is_active', true);

    if (resetError) {
      showToast('Theme synchronization failed', 'error');
      setLoadingThemes(false);
      return;
    }

    // 2. Set this theme to active in DB
    const { error: setActiveError } = await supabase
      .from('theme_settings')
      .update({ is_active: true })
      .eq('id', theme.id);

    if (setActiveError) {
      showToast('Failed to activate theme', 'error');
    } else {
      // 3. Update active theme state and apply colors live in CSS variables
      setActiveTheme(theme);
      setCustomPrimary(theme.primary_color);
      setCustomAccent(theme.accent_color);
      setCustomCanvas(theme.canvas_color);
      
      applyTheme({
        primaryGreen: theme.primary_color,
        accentGold: theme.accent_color,
        bgCream: theme.canvas_color
      });

      // Update the local list state
      setThemes(prev => prev.map(t => t.id === theme.id ? { ...t, is_active: true } : { ...t, is_active: false }));
      showToast(`Theme "${theme.preset_name}" is now active globally!`, 'success');
    }
    setLoadingThemes(false);
  };

  const handleSaveCustomTheme = async () => {
    const customName = 'Custom Workspace Palette';

    // 1. Reset all themes to inactive in DB
    const { error: resetError } = await supabase
      .from('theme_settings')
      .update({ is_active: false })
      .eq('is_active', true);

    if (resetError) {
      showToast('Theme synchronization failed', 'error');
      return;
    }

    // 2. Check if the custom theme already exists
    const { data: existingTheme, error: selectError } = await supabase
      .from('theme_settings')
      .select('*')
      .eq('preset_name', customName)
      .maybeSingle();

    if (selectError) {
      showToast('Failed to check custom theme', 'error');
      console.error('Select custom theme error:', selectError.message);
      return;
    }

    let resultData: ThemeSetting | null = null;
    let resultError: any = null;

    if (existingTheme) {
      // Update the existing theme row
      const { data, error } = await supabase
        .from('theme_settings')
        .update({
          primary_color: customPrimary,
          accent_color: customAccent,
          canvas_color: customCanvas,
          is_active: true
        })
        .eq('id', existingTheme.id)
        .select()
        .single();
      
      resultData = data as ThemeSetting;
      resultError = error;
    } else {
      // Insert a new theme row
      const { data, error } = await supabase
        .from('theme_settings')
        .insert({
          preset_name: customName,
          primary_color: customPrimary,
          accent_color: customAccent,
          canvas_color: customCanvas,
          is_active: true
        })
        .select()
        .single();

      resultData = data as ThemeSetting;
      resultError = error;
    }

    if (resultError) {
      showToast('Failed to save colors', 'error');
      console.error('Save custom theme error:', resultError.message);
    } else if (resultData) {
      // 3. Apply active colors live and sync list state
      setActiveTheme(resultData);
      
      applyTheme({
        primaryGreen: resultData.primary_color,
        accentGold: resultData.accent_color,
        bgCream: resultData.canvas_color
      });

      await fetchThemes();
      showToast('Custom branding palette active globally!', 'success');
    }
  };


  const handleResetThemeDefaults = () => {
    setCustomPrimary('#1A3C2E');
    setCustomAccent('#F5B400');
    setCustomCanvas('#FAF7EA');
    showToast('Color fields reset to default values', 'info');
  };

  // Filter students for search in promotion modal
  const filteredStudents = nonAdmins.filter(student => {
    const nameStr = student.full_name || '';
    const emailStr = student.email || '';
    const searchLower = searchQuery.toLowerCase();
    return nameStr.toLowerCase().includes(searchLower) || emailStr.toLowerCase().includes(searchLower);
  });

  return (
    <div className="space-y-6 font-sans animate-fade-in">
      
      {/* Title Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full">
        <div>
          <h1 className="text-2xl font-black text-[#1A3C2E]">Privileges & Theme Configurations</h1>
          <p className="text-stone-500 text-sm">Assign coordinator roles, manage team permissions, and customize the website's branding color scheme.</p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-[#1A3C2E]/5 p-1 rounded-xl flex-shrink-0 w-full lg:w-auto">
          <button
            onClick={() => setTab('roles')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex-1 lg:flex-initial text-center ${
              tab === 'roles'
                ? 'bg-[#1A3C2E] text-white shadow-sm'
                : 'text-[#1A3C2E] hover:bg-[#1A3C2E]/5'
            }`}
          >
            <Shield size={14} className="inline-block mr-1.5 -mt-0.5" /> Coordinator Roles
          </button>
          <button
            onClick={() => setTab('theme')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex-1 lg:flex-initial text-center ${
              tab === 'theme'
                ? 'bg-[#1A3C2E] text-white shadow-sm'
                : 'text-[#1A3C2E] hover:bg-[#1A3C2E]/5'
            }`}
          >
            <Paintbrush size={14} className="inline-block mr-1.5 -mt-0.5" /> Site Theme Customizer
          </button>
        </div>
      </div>

      {/* 1. COORDINATOR ROLES TAB */}
      {tab === 'roles' && (
        <div className="space-y-4">
          
          {/* Actions Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center sm:justify-between bg-white px-5 py-4 rounded-xl border border-zinc-200 shadow-sm w-full">
            <span className="text-xs font-bold text-[#1A3C2E] bg-[#1A3C2E]/5 px-3 py-1.5 rounded-full w-full sm:w-auto text-center sm:text-left">
              {adminUsers.length} Active Staff Members
            </span>
            <button
              onClick={() => { setShowPromoteModal(true); setPromotingUser(null); }}
              className="bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-xs transition-colors focus:outline-none w-full sm:w-auto justify-center"
            >
              <Plus size={14} /> Promote User
            </button>
          </div>

          {/* Admin user listing table */}
          {loadingUsers ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-20 flex flex-col items-center justify-center shadow-sm">
              <div className="w-8 h-8 border-3 border-[#F5B400] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-stone-400 font-mono text-xs uppercase tracking-wider">Syncing user profiles...</p>
            </div>
          ) : adminUsers.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No admin users found"
              description="There are no users with assigned coordinator roles in the database. Promote a student to get started."
            />
          ) : (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-stone-50 border-b border-stone-100 text-stone-500 font-mono">
                    <tr>
                      <th className="px-5 py-3 font-bold text-[10px] uppercase tracking-wider">Staff Member</th>
                      <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Position</th>
                      <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Assigned Role</th>
                      <th className="px-5 py-3 font-bold text-[10px] uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {adminUsers.map(user => (
                      <tr key={user.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-5 py-4 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#1A3C2E] text-[#FAF7EA] flex items-center justify-center font-bold font-sans">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              (user.full_name || 'Admin').split(' ').map(n => n[0]).join('')
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-stone-800 block">{user.full_name || 'Coordinator'}</span>
                            {user.id === currentAuthProfile?.id && (
                              <span className="text-[9px] font-bold text-[#F5B400] bg-[#F5B400]/10 border border-[#F5B400]/20 px-1.5 py-0.2 rounded mt-0.5 inline-block">You</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-stone-500 text-xs font-mono">{user.email}</td>
                        <td className="px-4 py-4 text-stone-600 text-xs font-semibold">{user.position || 'Committee Member'}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${ROLE_COLORS[user.role]}`}>
                            {ROLE_LABELS[user.role]}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setEditingUser(user)}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-[#1A3C2E] hover:bg-stone-100 transition-colors"
                              title="Edit Credentials"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDemote(user)}
                              disabled={user.id === currentAuthProfile?.id}
                              className={`p-1.5 rounded-lg transition-colors ${
                                user.id === currentAuthProfile?.id
                                  ? 'text-stone-200 cursor-not-allowed'
                                  : 'text-stone-400 hover:text-rose-600 hover:bg-rose-50'
                              }`}
                              title="Demote User"
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
        </div>
      )}

      {/* 2. THEME CUSTOMIZER TAB */}
      {tab === 'theme' && (
        <div className="grid md:grid-cols-3 gap-6">
          
          {/* Left panel: Active and Preset cards */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Theme Presets Box */}
            <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-bold text-[#1A3C2E]">Branding Style Presets</h2>
                <p className="text-xs text-stone-400 mt-0.5">Activate standard color profiles synced dynamically across all student portals.</p>
              </div>

              {loadingThemes ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-[#F5B400] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {themes.map(theme => (
                    <div
                      key={theme.id}
                      onClick={() => handleApplyTheme(theme)}
                      className={`cursor-pointer rounded-xl border p-4 transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-28 hover:shadow-md ${
                        theme.is_active
                          ? 'border-2 border-[#F5B400] ring-2 ring-[#F5B400]/10 bg-amber-50/5'
                          : 'border-stone-200 bg-white hover:border-[#1A3C2E]/30'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-xs text-stone-800">{theme.preset_name}</h3>
                          <p className="text-[10px] text-stone-400 font-mono mt-0.5 uppercase tracking-wider">{theme.is_active ? 'Active Globally' : 'Click to apply'}</p>
                        </div>
                        {theme.is_active && (
                          <span className="bg-[#F5B400]/20 text-[#B38600] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>
                        )}
                      </div>

                      {/* Visual Color swatches */}
                      <div className="flex gap-2.5 mt-4">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-stone-500 font-mono">
                          <span className="w-4 h-4 rounded-full border border-stone-200 inline-block shadow-xs" style={{ backgroundColor: theme.primary_color }} />
                          Primary
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-stone-500 font-mono">
                          <span className="w-4 h-4 rounded-full border border-stone-200 inline-block shadow-xs" style={{ backgroundColor: theme.accent_color }} />
                          Accent
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-stone-500 font-mono">
                          <span className="w-4 h-4 rounded-full border border-stone-200 inline-block shadow-xs" style={{ backgroundColor: theme.canvas_color }} />
                          Canvas
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Live Custom Picker */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-[#1A3C2E] flex items-center gap-2">
                  <Paintbrush size={18} className="text-[#F5B400]" />
                  Custom Color Palette
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">Edit custom brand configurations directly.</p>
              </div>

              {/* Color pickers */}
              <div className="space-y-3 font-sans">
                <div>
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1.5">Primary Branding Green</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={customPrimary}
                      onChange={(e) => setCustomPrimary(e.target.value)}
                      className="w-10 h-10 border border-stone-200 rounded-lg cursor-pointer bg-white"
                    />
                    <input
                      type="text"
                      value={customPrimary}
                      onChange={(e) => setCustomPrimary(e.target.value)}
                      className="flex-1 border border-stone-200 rounded-lg px-3 text-sm font-mono outline-none uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1.5">Accent Branding Gold</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={customAccent}
                      onChange={(e) => setCustomAccent(e.target.value)}
                      className="w-10 h-10 border border-stone-200 rounded-lg cursor-pointer bg-white"
                    />
                    <input
                      type="text"
                      value={customAccent}
                      onChange={(e) => setCustomAccent(e.target.value)}
                      className="flex-1 border border-stone-200 rounded-lg px-3 text-sm font-mono outline-none uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1.5">Background Canvas Cream</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={customCanvas}
                      onChange={(e) => setCustomCanvas(e.target.value)}
                      className="w-10 h-10 border border-stone-200 rounded-lg cursor-pointer bg-white"
                    />
                    <input
                      type="text"
                      value={customCanvas}
                      onChange={(e) => setCustomCanvas(e.target.value)}
                      className="flex-1 border border-stone-200 rounded-lg px-3 text-sm font-mono outline-none uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100 flex flex-col gap-2 mt-4">
              <button
                onClick={handleSaveCustomTheme}
                className="w-full bg-[#1A3C2E] hover:bg-[#1A3C2E]/90 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider transition-colors shadow-xs"
              >
                Apply Custom Palette
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleResetThemeDefaults}
                  className="flex-1 bg-stone-50 border border-stone-200 hover:bg-stone-100 text-stone-600 font-bold py-2 rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCcw size={11} /> Reset fields
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* MODAL: PROMOTE USER */}
      {showPromoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
          <div className="absolute inset-0" onClick={() => setShowPromoteModal(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl border border-stone-200 animate-scale-up">
            <div className="bg-[#1A3C2E] px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-sans font-black text-base flex items-center gap-2">
                <Shield size={18} className="text-[#F5B400]" /> Promote User to Staff
              </h3>
              <button onClick={() => setShowPromoteModal(false)} className="text-white/80 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePromoteSubmit} className="p-6 space-y-4">
              {/* Search user list field */}
              {!promotingUser ? (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block">1. Select Student Profile</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={15} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search students by name or email..."
                      className="w-full bg-white border border-stone-200 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-[#F5B400] transition-colors"
                    />
                  </div>

                  <div className="border border-stone-100 rounded-lg max-h-40 overflow-y-auto divide-y divide-stone-50">
                    {filteredStudents.length === 0 ? (
                      <p className="p-4 text-xs text-stone-400 text-center">No student accounts found</p>
                    ) : (
                      filteredStudents.map(student => (
                        <div
                          key={student.id}
                          onClick={() => setPromotingUser(student)}
                          className="p-3 text-xs flex items-center justify-between hover:bg-stone-50 cursor-pointer transition-colors"
                        >
                          <div>
                            <span className="font-bold text-stone-700 block">{student.full_name || 'Anonymous User'}</span>
                            <span className="text-stone-400 font-mono text-[10px]">{student.email}</span>
                          </div>
                          <span className="text-[10px] font-bold text-[#1A3C2E] bg-[#1A3C2E]/5 px-2 py-0.5 rounded">Select</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 font-sans">
                  {/* Selected student status block */}
                  <div className="bg-[#FAF7EA] p-3 rounded-lg border border-[#1A3C2E]/10 flex items-center justify-between">
                    <div>
                      <span className="text-stone-400 text-[10px] uppercase tracking-wider block">Selected Student:</span>
                      <span className="font-bold text-[#1A3C2E] text-sm">{promotingUser.full_name || 'Anonymous Student'}</span>
                      <span className="text-stone-500 text-xs block font-mono">{promotingUser.email}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPromotingUser(null)}
                      className="text-stone-400 hover:text-stone-600 text-xs font-bold underline"
                    >
                      Change
                    </button>
                  </div>

                  {/* Role input select */}
                  <div>
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1.5">2. Choose Coordinator Role</label>
                    <select
                      value={assigningRole}
                      onChange={(e) => setAssigningRole(e.target.value as UserRole)}
                      className="bg-white border border-stone-200 text-stone-700 text-sm rounded-lg p-2.5 w-full focus:ring-1 focus:ring-[#F5B400] focus:border-[#F5B400] outline-none"
                    >
                      {Object.keys(ROLE_LABELS).filter(r => r !== 'student' && r !== 'comm_photobooth').map(roleKey => (
                        <option key={roleKey} value={roleKey}>
                          {ROLE_LABELS[roleKey as UserRole]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Position text input */}
                  <div>
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1.5">3. Position Title</label>
                    <input
                      type="text"
                      value={assigningPosition}
                      onChange={(e) => setAssigningPosition(e.target.value)}
                      placeholder="e.g. Lead Developer, Publicity Head, Executive Chairperson"
                      className="bg-white border border-stone-200 text-stone-700 text-sm rounded-lg p-2.5 w-full focus:ring-1 focus:ring-[#F5B400] focus:border-[#F5B400] outline-none"
                      required
                    />
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPromotingUser(null)}
                      className="px-4 py-2 rounded-lg text-xs font-bold bg-stone-50 text-stone-500 hover:bg-stone-100"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-lg text-xs font-bold bg-[#1A3C2E] text-white hover:bg-[#1A3C2E]/90 flex items-center gap-1.5"
                    >
                      <UserCheck size={14} /> Promote to Staff
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ROLE */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
          <div className="absolute inset-0" onClick={() => setEditingUser(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl border border-stone-200 animate-scale-up">
            <div className="bg-[#1A3C2E] px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-sans font-black text-base flex items-center gap-2">
                <Shield size={18} className="text-[#F5B400]" /> Modify Credentials
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-white/80 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditRoleSubmit} className="p-6 space-y-4">
              <div>
                <span className="text-stone-400 text-[10px] uppercase tracking-wider block">Staff Member:</span>
                <span className="font-bold text-[#1A3C2E] text-base">{editingUser.full_name || 'Coordinator'}</span>
                <span className="text-stone-500 text-xs block font-mono">{editingUser.email}</span>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1.5">Coordinator Role</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                  disabled={editingUser.id === currentAuthProfile?.id}
                  className="bg-white border border-stone-200 text-stone-700 text-sm rounded-lg p-2.5 w-full focus:ring-1 focus:ring-[#F5B400] focus:border-[#F5B400] outline-none disabled:bg-stone-50 disabled:text-stone-400"
                >
                  {Object.keys(ROLE_LABELS).filter(r => r !== 'student' && r !== 'comm_photobooth').map(roleKey => (
                    <option key={roleKey} value={roleKey}>
                      {ROLE_LABELS[roleKey as UserRole]}
                    </option>
                  ))}
                </select>
                {editingUser.id === currentAuthProfile?.id && (
                  <span className="text-[10px] text-amber-600 block mt-1.5">Note: You cannot change your own role to prevent lockout.</span>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1.5">Position Title</label>
                <input
                  type="text"
                  value={editingUser.position || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, position: e.target.value })}
                  placeholder="e.g. Lead Developer"
                  className="bg-white border border-stone-200 text-stone-700 text-sm rounded-lg p-2.5 w-full focus:ring-1 focus:ring-[#F5B400] focus:border-[#F5B400] outline-none"
                  required
                />
              </div>

              <div className="pt-3 border-t border-stone-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-stone-50 text-stone-500 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-[#1A3C2E] text-white hover:bg-[#1A3C2E]/90"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}