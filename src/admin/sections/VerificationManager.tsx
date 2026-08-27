import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, XCircle, Search, Clock, ShieldAlert, FileText, Send, UserCheck, UserX, AlertCircle
} from 'lucide-react';
import { useAdmin } from '../AdminContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Profile } from '../../types/database';
// Email HTML is now generated server-side by admin RPCs
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';

export default function VerificationManager() {
  const { showToast } = useAdmin();
  const { profile: currentAdmin } = useAuth();

  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Rejection modal state
  const [rejectingUser, setRejectingUser] = useState<Profile | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectSubmitLoading, setRejectSubmitLoading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 10;

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchPendingUsers = async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * PAGE_SIZE;
      const { data, error } = await supabase.rpc('list_pending_verifications', {
        p_search: debouncedSearch.trim() || null,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      });

      if (error) throw error;

      const result = data as { rows?: Profile[]; total?: number } | null;
      const rows = result?.rows || [];
      const count = Number(result?.total || 0);
      setPendingUsers(rows);
      setTotalCount(count);
      setTotalPages(Math.max(1, Math.ceil(count / PAGE_SIZE)));
    } catch (err: any) {
      showToast('Failed to load pending verifications: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingUsers();
  }, [currentPage, debouncedSearch]);

  const handleApprove = async (user: Profile) => {
    if (!currentAdmin) return;
    setActionLoadingId(user.id);
    try {
      // WARNING 12: Use server-side RPC that checks caller role from DB
      // (not stale JWT claims) and handles email queueing with HTML escaping
      const { data, error: rpcError } = await supabase.rpc('admin_approve_user', {
        p_user_id: user.id
      });

      if (rpcError) throw rpcError;

      const result = data as { approved: boolean; email_queued: boolean } | null;
      if (result?.email_queued) {
        showToast(`Approved ${user.full_name || user.email} successfully! Email notification queued.`, 'success');
      } else {
        showToast(`Approved ${user.full_name || user.email}. Email notification could not be queued.`, 'warning');
      }

      // Remove from view list
      setPendingUsers(prev => prev.filter(u => u.id !== user.id));
      setTotalCount(prev => Math.max(0, prev - 1));
      window.dispatchEvent(new Event('admin-verification-count-changed'));
    } catch (err: any) {
      showToast('Approval action failed: ' + err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectClick = (user: Profile) => {
    setRejectingUser(user);
    setRejectionReason('');
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingUser || !rejectionReason.trim()) return;

    setRejectSubmitLoading(true);
    try {
      // WARNING 12: Use server-side RPC that checks caller role from DB
      // and HTML-escapes the rejection reason
      const { data, error: rpcError } = await supabase.rpc('admin_reject_user', {
        p_user_id: rejectingUser.id,
        p_reason: rejectionReason.trim()
      });

      if (rpcError) throw rpcError;

      const result = data as { rejected: boolean; email_queued: boolean } | null;
      if (result?.email_queued) {
        showToast(`Rejected submission for ${rejectingUser.full_name || rejectingUser.email}. Email notification queued.`, 'success');
      } else {
        showToast(`Rejected ${rejectingUser.full_name || rejectingUser.email}. Email notification could not be queued.`, 'warning');
      }

      // Remove from view list
      setPendingUsers(prev => prev.filter(u => u.id !== rejectingUser.id));
      setTotalCount(prev => Math.max(0, prev - 1));
      window.dispatchEvent(new Event('admin-verification-count-changed'));
      setRejectingUser(null);
    } catch (err: any) {
      showToast('Rejection action failed: ' + err.message, 'error');
    } finally {
      setRejectSubmitLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-sans font-black text-stone-900 tracking-tight">
            Pending Verifications
          </h2>
          <p className="text-stone-500 text-xs mt-0.5">
            Review and manage student registration requests and Certificate of Registration approvals.
          </p>
        </div>
      </div>

      {/* Search Filter */}
      <div className="bg-white border border-stone-200/80 rounded-2xl p-4 flex items-center shadow-xs">
        <Search size={18} className="text-stone-400 mr-3 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by student name, email, or student number..."
          className="w-full bg-transparent border-none outline-none text-sm text-stone-800 placeholder-stone-400"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="text-stone-400 hover:text-stone-600 font-bold text-xs"
          >
            Clear
          </button>
        )}
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="bg-white border border-stone-200/80 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-8 h-8 border-3 border-[#F5B400] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-stone-500 text-xs">Loading pending verification requests...</p>
        </div>
      ) : pendingUsers.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="All Caught Up!"
          description={debouncedSearch ? "No pending registrations match your search filter." : "There are currently no pending student verifications to review."}
        />
      ) : (
        <div className="bg-white border border-stone-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50/70 border-b border-stone-200/80 text-[10px] font-mono text-stone-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Student Info</th>
                  <th className="px-6 py-4">Academic Details</th>
                  <th className="px-6 py-4">Contact Info</th>
                  <th className="px-6 py-4">Date Submitted</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-150 text-stone-700">
                {pendingUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-sm text-stone-900">{user.full_name || 'N/A'}</div>
                      <div className="text-[11px] text-stone-400 font-mono mt-0.5">{user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-semibold text-stone-800">
                        {user.program} — Year {user.year_level}
                      </div>
                      <div className="text-[11px] text-stone-400 mt-0.5">
                        Section: <span className="font-mono text-stone-600 font-bold">{user.section}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-mono">{user.student_number || 'N/A'}</div>
                      <div className="text-[11px] text-stone-500 mt-0.5">{user.contact_number || 'No contact number'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs flex items-center gap-1 text-stone-600">
                        <Clock size={12} className="text-stone-400" />
                        {new Date(user.submitted_at || user.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleApprove(user)}
                        disabled={actionLoadingId !== null}
                        className="inline-flex items-center gap-1 bg-[#1A3C2E]/10 hover:bg-[#1A3C2E] hover:text-white text-[#1A3C2E] px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <UserCheck size={14} />
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectClick(user)}
                        disabled={actionLoadingId !== null}
                        className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <UserX size={14} />
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="p-4 border-t border-stone-150">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans animate-fade-in">
          <div className="absolute inset-0 cursor-pointer" onClick={() => setRejectingUser(null)} />
          <div className="relative w-full max-w-md bg-white border border-stone-200 rounded-2xl shadow-2xl p-6 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-stone-150 pb-3">
              <h3 className="font-sans font-black text-lg text-stone-900 flex items-center gap-2">
                <AlertCircle className="text-rose-500" size={20} />
                Reject Verification
              </h3>
              <button 
                onClick={() => setRejectingUser(null)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <XCircle size={20} />
              </button>
            </div>
            
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <p className="text-xs text-stone-500 leading-normal mb-3">
                  Please specify the reason for declining the registration of <strong>{rejectingUser.full_name || rejectingUser.email}</strong>. This reason will be emailed to the student and their profile form will be unlocked so they can correct it.
                </p>
                <label className="block text-stone-700 text-xs font-bold uppercase tracking-wider mb-2">
                  Rejection Reason
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  placeholder="e.g. The student number K12345678 does not match the format on your COR, or the uploaded COR file is unreadable."
                  className="w-full bg-stone-50 border border-stone-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder-stone-400 outline-none transition-all resize-none"
                  required
                />
              </div>

              <div className="flex gap-3 justify-end border-t border-stone-150 pt-3">
                <button
                  type="button"
                  onClick={() => setRejectingUser(null)}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectSubmitLoading || !rejectionReason.trim()}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {rejectSubmitLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <Send size={12} />
                      Send &amp; Reject
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
