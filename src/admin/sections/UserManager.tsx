import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, Ban, ShieldAlert, CheckCircle, Unlock, Lock, Trash2, 
  Clock, X, Shield, AlertTriangle 
} from 'lucide-react';
import { useAdmin } from '../AdminContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Profile, ROLE_LABELS, ROLE_COLORS } from '../../types/database';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { postgrestIlike } from '../../lib/postgrest';

type BanDuration = 'permanent' | '1h' | '1d' | '1w' | '30d' | 'custom';

function checkUserBanStatus(user: Profile): { isBanned: boolean; text: string; subtext?: string } {
  if (!user.banned) return { isBanned: false, text: 'Active' };

  if (!user.banned_until) {
    return { isBanned: true, text: 'Banned', subtext: 'Permanent' };
  }

  const expireTime = new Date(user.banned_until);
  if (expireTime > new Date()) {
    return {
      isBanned: true,
      text: 'Suspended',
      subtext: `Until ${expireTime.toLocaleString()}`
    };
  }

  return { isBanned: false, text: 'Active', subtext: 'Ban Expired' };
}

export default function UserManager() {
  const { showToast } = useAdmin();
  const { profile: currentAdmin } = useAuth();

  // User list state
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;

  // Modals / Action States
  const [banningUser, setBanningUser] = useState<Profile | null>(null);
  const [banDuration, setBanDuration] = useState<BanDuration>('permanent');
  const [customBanTime, setCustomBanTime] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [purgingAnon, setPurgingAnon] = useState(false);


  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to first page on search change
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch users with search and pagination filters
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' });

      // Apply search term filtering across name, email, or student number
      if (debouncedSearch.trim()) {
        const searchFilter = postgrestIlike(debouncedSearch);
        query = query.or(
          `full_name.ilike.${searchFilter},email.ilike.${searchFilter},student_number.ilike.${searchFilter}`
        );
      }

      // Order by full_name, fallback to email
      const { data, count, error } = await query
        .order('full_name', { nullsFirst: false })
        .range(from, to);

      if (error) throw error;

      if (data) {
        setUsers(data as Profile[]);
        setTotalCount(count || 0);
        setTotalPages(Math.ceil((count || 0) / PAGE_SIZE));
      }
    } catch (err: any) {
      showToast('Failed to load user profiles: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Toggle Profile complete status (Unlock student profile for editing)
  const handleToggleProfileLock = async (user: Profile) => {
    setActionLoadingId(user.id);
    try {
      const newStatus = !user.profile_complete;
      const { error } = await supabase
        .rpc('admin_set_profile_completion', {
          p_user_id: user.id,
          p_profile_complete: newStatus,
        });

      if (error) throw error;

      setUsers(prev =>
        prev.map(u => (u.id === user.id ? { ...u, profile_complete: newStatus } : u))
      );
      showToast(
        newStatus 
          ? `Locked profile for ${user.full_name || user.email}` 
          : `Unlocked profile (allowed updates) for ${user.full_name || user.email}`, 
        'success'
      );
    } catch (err: any) {
      showToast('Action failed: ' + err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Perform permanent or timed ban
  const handleBanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banningUser) return;

    setActionLoadingId(banningUser.id);
    try {
      let bannedUntilISO: string | null = null;
      const now = new Date();

      if (banDuration !== 'permanent') {
        let expireDate = new Date();
        if (banDuration === '1h') {
          expireDate.setHours(now.getHours() + 1);
        } else if (banDuration === '1d') {
          expireDate.setDate(now.getDate() + 1);
        } else if (banDuration === '1w') {
          expireDate.setDate(now.getDate() + 7);
        } else if (banDuration === '30d') {
          expireDate.setDate(now.getDate() + 30);
        } else if (banDuration === 'custom') {
          if (!customBanTime) {
            showToast('Please specify a custom date and time.', 'warning');
            setActionLoadingId(null);
            return;
          }
          expireDate = new Date(customBanTime);
          if (expireDate <= now) {
            showToast('Ban timeout must be set to a future date.', 'warning');
            setActionLoadingId(null);
            return;
          }
        }
        bannedUntilISO = expireDate.toISOString();
      }

      const { error } = await supabase
        .rpc('admin_set_profile_ban', {
          p_user_id: banningUser.id,
          p_banned: true,
          p_banned_until: bannedUntilISO,
        });

      if (error) throw error;

      setUsers(prev =>
        prev.map(u => 
          u.id === banningUser.id 
            ? { ...u, banned: true, banned_until: bannedUntilISO } 
            : u
        )
      );
      
      const durationMsg = bannedUntilISO 
        ? `temporarily banned until ${new Date(bannedUntilISO).toLocaleString()}`
        : 'permanently restricted';

      showToast(`Successfully banned ${banningUser.full_name || banningUser.email} (${durationMsg})`, 'success');
      setBanningUser(null);
      setBanDuration('permanent');
      setCustomBanTime('');
    } catch (err: any) {
      showToast('Banning operation failed: ' + err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Lift ban status
  const handleUnban = async (user: Profile) => {
    setActionLoadingId(user.id);
    try {
      const { error } = await supabase
        .rpc('admin_set_profile_ban', {
          p_user_id: user.id,
          p_banned: false,
          p_banned_until: null,
        });

      if (error) throw error;

      setUsers(prev =>
        prev.map(u => 
          u.id === user.id 
            ? { ...u, banned: false, banned_until: null } 
            : u
        )
      );
      showToast(`Lifted restriction for ${user.full_name || user.email}`, 'success');
    } catch (err: any) {
      showToast('Unban failed: ' + err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };


  // Permanently delete user data (cascades to event registrations, messages, concerns)
  const handleDeleteUser = async (user: Profile) => {
    if (currentAdmin?.role !== 'devcom_head') {
      showToast('Only the DevCom Head can permanently delete accounts.', 'warning');
      return;
    }

    if (user.id === currentAdmin?.id) {
      showToast('Safety guard: You cannot delete your own profile.', 'warning');
      return;
    }

    const confirmMsg = `Are you sure you want to permanently delete data for ${user.full_name || user.email}?` + 
      `\n\nWARNING: This will completely purge their profile, event tickets, photobooth gallery items, and direct messages. This cannot be undone.`;
    
    if (!confirm(confirmMsg)) return;

    setActionLoadingId(user.id);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: user.id },
      });

      if (error || !data?.deleted) throw error || new Error('Account deletion was not confirmed.');

      showToast(`Permanently deleted student profile for ${user.full_name || user.email}`, 'info');
      setUsers(prev => prev.filter(u => u.id !== user.id));
      setTotalCount(prev => prev - 1);
    } catch (err: any) {
      console.error('Account deletion failed:', err);
      showToast('Account deletion failed. Please retry or contact a system administrator.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Clean purge of all load test and dummy accounts
  const handlePurgeAnonymous = async () => {
    if (currentAdmin?.role !== 'devcom_head') {
      showToast('Only the DevCom Head can purge accounts.', 'warning');
      return;
    }

    if (!confirm('Are you sure you want to permanently delete all load test accounts (loadtest001-982) and dummy users from the database?\n\nThis will completely purge their auth logins, profiles, and associated records.')) return;
    setPurgingAnon(true);
    try {
      const { data: targets, error: targetError } = await supabase.rpc('list_loadtest_account_ids');
      if (targetError) throw targetError;
      const targetIds = new Set((targets || []).map((target: { user_id: string }) => target.user_id));

      await Promise.all([...targetIds].map(async userId => {
        const { data, error } = await supabase.functions.invoke('delete-user', {
          body: { userId },
        });
        if (error || !data?.deleted) throw error || new Error(`Account purge failed for ${userId}.`);
      }));

      showToast(`Clean deletion complete: Purged ${targetIds.size} accounts.`, 'success');
      fetchUsers();
    } catch (err: any) {
      console.error('Account purge failed:', err);
      showToast('Account purge failed. Please retry or contact a system administrator.', 'error');
      fetchUsers();
    } finally {
      setPurgingAnon(false);
    }
  };

  return (
    <div className="space-y-6 font-sans animate-fade-in">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl font-black text-[#1A3C2E]">User Management Directory</h1>
        <p className="text-stone-500 text-sm">
          Search registered students, toggle profile setup edit access, manage temporary/permanent bans, and delete user profiles.
        </p>
      </div>

      {/* Search and Metadata Panel */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white px-5 py-4 rounded-xl border border-zinc-200 shadow-sm w-full">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
          <input
            type="text"
            aria-label="Search user profiles"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search students by name, email, or student ID..."
            className="w-full bg-white border border-stone-200 rounded-lg pl-10 pr-4 py-2.5 text-xs outline-none focus:border-[#F5B400] transition-colors"
          />
          {searchQuery && (
             <button
               type="button"
               aria-label="Clear user profile search"
               onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handlePurgeAnonymous}
            disabled={purgingAnon}
            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shadow-2xs"
            title="Purge all loadtest001-982 accounts and dummy users"
          >
            <Trash2 size={13} />
            {purgingAnon ? 'Purging...' : 'Purge Load Test Users'}
          </button>
          
          <div className="flex-shrink-0 text-xs font-mono font-bold text-[#1A3C2E] bg-[#1A3C2E]/5 px-3 py-1.5 rounded-full">
            {totalCount} Total Accounts Found
          </div>
        </div>
      </div>

      {/* User Table Grid */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-20 flex flex-col items-center justify-center shadow-sm">
          <div className="w-8 h-8 border-3 border-[#F5B400] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-stone-400 font-mono text-xs uppercase tracking-wider">Loading student database...</p>
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No users found"
          description="We couldn't find any profiles matching your search criteria."
        />
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-stone-50 border-b border-stone-100 text-stone-500 font-mono text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 font-bold">User Details</th>
                  <th className="px-4 py-3 font-bold">Program & Section</th>
                  <th className="px-4 py-3 font-bold">System Role</th>
                  <th className="px-4 py-3 font-bold">Profile Edit</th>
                  <th className="px-4 py-3 font-bold">Access Status</th>
                  <th className="px-5 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {users.map(user => {
                  const banStatus = checkUserBanStatus(user);
                  const isSelf = user.id === currentAdmin?.id;
                  const isLoading = actionLoadingId === user.id;

                  return (
                    <tr key={user.id} className="hover:bg-zinc-50/50 transition-colors">
                      {/* User Info Column */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#1A3C2E] text-[#FAF7EA] flex-shrink-0 flex items-center justify-center font-bold text-xs">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              (user.full_name || 'Admin').split(' ').slice(0, 2).map(n => n[0]).join('')
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-stone-800 block truncate text-xs md:text-sm">
                              {user.full_name || 'Anonymous User'}
                            </span>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 text-[10px] text-stone-500 mt-0.5">
                              <span className="font-mono">{user.email}</span>
                              {user.student_number && (
                                <>
                                  <span className="hidden sm:inline text-stone-300">•</span>
                                  <span className="font-mono font-semibold text-[#1A3C2E] bg-stone-100 px-1.5 py-0.2 rounded">
                                    {user.student_number}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Program & Section Column */}
                      <td className="px-4 py-4 text-xs">
                        {user.program ? (
                          <div>
                            <span className="font-semibold text-stone-700">{user.program}</span>
                            <span className="block text-[10px] text-stone-400 font-mono mt-0.5">
                              Section: {user.section || 'N/A'} • Yr {user.year_level || 'N/A'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-stone-400 italic">Not set (Onboarding pending)</span>
                        )}
                      </td>

                      {/* System Role Column */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${ROLE_COLORS[user.role]}`}>
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                        {isSelf && (
                          <span className="text-[9px] font-bold text-[#F5B400] bg-[#F5B400]/10 border border-[#F5B400]/20 px-1.5 py-0.2 rounded ml-1.5 inline-block">
                            You
                          </span>
                        )}
                      </td>

                      {/* Profile Lock State Column */}
                      <td className="px-4 py-4">
                        {user.profile_complete ? (
                          <div className="flex items-center gap-1.5 text-[#1A3C2E] font-semibold text-xs">
                            <Lock size={12} className="text-[#1A3C2E]/60" />
                            <span>Locked</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-600 font-semibold text-xs">
                            <Unlock size={12} className="text-amber-500" />
                            <span>Unlocked (Editable)</span>
                          </div>
                        )}
                      </td>

                      {/* Access Status Column */}
                      <td className="px-4 py-4">
                        {banStatus.isBanned ? (
                          <div>
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                              <Ban size={9} /> {banStatus.text}
                            </span>
                            {banStatus.subtext && (
                              <span className="block text-[8px] text-rose-500 font-mono mt-0.5 max-w-[140px] truncate" title={banStatus.subtext}>
                                {banStatus.subtext}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                              <CheckCircle size={9} /> {banStatus.text}
                            </span>
                            {banStatus.subtext && (
                              <span className="block text-[8px] text-stone-400 font-mono mt-0.5">
                                {banStatus.subtext}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Action Triggers Column */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Profile Lock Action */}
          <button
            type="button"
            aria-label={user.profile_complete ? 'Unlock profile' : 'Lock profile'}
            onClick={() => handleToggleProfileLock(user)}
                            disabled={isLoading}
                            className={`p-1.5 rounded-lg text-stone-400 hover:text-[#1A3C2E] hover:bg-stone-100 transition-colors ${
                              isLoading ? 'opacity-40 cursor-not-allowed' : ''
                            }`}
                            title={user.profile_complete ? 'Unlock Profile (Allow Updates)' : 'Lock Profile (Prevent Updates)'}
                          >
                            {user.profile_complete ? <Unlock size={14} /> : <Lock size={14} />}
                          </button>

                          {/* Ban / Unban Toggle Action */}
                          {banStatus.isBanned ? (
                            <button
                              type="button"
                              aria-label="Unban student"
                              onClick={() => handleUnban(user)}
                              disabled={isLoading || isSelf}
                              className={`p-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 transition-colors ${
                                isSelf ? 'opacity-30 cursor-not-allowed' : ''
                              }`}
                              title="Unban Student"
                            >
                              <CheckCircle size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              aria-label={isSelf ? 'You cannot ban yourself' : 'Restrict or ban user'}
                              onClick={() => setBanningUser(user)}
                              disabled={isLoading || isSelf}
                              className={`p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ${
                                isSelf ? 'opacity-30 cursor-not-allowed font-medium' : ''
                              }`}
                              title={isSelf ? 'You cannot ban yourself' : 'Restrict/Ban User'}
                            >
                              <Ban size={14} />
                            </button>
                          )}


                          {/* Delete Action */}
                          <button
                            type="button"
                            aria-label={isSelf ? 'You cannot delete yourself' : 'Delete profile and data'}
                            onClick={() => handleDeleteUser(user)}
                            disabled={isLoading || isSelf}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isSelf || isLoading
                                ? 'text-stone-200 cursor-not-allowed'
                                : 'text-stone-400 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                            title={isSelf ? 'You cannot delete yourself' : 'Delete Profile & Clean Cascading Data'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="border-t border-zinc-100 p-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(p) => setCurrentPage(p)}
              />
            </div>
          )}
        </div>
      )}

      {/* BAN TIMEOUT SETUP MODAL */}
      {banningUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
              <button type="button" aria-label="Close ban dialog" className="absolute inset-0" onClick={() => setBanningUser(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl border border-stone-200 animate-scale-up">
            <div className="bg-[#1A3C2E] px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-sans font-black text-base flex items-center gap-2">
                <ShieldAlert size={18} className="text-[#F5B400]" /> Configure Ban Restriction
              </h3>
              <button type="button" onClick={() => setBanningUser(null)} aria-label="Close ban dialog" className="text-white/80 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBanSubmit} className="p-6 space-y-4">
              {/* Selected User Info */}
              <div className="bg-[#FAF7EA] p-3.5 rounded-lg border border-[#1A3C2E]/10 space-y-0.5">
                <span className="text-stone-400 text-[10px] uppercase tracking-wider block">Banning Student Account:</span>
                <span className="font-bold text-[#1A3C2E] text-sm block">{banningUser.full_name || 'Anonymous User'}</span>
                <span className="text-stone-500 text-xs font-mono block">{banningUser.email}</span>
              </div>

              {/* Ban Duration Select */}
              <div className="space-y-1.5">
                 <label htmlFor="ban-duration" className="text-xs font-bold text-stone-500 uppercase tracking-wider block">
                  Select Ban Duration
                </label>
                <select
                   id="ban-duration"
                   value={banDuration}
                  onChange={(e) => setBanDuration(e.target.value as BanDuration)}
                  className="bg-white border border-stone-200 text-stone-700 text-sm rounded-lg p-2.5 w-full focus:ring-1 focus:ring-[#F5B400] focus:border-[#F5B400] outline-none"
                >
                  <option value="permanent">Permanent Restriction (Manual Unban)</option>
                  <option value="1h">1 Hour Suspension</option>
                  <option value="1d">1 Day Suspension</option>
                  <option value="1w">1 Week Suspension</option>
                  <option value="30d">30 Days Suspension</option>
                  <option value="custom">Custom Date &amp; Time Timeout</option>
                </select>
              </div>

              {/* Custom Date Input */}
              {banDuration === 'custom' && (
                <div className="space-y-1.5 animate-fade-in">
                   <label htmlFor="custom-ban-time" className="text-xs font-bold text-stone-500 uppercase tracking-wider block">
                    Unban Date &amp; Time
                  </label>
                  <input
                     id="custom-ban-time"
                     type="datetime-local"
                    value={customBanTime}
                    onChange={(e) => setCustomBanTime(e.target.value)}
                    className="bg-white border border-stone-200 text-stone-700 text-sm rounded-lg p-2.5 w-full focus:ring-1 focus:ring-[#F5B400] focus:border-[#F5B400] outline-none"
                    required
                  />
                  <span className="text-[10px] text-stone-400 block leading-tight">
                    Select the exact local date/time when this restriction will expire automatically.
                  </span>
                </div>
              )}

              {/* Danger Warning Alert */}
              <div className="flex gap-2 p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-700 text-xs mt-2">
                <AlertTriangle size={16} className="shrink-0 text-rose-500 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Access Suspension:</strong> Once applied, this student will be force-logged out of all active portal sessions immediately and blocked from logging back in.
                </div>
              </div>

              {/* Modal buttons */}
              <div className="pt-3 border-t border-stone-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBanningUser(null)}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-stone-50 text-stone-500 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-[#C0392B] text-white hover:bg-rose-700 flex items-center gap-1.5 shadow-sm"
                >
                  <Ban size={14} /> Ban Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
