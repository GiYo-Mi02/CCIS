import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Send, Clock, User, MessageSquare, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAdmin } from '../AdminContext';
import { Conversation, Message } from '../../types/database';
import Pagination from '../components/Pagination';
import { checkIsProfane } from '../../lib/profanity';
import { postgrestIlike } from '../../lib/postgrest';
import { useRealtimeAvailability } from '../../hooks/useRealtimeAvailability';
import { CHAT_MESSAGE_FIELDS, mergeChatMessages, registerRealtimeChannel, toChatMessage, toChatMessages } from '../../lib/chatLifecycle';

const formatMessageTimeHeader = (dateStr: string): string => {
  const date = new Date(dateStr);
  const today = new Date();
  const isSameDay = date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear();
  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  if (isSameDay) {
    return timeStr;
  } else {
    const dateStrFormatted = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    return `${dateStrFormatted} · ${timeStr}`;
  }
};

export default function MessagesInbox() {
  const { profile } = useAuth();
  const { showToast } = useAdmin();
  const { isRealtimeAvailable } = useRealtimeAvailability();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedCon, setSelectedCon] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  // Loading states
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  // Pagination states for Inbox list (conversations)
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  // Pagination states for active thread messages
  const [messageOffset, setMessageOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const messageLimit = 50;

  const chatEndRef = useRef<HTMLDivElement>(null);
  const activeConIdRef = useRef<string | null>(null);

  // Security gate
  const hasAccess = profile && ['devcom_head', 'officer'].includes(profile.role);

  // Sync active reference
  useEffect(() => {
    activeConIdRef.current = selectedCon?.id || null;
  }, [selectedCon]);

  // Fetch unread counts globally for all conversations
  const fetchUnreadCounts = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_dashboard_unread_counts');

      if (error) {
        console.error('Error fetching unread counts:', error.message);
        return;
      }

      if (data) {
        const counts: Record<string, number> = {};
        (data as Array<{ conversation_id: string; unread_count: number | string }>).forEach(row => {
          counts[row.conversation_id] = Number(row.unread_count || 0);
        });
        setUnreadCounts(counts);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Fetch conversation list
  const fetchConversationsList = useCallback(async (page: number = 1) => {
    if (!hasAccess) return;
    setLoadingList(true);

    try {
      // 1. Get total counts
      let countQuery;
      if (searchQuery.trim()) {
        const searchFilter = postgrestIlike(searchQuery);
        countQuery = supabase
          .from('conversations')
          .select('id, profiles!inner(full_name, email)', { count: 'exact', head: true })
          .or(`full_name.ilike.${searchFilter},email.ilike.${searchFilter}`, { referencedTable: 'profiles' });
      } else {
        countQuery = supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true });
      }

      const { count: total, error: countErr } = await countQuery;
      
      if (countErr) {
        console.error('Count query error:', countErr.message);
        setLoadingList(false);
        return;
      }

      const matchedCount = total || 0;
      setTotalCount(matchedCount);
      setTotalPages(Math.max(1, Math.ceil(matchedCount / pageSize)));

      // 2. Fetch paginated list
      let listQuery;
      if (searchQuery.trim()) {
        const searchFilter = postgrestIlike(searchQuery);
        listQuery = supabase
          .from('conversations')
          .select('id, profile_id, created_at, last_message_at, profiles!inner(full_name, email, avatar_url)')
          .or(`full_name.ilike.${searchFilter},email.ilike.${searchFilter}`, { referencedTable: 'profiles' });
      } else {
        listQuery = supabase
          .from('conversations')
          .select('id, profile_id, created_at, last_message_at, profiles(full_name, email, avatar_url)');
      }

      const offset = (page - 1) * pageSize;
      const { data: pageData, error: listErr } = await listQuery
        .order('last_message_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (listErr) {
        console.error('List query error:', listErr.message);
        showToast('Failed to load conversations', 'error');
      } else {
        setConversations((pageData as Conversation[]) || []);
        await fetchUnreadCounts();
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoadingList(false);
    }
  }, [fetchUnreadCounts, hasAccess, searchQuery, showToast]);

  // Initial fetch and on search/page change
  useEffect(() => {
    if (hasAccess) {
      fetchConversationsList(currentPage);
    }
  }, [currentPage, fetchConversationsList, hasAccess, searchQuery]);

  // Fetch messages inside selected conversation
  const fetchThreadMessages = useCallback(async (conversationId: string, currentOffset: number, append: boolean = false) => {
    setLoadingMessages(currentOffset === 0);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(CHAT_MESSAGE_FIELDS)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + messageLimit - 1);

      if (error) {
        console.error('Error thread fetch:', error.message);
        showToast('Failed to load messages', 'error');
        return;
      }

      if (data) {
        const rows = toChatMessages(data);
        const reversed = [...rows].reverse();
        if (append) {
          setMessages(prev => [...reversed, ...prev]);
        } else {
          setMessages(reversed);
        }
        setHasMoreMessages(rows.length === messageLimit);

        // Mark as read
        const unreadStudentMsgIds: string[] = [];
        for (const message of rows) {
          if (message.sender_role === 'student' && !message.read_by_admin) unreadStudentMsgIds.push(message.id);
        }

        if (unreadStudentMsgIds.length > 0) {
          const currentUnread = unreadCounts[conversationId] || 0;
          // Perform DB update asynchronously in background
          supabase
            .rpc('mark_messages_read_by_admin', { p_message_ids: unreadStudentMsgIds })
            .then(({ error }) => {
              if (error) {
                console.error('Error marking messages as read on Supabase:', error.message);
                return;
              }

              if (currentUnread > 0) {
                window.dispatchEvent(new CustomEvent('admin-read-conversation', {
                  detail: { conversationId, count: currentUnread }
                }));
              }

              setUnreadCounts(prev => ({
                ...prev,
                [conversationId]: 0
              }));
            });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMessages(false);
    }
  }, [showToast, unreadCounts]);

  // Trigger loading of conversation messages on selection
  useEffect(() => {
    if (selectedCon) {
      setMessageOffset(0);
      fetchThreadMessages(selectedCon.id, 0, false).then(() => {
        scrollToBottom();
      });
    } else {
      setMessages([]);
    }
  }, [fetchThreadMessages, selectedCon]);

  // Realtime subscription setup
  useEffect(() => {
    if (!hasAccess || !isRealtimeAvailable) return;

    const channelId = `admin_inbox_messages_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const activeConId = activeConIdRef.current;
          const newMsg = toChatMessage(payload.new);
          if (!newMsg) return;
            // If the message is for the active thread, append it
            if (activeConId && newMsg.conversation_id === activeConId) {
              if (newMsg.sender_role === 'student' && !newMsg.read_by_admin) {
                // Mark as read immediately
                const { error: readError } = await supabase.rpc('mark_messages_read_by_admin', {
                  p_message_ids: [newMsg.id],
                });
                if (readError) {
                  console.error('Error marking incoming message as read:', readError.message);
                } else {
                  newMsg.read_by_admin = true;
                }
              }
              
              setMessages(prev => mergeChatMessages(prev, [newMsg]));
              scrollToBottom();
            }

          // Re-fetch conversation details/badge status globally
          void fetchConversationsList(currentPage);
        }
      )
      .subscribe();
    const unregister = registerRealtimeChannel(channelId);

    return () => {
      unregister();
      void supabase.removeChannel(channel);
    };
  }, [currentPage, fetchConversationsList, hasAccess, isRealtimeAvailable]);

  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleLoadMoreMessages = async () => {
    if (!selectedCon) return;
    const nextOffset = messageOffset + messageLimit;
    setMessageOffset(nextOffset);
    await fetchThreadMessages(selectedCon.id, nextOffset, true);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedCon || !inputText.trim() || sending) return;

    if (checkIsProfane(inputText)) {
      showToast('Inappropriate language detected. Please check your message.', 'error');
      return;
    }

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const { data: inserted, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedCon.id,
          sender_id: profile.id,
          sender_role: 'admin',
          content: messageText,
        })
        .select()
        .single();

      if (error) {
        console.error('Send reply failed:', error.message);
        showToast('Failed to send message', 'error');
        setInputText(messageText); // restore
      } else if (inserted) {
        setMessages(prev => [...prev, inserted as Message]);
        scrollToBottom();
        // Update list sorting locally or trigger list refetch
        fetchConversationsList(currentPage);
      }
    } catch (err) {
      console.error(err);
    } finally {
      // 1.5s spam cooldown protection
      setTimeout(() => {
        setSending(false);
      }, 1500);
    }
  };

  if (!hasAccess) {
    return (
      <div className="p-6 text-center bg-white rounded-3xl border border-zinc-100 shadow-sm max-w-lg mx-auto mt-20 font-sans">
        <AlertCircle className="mx-auto text-rose-500 mb-3" size={36} />
        <h2 className="text-lg font-black text-[#1A3C2E]">Access Restricted</h2>
        <p className="text-xs text-stone-500 mt-2 leading-relaxed">
          Only DevCom Heads and Officers have permissions to view or reply to student support messages.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[80vh] flex gap-6 font-sans">
      
      {/* 1. LEFT SIDEBAR PANEL: CONVERSATIONS LIST */}
      <div className={`w-full md:w-[350px] shrink-0 bg-white rounded-2xl border border-zinc-200 overflow-hidden flex flex-col justify-between shadow-sm ${
        selectedCon ? 'hidden md:flex' : 'flex'
      }`}>
        
        {/* Search & Header */}
        <div className="p-4 border-b border-zinc-100 space-y-3 shrink-0">
          <div>
            <h2 className="font-sans font-black text-sm text-[#1A3C2E]">Messages Inbox</h2>
            <p className="text-[10px] text-stone-400 mt-0.5">Manage direct student queries and help desk issues.</p>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search student inbox..."
              className="w-full bg-zinc-50 border border-zinc-250 focus:border-[#F5B400] rounded-xl pl-9 pr-4 py-2 text-xs outline-none transition-colors"
            />
          </div>
        </div>

        {/* List items */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-50 bg-zinc-50/20">
          {loadingList ? (
            <div className="py-20 flex flex-col items-center justify-center text-zinc-400 space-y-2">
              <Loader2 className="animate-spin text-[#F5B400]" size={20} />
              <p className="text-[10px] font-mono uppercase tracking-wider">Syncing conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="py-20 text-center text-zinc-400">
              <MessageSquare className="mx-auto mb-2 opacity-30" size={24} />
              <p className="font-bold text-xs">No active chats found</p>
              <p className="text-[10px] mt-0.5">Students who write support tickets will show here.</p>
            </div>
          ) : (
            conversations.map(con => {
              const isSelected = selectedCon?.id === con.id;
              const unread = unreadCounts[con.id] || 0;
              return (
                <button
                  key={con.id}
                  onClick={() => {
                    setSelectedCon(con);
                  }}
                  className={`w-full text-left p-4 transition-all flex items-start gap-3 border-l-4 ${
                    isSelected 
                      ? 'bg-amber-50/10 border-l-[#F5B400] bg-zinc-50/60' 
                      : 'border-l-transparent bg-white hover:bg-zinc-50/40'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-[var(--color-primary-green,#1A3C2E)] text-[#FAF7EA] flex items-center justify-center font-bold text-xs uppercase shrink-0">
                    {con.profiles?.avatar_url ? (
                      <img src={con.profiles.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      (con.profiles?.full_name || 'U').split(' ').map(n => n[0]).join('')
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs block truncate ${unread > 0 ? 'font-black text-[#222B26]' : 'font-semibold text-stone-700'}`}>
                        {con.profiles?.full_name || 'Student Coordinator'}
                      </span>
                      <span className="text-[8px] font-mono text-zinc-400">
                        {new Date(con.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-stone-400 truncate mt-0.5">{con.profiles?.email}</p>
                  </div>
                  {unread > 0 && (
                    <span className="bg-[#C0392B] text-white text-[8px] font-black w-4.5 h-4.5 flex items-center justify-center rounded-full shrink-0">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Pagination footer */}
        <div className="p-3 border-t border-zinc-150 shrink-0 bg-white">
          <Pagination 
            currentPage={currentPage} 
            totalPages={totalPages} 
            onPageChange={setCurrentPage} 
          />
        </div>

      </div>

      {/* 2. RIGHT PANEL: CHAT THREAD PANEL */}
      <div className={`flex-1 bg-white rounded-2xl border border-zinc-200 overflow-hidden flex flex-col justify-between shadow-sm ${
        !selectedCon ? 'hidden md:flex' : 'flex'
      }`}>
        {selectedCon ? (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-[var(--color-primary-green,#1A3C2E)] text-white shrink-0">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedCon(null)} 
                  className="md:hidden p-1 rounded-full hover:bg-white/10 text-white/80"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center border border-[#F5B400]/25">
                  <User size={16} className="text-[#F5B400]" />
                </div>
                <div>
                  <h3 className="font-sans font-black text-sm text-white tracking-tight">{selectedCon.profiles?.full_name || 'CCIS Tiger'}</h3>
                  <p className="text-[10px] text-white/60 font-mono">{selectedCon.profiles?.email}</p>
                </div>
              </div>
              <div>
                <span className="text-[8px] font-mono uppercase tracking-wider text-[#F5B400] bg-[#F5B400]/10 border border-[#F5B400]/20 px-2 py-0.5 rounded">
                  Staff Channel
                </span>
              </div>
            </div>

            {/* Messages body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/50 flex flex-col">
              {loadingMessages ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 space-y-2">
                  <Loader2 className="animate-spin text-[#F5B400]" size={20} />
                  <p className="text-[10px] font-mono uppercase tracking-wider">Syncing inbox thread...</p>
                </div>
              ) : (
                <>
                  {hasMoreMessages && (
                    <button
                      onClick={handleLoadMoreMessages}
                      className="mx-auto bg-white hover:bg-zinc-50 text-[var(--color-primary-green,#1A3C2E)] border border-zinc-200/80 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors shadow-xs"
                    >
                      Load older messages
                    </button>
                  )}

                  <div className="space-y-3.5 mt-auto">
                    {messages.map((msg, idx) => {
                      const isAdminReply = msg.sender_role === 'admin';
                      
                      // Determine if we should show a time header
                      let showTimeHeader = false;
                      if (idx === 0) {
                        showTimeHeader = true;
                      } else {
                        const prevMsg = messages[idx - 1];
                        const diffMs = new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime();
                        const diffMins = diffMs / (1000 * 60);
                        if (diffMins > 10) {
                          showTimeHeader = true;
                        }
                      }

                      return (
                        <React.Fragment key={msg.id}>
                          {showTimeHeader && (
                            <div className="w-full text-center my-2 select-none shrink-0 animate-fade-in">
                              <span className="text-[9px] font-mono tracking-wider font-bold text-stone-400 bg-stone-100/80 px-2.5 py-0.5 rounded-md border border-stone-200/40">
                                {formatMessageTimeHeader(msg.created_at)}
                              </span>
                            </div>
                          )}

                          <div 
                            className={`flex ${isAdminReply ? 'justify-end' : 'justify-start'} animate-fade-in`}
                          >
                            <div className={`flex items-start gap-2.5 max-w-[80%] ${isAdminReply ? 'flex-row-reverse' : 'flex-row'}`}>
                              
                              {/* Icon avatar */}
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden bg-white border ${
                                isAdminReply 
                                  ? 'border-[#F5B400]/30' 
                                  : 'border-zinc-300'
                              }`}>
                                {isAdminReply ? (
                                  <img src="/images/CCIS-Logo.png" alt="CCIS" className="w-5 h-5 object-contain animate-fade-in" />
                                ) : selectedCon?.profiles?.avatar_url ? (
                                  <img src={selectedCon.profiles.avatar_url} alt="" className="w-full h-full object-cover animate-fade-in" />
                                ) : (
                                  <span className="text-[10px] font-sans font-black text-[#1A3C2E] uppercase animate-fade-in">
                                    {(selectedCon?.profiles?.full_name || 'U').split(' ').map(n => n[0]).join('')}
                                  </span>
                                )}
                              </div>

                              {/* Bubble body */}
                              <div className="flex flex-col">
                                <div className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                                  isAdminReply 
                                    ? 'bg-[var(--color-primary-green,#1A3C2E)] text-[#FAF7EA] rounded-tr-none' 
                                    : 'bg-white border border-zinc-150 text-[#222B26] rounded-tl-none'
                                }`}>
                                  <p className="whitespace-pre-wrap" style={{ wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                                </div>
                                
                                <span className={`text-[8.5px] font-mono text-zinc-400 mt-1 flex items-center gap-1 ${isAdminReply ? 'justify-end' : 'justify-start'}`}>
                                  <Clock size={8} />
                                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {isAdminReply && (
                                    <span className={`font-bold uppercase tracking-wider text-[7.5px] ml-1 ${
                                      msg.read_by_student ? 'text-emerald-500' : 'text-zinc-300'
                                    }`}>
                                      · {msg.read_by_student ? 'Seen' : 'Sent'}
                                    </span>
                                  )}
                                </span>
                              </div>

                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Composer */}
            <form onSubmit={handleSendReply} className="p-4 border-t border-zinc-100 bg-white shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  disabled={sending}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={sending ? 'Sending reply...' : 'Type administrative response reply...'}
                  className="flex-1 bg-zinc-50 border border-zinc-200 focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400] rounded-xl px-4 py-2.5 text-xs outline-none transition-colors disabled:bg-zinc-100 disabled:text-zinc-400"
                  maxLength={1000}
                />
                <button
                  type="submit"
                  disabled={sending || !inputText.trim()}
                  className="p-2.5 bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] rounded-xl shadow-xs transition-colors shrink-0 flex items-center justify-center disabled:opacity-50"
                  title="Send Reply"
                >
                  {sending ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 bg-[#1A3C2E]/5 rounded-full flex items-center justify-center text-[var(--color-primary-green,#1A3C2E)]">
              <MessageSquare size={28} />
            </div>
            <div>
              <h3 className="font-sans font-black text-sm text-[#1A3C2E]">No Active Conversation Selected</h3>
              <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                Click a student contact name in the left column to view their inbox thread, read messages, and reply.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
