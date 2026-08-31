import React, { useState, useEffect } from 'react';
import { Megaphone, ClipboardList, MessageSquare, Calendar, Edit3, ArrowRight, HelpCircle } from 'lucide-react';
import { useAdmin } from '../AdminContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';

interface DashStats {
  announcementsTotal: number;
  announcementsPublished: number;
  registrationsTotal: number;
  registrationsPending: number;
  messagesTotal: number;
  messagesUnread: number;
  faqsActive: number;
  eventsUpcoming: number;
}

interface RecentAnnouncement {
  id: string;
  title: string;
  status: string;
  published_at: string | null;
  created_at: string;
  profiles: { full_name: string | null } | null;
}

interface RecentConversation {
  id: string;
  last_message_at: string;
  profiles: { full_name: string | null; email: string } | null;
  unread_count?: number;
}

interface UpcomingEvent {
  id: string;
  title: string;
  category: string;
  event_date: string;
}

export default function Dashboard() {
  const { setActiveSection } = useAdmin();
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashStats>({
    announcementsTotal: 0, announcementsPublished: 0,
    registrationsTotal: 0, registrationsPending: 0,
    messagesTotal: 0, messagesUnread: 0,
    faqsActive: 0, eventsUpcoming: 0,
  });
  const [recentAnnouncements, setRecentAnnouncements] = useState<RecentAnnouncement[]>([]);
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const hasMessageAccess = profile && ['devcom_head', 'officer'].includes(profile.role);

  useEffect(() => {
    let ignore = false;

    const fetchDashboard = async () => {
      const today = new Date().toISOString().split('T')[0];

      try {
        const [
          annTotal, annPublished,
          regTotal, regPending,
          faqActive, evtUpcoming,
          recentAnn, upEvts
        ] = await Promise.all([
          supabase.from('announcements').select('*', { count: 'exact', head: true }),
          supabase.from('announcements').select('*', { count: 'exact', head: true }).eq('status', 'published'),
          supabase.from('event_registrations').select('*', { count: 'exact', head: true }),
          supabase.from('event_registrations').select('*', { count: 'exact', head: true }).in('status', ['confirmed', 'pending']),
          supabase.from('faqs').select('*', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('events').select('*', { count: 'exact', head: true }).gte('event_date', today),
          supabase.from('announcements').select('id, title, status, published_at, created_at, profiles(full_name)').order('created_at', { ascending: false }).limit(5),
          supabase.from('events').select('id, title, category, event_date').gte('event_date', today).order('event_date').limit(3),
        ]);

        let msgTotalCount = 0;
        let msgUnreadCount = 0;
        let mappedCon: RecentConversation[] = [];

        if (hasMessageAccess) {
          const [msgTotal, msgUnread, recentConData, unreadCountsData] = await Promise.all([
            supabase.from('messages').select('*', { count: 'exact', head: true }),
            supabase.from('messages').select('*', { count: 'exact', head: true }).eq('read_by_admin', false).eq('sender_role', 'student'),
            supabase.from('conversations').select('id, last_message_at, profiles(full_name, email)').order('last_message_at', { ascending: false }).limit(5),
            supabase.rpc('get_dashboard_unread_counts'),
          ]);

          msgTotalCount = msgTotal.count || 0;
          msgUnreadCount = msgUnread.count || 0;

          if (recentConData.data) {
            const rawConList = recentConData.data as any[];
            const unreadByConversation = new Map<string, number>(
              (unreadCountsData.data || []).map((row: { conversation_id: string; unread_count: number }) => [
                row.conversation_id,
                Number(row.unread_count) || 0,
              ])
            );
            if (unreadCountsData.error) {
              console.error('Error fetching dashboard unread counts:', unreadCountsData.error.message);
            }

            mappedCon = rawConList.map((con) => {
              return {
                id: con.id,
                last_message_at: con.last_message_at,
                profiles: con.profiles,
                unread_count: unreadByConversation.get(con.id) || 0,
              };
            });
          }
        }

        if (ignore) return;

        setStats({
          announcementsTotal: annTotal.count || 0,
          announcementsPublished: annPublished.count || 0,
          registrationsTotal: regTotal.count || 0,
          registrationsPending: regPending.count || 0,
          messagesTotal: msgTotalCount,
          messagesUnread: msgUnreadCount,
          faqsActive: faqActive.count || 0,
          eventsUpcoming: evtUpcoming.count || 0,
        });

        const mappedAnn = (recentAnn.data || []).map((ann: any) => ({
          id: ann.id,
          title: ann.title,
          status: ann.status,
          published_at: ann.published_at,
          created_at: ann.created_at,
          profiles: Array.isArray(ann.profiles) ? ann.profiles[0] : ann.profiles,
        }));

        setRecentAnnouncements(mappedAnn);
        setRecentConversations(mappedCon);
        setUpcomingEvents((upEvts.data as UpcomingEvent[]) || []);
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchDashboard();

    return () => {
      ignore = true;
    };
  }, [hasMessageAccess]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-[#F5B400] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome banner */}
      <div 
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{
          background: `linear-gradient(to right, var(--color-primary-green) 0%, rgba(var(--color-primary-green-rgb), 0.8) 100%)`
        }}
      >
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10">
          <div className="absolute top-1/2 right-10 -translate-y-1/2 w-40 h-40 border-[12px] border-[#F5B400] rounded-full" />
        </div>
        <p className="text-[#F5B400] text-[10px] font-mono font-bold uppercase tracking-widest mb-1">Welcome back</p>
        <h2 className="font-sans font-black text-xl tracking-tight">CCIS DevCom Admin Dashboard</h2>
        <p className="text-white/60 text-xs mt-1">Here's your overview for today.</p>
      </div>

      {/* Stat cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${hasMessageAccess ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        <StatCard
          label="Announcements"
          value={stats.announcementsTotal}
          subtitle={`${stats.announcementsPublished} published`}
          icon={Megaphone}
        />
        <StatCard
          label="Not Attended"
          value={stats.registrationsPending}
          subtitle={`${stats.registrationsTotal} total registrants`}
          icon={ClipboardList}
          badgeCount={stats.registrationsPending}
          badgeColor="gold"
        />
        {hasMessageAccess && (
          <StatCard
            label="Unread Messages"
            value={stats.messagesUnread}
            subtitle={`${stats.messagesTotal} messages`}
            icon={MessageSquare}
            badgeCount={stats.messagesUnread}
            badgeColor={stats.messagesUnread > 0 ? 'red' : 'green'}
          />
        )}
        <StatCard
          label="Active FAQs"
          value={stats.faqsActive}
          subtitle={`${stats.eventsUpcoming} upcoming events`}
          icon={HelpCircle}
        />
      </div>

      {/* Two-column layout */}
      <div className={`grid grid-cols-1 ${hasMessageAccess ? 'lg:grid-cols-2' : 'w-full'} gap-6`}>
        {/* Recent Announcements */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-sans font-bold text-sm text-[#1A3C2E]">Recent Announcements</h3>
            <button
              onClick={() => setActiveSection('announcements')}
              className="text-[10px] font-bold text-[#F5B400] uppercase tracking-wider hover:underline flex items-center gap-1"
            >
              View All <ArrowRight size={10} />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {recentAnnouncements.length === 0 ? (
              <p className="p-5 text-sm text-gray-400 text-center">No announcements yet</p>
            ) : recentAnnouncements.map(ann => (
               <div key={ann.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#222B26] truncate group-hover:text-[#1A3C2E]">{ann.title}</p>
                  <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                    {new Date(ann.published_at || ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {ann.profiles?.full_name || 'Admin'}
                  </p>
                </div>
                <StatusBadge 
                  variant={ann.status === 'published' ? 'success' : 'neutral'} 
                  label={ann.status} 
                />
                <button
                  onClick={() => setActiveSection('announcements')}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-[#F5B400] hover:bg-[#F5B400]/10 transition-[width,height,margin-top,opacity] opacity-0 group-hover:opacity-100"
                >
                  <Edit3 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Conversations */}
        {hasMessageAccess && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-sans font-bold text-sm text-[#1A3C2E]">Recent Conversations</h3>
              <button
                onClick={() => setActiveSection('messages')}
                className="text-[10px] font-bold text-[#F5B400] uppercase tracking-wider hover:underline flex items-center gap-1"
              >
                View Inbox <ArrowRight size={10} />
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {recentConversations.length === 0 ? (
                <p className="p-5 text-sm text-gray-400 text-center">No active student conversations</p>
              ) : recentConversations.map(con => {
                return (
                   <div key={con.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {(con.unread_count || 0) > 0 && <div className="w-2 h-2 rounded-full bg-[#F5B400] shrink-0" />}
                        <p className={`text-sm truncate ${(con.unread_count || 0) > 0 ? 'font-bold text-[#222B26]' : 'font-medium text-gray-600'}`}>
                          {con.profiles?.full_name || 'Anonymous Student'}
                        </p>
                      </div>
                      <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                        {con.profiles?.email} · Active: {new Date(con.last_message_at).toLocaleDateString()}
                      </p>
                    </div>
                    {(con.unread_count || 0) > 0 && (
                      <span className="bg-[#C0392B] text-white text-[9px] font-black w-[18px] h-[18px] flex items-center justify-center rounded-full">
                        {con.unread_count}
                      </span>
                    )}
                    <button
                      onClick={() => setActiveSection('messages')}
                      className="px-3 py-1 rounded-lg bg-[#F5B400]/10 text-[#F5B400] text-[10px] font-bold uppercase tracking-wider hover:bg-[#F5B400]/20 transition-[width,height,margin-top,opacity] opacity-0 group-hover:opacity-100"
                    >
                      Open
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Upcoming events mini-bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-sans font-bold text-sm text-[#1A3C2E] flex items-center gap-2">
            <Calendar size={16} className="text-[#F5B400]" />
            Upcoming Events
          </h3>
          <button
            onClick={() => setActiveSection('calendar')}
            className="text-[10px] font-bold text-[#F5B400] uppercase tracking-wider hover:underline flex items-center gap-1"
          >
            Calendar <ArrowRight size={10} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-gray-400 col-span-3 text-center py-4">No upcoming events</p>
          ) : upcomingEvents.map(evt => (
            <div key={evt.id} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className={`w-2 h-8 rounded-full ${evt.category === 'priority' ? 'bg-[#F5B400]' : 'bg-[#2E7D32]'}`} />
              <div>
                <p className="text-xs font-bold text-[#222B26]">{evt.title}</p>
                <p className="text-[10px] text-gray-400 font-mono">
                  {new Date(evt.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
