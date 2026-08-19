import React, { useState, useEffect } from 'react';
import { Search, Download, ClipboardList, Eye, CheckCircle, Trash } from 'lucide-react';
import { useAdmin } from '../AdminContext';
import { supabase } from '../../lib/supabase';
import { EventRegistration, EventItem } from '../../types/database';
import StatusBadge, { getRegistrationBadge } from '../components/StatusBadge';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { postgrestIlike } from '../../lib/postgrest';

export default function RegistrationManager() {
  const { showToast } = useAdmin();
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('ALL');
  const [selectedReg, setSelectedReg] = useState<EventRegistration | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  // Stats states
  const [stats, setStats] = useState({ total: 0, confirmed: 0, pending: 0, attended: 0, cancelled: 0 });

  const fetchData = async () => {
    setLoading(true);

    try {
      // 1. Fetch events list once
      if (events.length === 0) {
        const { data: eventsData } = await supabase.from('events').select('id, title').order('event_date');
        if (eventsData) setEvents(eventsData as EventItem[]);
      }

      // 2. Fetch matching set for statistics & pagination counts
      let totalQuery;
      if (search.trim()) {
        const searchFilter = postgrestIlike(search);
        totalQuery = supabase
          .from('event_registrations')
          .select('id, status, profiles!inner(full_name, email)')
          .or(`full_name.ilike.${searchFilter},email.ilike.${searchFilter}`, { referencedTable: 'profiles' });
      } else {
        totalQuery = supabase
          .from('event_registrations')
          .select('id, status');
      }

      if (eventFilter !== 'ALL') {
        totalQuery = totalQuery.eq('event_id', eventFilter);
      }

      const { data: allRegs, error: countErr } = await totalQuery;

      if (countErr) {
        console.error('Count query error:', countErr.message);
        showToast('Failed to load registration statistics', 'error');
        setLoading(false);
        return;
      }

      const totalMatched = allRegs?.length || 0;
      setTotalCount(totalMatched);
      setTotalPages(Math.max(1, Math.ceil(totalMatched / pageSize)));

      const confirmedCount = allRegs?.filter(r => r.status === 'confirmed').length || 0;
      const pendingCount = allRegs?.filter(r => r.status === 'pending').length || 0;
      const attendedCount = allRegs?.filter(r => r.status === 'attended').length || 0;
      const cancelledCount = allRegs?.filter(r => r.status === 'cancelled').length || 0;

      setStats({
        total: totalMatched,
        confirmed: confirmedCount,
        pending: pendingCount,
        attended: attendedCount,
        cancelled: cancelledCount,
      });

      // 3. Fetch paginated records for the current page
      let listQuery;
      if (search.trim()) {
        const searchFilter = postgrestIlike(search);
        listQuery = supabase
          .from('event_registrations')
          .select('*, profiles!inner(full_name, student_number, email, section), events(title, event_date, location)')
          .or(`full_name.ilike.${searchFilter},email.ilike.${searchFilter}`, { referencedTable: 'profiles' });
      } else {
        listQuery = supabase
          .from('event_registrations')
          .select('*, profiles(full_name, student_number, email, section), events(title, event_date, location)');
      }

      if (eventFilter !== 'ALL') {
        listQuery = listQuery.eq('event_id', eventFilter);
      }

      const offset = (page - 1) * pageSize;
      const { data: pageData, error: listErr } = await listQuery
        .order('registered_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (listErr) {
        console.error('List query error:', listErr.message);
        showToast('Failed to load registrations list', 'error');
      } else {
        setRegistrations((pageData as EventRegistration[]) || []);
      }
    } catch (err: any) {
      console.error(err);
      showToast('An unexpected error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, eventFilter, search]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleEventFilterChange = (val: string) => {
    setEventFilter(val);
    setPage(1);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === registrations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(registrations.map(r => r.id)));
    }
  };

  const markAttended = async () => {
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('event_registrations').update({ status: 'attended' }).in('id', ids);
    if (error) { showToast('Failed to update status', 'error'); return; }
    showToast(`${ids.length} registrants marked as attended`, 'success');
    setSelectedIds(new Set());
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this registration? This action cannot be undone.')) return;
    
    const { error } = await supabase
      .from('event_registrations')
      .delete()
      .eq('id', id);

    if (error) {
      showToast('Failed to delete registration: ' + error.message, 'error');
      return;
    }

    showToast('Registration deleted.', 'success');
    // Adjust page if we deleted the last item on a page
    if (registrations.length === 1 && page > 1) {
      setPage(prev => prev - 1);
    } else {
      fetchData();
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('WARNING: Are you sure you want to delete ALL registrations? This cannot be undone.')) return;
    const { error } = await supabase.from('event_registrations').delete().not('id', 'is', null);
    if (error) { showToast('Failed to delete all', 'error'); return; }
    showToast('All registrations deleted', 'success');
    setPage(1);
    fetchData();
  };

  const exportCsv = () => {
    const toExport = selectedIds.size > 0 ? registrations.filter(r => selectedIds.has(r.id)) : registrations;
    if (toExport.length === 0) {
      showToast('No registrations to export', 'warning');
      return;
    }
    const csvCell = (value: unknown) => {
      const text = String(value ?? '');
      const safeText = /^[\s\x00-\x1F\x7F\uFEFF]*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safeText.replace(/"/g, '""')}"`;
    };
    const csvRow = (values: unknown[]) => values.map(csvCell).join(',');
    const csv = [
      csvRow(['Name', 'Email', 'Student Number', 'Section', 'Event', 'Status', 'Registered At']),
      ...toExport.map(r => csvRow([
        r.profiles?.full_name,
        r.profiles?.email,
        r.profiles?.student_number,
        r.profiles?.section,
        r.events?.title,
        r.status === 'confirmed' || r.status === 'pending' ? 'Not Attended' : r.status === 'attended' ? 'Attended' : r.status,
        r.registered_at,
      ])),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'registrations.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported!', 'success');
  };

  // Recharts Pie Chart configuration
  const chartData = [
    { name: 'Not Attended', value: stats.confirmed + stats.pending, color: '#E0A100' },
    { name: 'Attended', value: stats.attended, color: '#0D9488' },
    { name: 'Cancelled', value: stats.cancelled, color: '#9CA3AF' }
  ].filter(d => d.value > 0);

  if (loading && registrations.length === 0) {
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
          <select value={eventFilter} onChange={(e) => handleEventFilterChange(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#F5B400] text-[#222B26] flex-1 sm:flex-initial">
            <option value="ALL">All Events</option>
            {events.map(ev => (<option key={ev.id} value={ev.id}>{ev.title}</option>))}
          </select>
          <button onClick={exportCsv}
            className="border border-[#2E7D32] text-[#2E7D32] hover:bg-[#2E7D32]/5 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer flex-1 sm:flex-initial justify-center">
            <Download size={14} /> Export CSV
          </button>
          {totalCount > 0 && (
            <button onClick={handleDeleteAll}
              className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer flex-1 sm:flex-initial justify-center">
              <Trash size={13} /> Delete All
            </button>
          )}
        </div>
        <div className="hidden md:block flex-1" />
        <div className="relative w-full md:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400] transition-colors" />
        </div>
      </div>

      {/* Stats Cards + Pie Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Stats Cards (8 columns) */}
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-[#1A3C2E]' },
            { label: 'Not Attended', value: stats.confirmed + stats.pending, color: 'text-[#E0A100]' },
            { label: 'Attended', value: stats.attended, color: 'text-[#0D9488]' },
            { label: 'Cancelled', value: stats.cancelled, color: 'text-gray-400' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 px-4 py-4 shadow-sm flex flex-col justify-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{s.label}</p>
              <p className={`font-black text-2xl mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Right Column: Donut Breakdown Chart (4 columns) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col items-start justify-center min-h-[120px]">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 w-full mb-1 text-left">Status Breakdown</h4>
          {stats.total === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center w-full">No records found</p>
          ) : (
            <div className="w-full h-24 min-h-0 min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={18}
                    outerRadius={32}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ fontSize: '10px', borderRadius: '8px', padding: '4px 8px' }} 
                    itemStyle={{ padding: 0 }}
                  />
                  <Legend 
                    verticalAlign="middle" 
                    align="right" 
                    layout="vertical"
                    iconSize={6}
                    wrapperStyle={{ fontSize: '9px', paddingLeft: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="bg-[#F5B400]/10 border border-[#F5B400]/20 rounded-lg px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 animate-fade-in w-full">
          <div className="flex items-center justify-between sm:justify-start gap-4">
            <span className="text-xs font-bold text-[#1A3C2E]">{selectedIds.size} selected</span>
            <button onClick={() => setSelectedIds(new Set())} className="sm:hidden text-xs text-gray-400 hover:text-gray-600 font-bold uppercase tracking-wider">Clear</button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={markAttended} className="text-xs font-bold text-[#2E7D32] hover:underline flex items-center gap-1 cursor-pointer">
              <CheckCircle size={13} /> Mark Attended
            </button>
            <button onClick={exportCsv} className="text-xs font-bold text-[#1A3C2E] hover:underline flex items-center gap-1 cursor-pointer">
              <Download size={13} /> Export Selected
            </button>
          </div>
          <button onClick={() => setSelectedIds(new Set())} className="hidden sm:block ml-auto text-xs text-gray-400 hover:text-gray-600 font-bold uppercase tracking-wider">Clear</button>
        </div>
      )}

      {/* Table */}
      {registrations.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No registrations found" description="Registrations will appear here when students sign up." />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={selectedIds.size === registrations.length && registrations.length > 0}
                        onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300 text-[#F5B400] focus:ring-[#F5B400] cursor-pointer" />
                    </th>
                    <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-gray-400">Name</th>
                    <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-gray-400">Email</th>
                    <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-gray-400">Section</th>
                    <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-gray-400">Event</th>
                    <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-gray-400">Status</th>
                    <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-gray-400">Registered</th>
                    <th className="text-right px-5 py-3 font-bold text-[10px] uppercase tracking-wider text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {registrations.map(reg => {
                    const badge = getRegistrationBadge(reg.status);
                    return (
                      <tr key={reg.id} className="hover:bg-[#1A3C2E]/[0.02] transition-colors cursor-pointer" onClick={() => setSelectedReg(reg)}>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(reg.id)} onChange={() => toggleSelect(reg.id)}
                            className="w-4 h-4 rounded border-gray-300 text-[#F5B400] focus:ring-[#F5B400] cursor-pointer" />
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#222B26]">{reg.profiles?.full_name || 'Student'}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{reg.profiles?.email || ''}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{reg.profiles?.section || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{reg.events?.title || 'Event'}</td>
                        <td className="px-4 py-3"><StatusBadge variant={badge.variant} label={badge.label} /></td>
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                          {new Date(reg.registered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-5 py-3 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setSelectedReg(reg)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#1A3C2E] hover:bg-gray-100 transition-colors" title="View Details">
                            <Eye size={14} />
                          </button>
                          <button onClick={() => handleDelete(reg.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete Registration">
                            <Trash size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dynamic pagination component */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p)}
          />
        </>
      )}

      {/* Detail slide-over */}
      {selectedReg && (
        <Modal isOpen={true} onClose={() => setSelectedReg(null)} title="Registration Details">
          <div className="space-y-4">
            {[
              { label: 'Name', value: selectedReg.profiles?.full_name || 'Student' },
              { label: 'Email', value: selectedReg.profiles?.email || '' },
              { label: 'Student Number', value: selectedReg.profiles?.student_number || '—' },
              { label: 'Section', value: selectedReg.profiles?.section || '—' },
              { label: 'Event', value: selectedReg.events?.title || 'Event' },
              { label: 'Event Date', value: selectedReg.events?.event_date || '' },
              { label: 'Registered At', value: new Date(selectedReg.registered_at).toLocaleString() },
              { label: 'Status', value: selectedReg.status === 'confirmed' || selectedReg.status === 'pending' ? 'Not Attended' : selectedReg.status === 'attended' ? 'Attended' : selectedReg.status },
            ].map(item => (
              <div key={item.label}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{item.label}</p>
                <p className="text-sm font-medium text-[#222B26]">{item.value}</p>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
