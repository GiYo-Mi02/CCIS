import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, X, Send, Loader2, Lock, MessageCircle, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Conversation, Message } from '../types/database';
import { checkIsProfane } from '../lib/profanity';
import {
  CHAT_MESSAGE_FIELDS,
  mergeChatMessages,
  registerRealtimeChannel,
  toChatMessage,
  toChatMessages,
} from '../lib/chatLifecycle';
import { useRealtimeAvailability } from '../hooks/useRealtimeAvailability';

interface SupportWidgetProps {
  onNavigate: (tab: string) => void;
  disabled?: boolean;
}

const MESSAGE_LIMIT = 30;

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

const isWorkingHours = (): boolean => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 6 = Sat
  const hour = now.getHours();
  // Monday (1) to Friday (5), 8:00 AM (8) to 5:00 PM (17)
  const isWeekday = day >= 1 && day <= 5;
  const isOfficeHours = hour >= 8 && hour < 17;
  return isWeekday && isOfficeHours;
};

export default function SupportWidget({ onNavigate, disabled = false }: SupportWidgetProps) {
  const { user } = useAuth();
  const { isOnline, isRealtimeAvailable } = useRealtimeAvailability();
  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  // Reset chat state when the authenticated identity changes. No request is
  // made here: opening the chat is what lazily initializes a conversation.
  useEffect(() => {
    setConversation(null);
    setMessages([]);
    setUnreadCount(0);
    setHasMore(false);
    setOffset(0);
    setLoadError(null);
  }, [user?.id]);

  useEffect(() => {
    if (disabled) setIsOpen(false);
  }, [disabled]);

  // Create/ensure a conversation only after the student opens chat while the
  // page is visible and online. Reopening or resuming reuses local state.
  useEffect(() => {
    if (!user || !isOpen || disabled || !isRealtimeAvailable || conversation) return;

    let cancelled = false;

    const initConversation = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { data: con, error } = await supabase
          .rpc('ensure_conversation')
          .single();

        if (error) {
          console.error('Error fetching conversation:', error.message);
          if (!cancelled) {
            setLoadError('Support chat could not be opened. Please try again.');
            setLoading(false);
          }
          return;
        }

        if (!cancelled && con) {
          setConversation(con as Conversation);
        }
      } catch (err) {
        console.error('Unexpected conversation init error in widget:', err);
        if (!cancelled) {
          setLoadError('Support chat could not be opened. Please try again.');
          setLoading(false);
        }
      }
    };

    void initConversation();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isOpen, disabled, isRealtimeAvailable, conversation, retryNonce]);

  const fetchMessages = useCallback(async (currentOffset: number, append = false) => {
    if (!conversation) return;

    if (currentOffset === 0) setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(CHAT_MESSAGE_FIELDS)
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(currentOffset, currentOffset + MESSAGE_LIMIT - 1);

      if (error) {
        console.error('Error fetching messages in widget:', error.message);
        setLoadError('Messages could not be loaded. Please try again.');
        return;
      }

      const rows = toChatMessages(data);
      const page = [...rows].reverse();
      setMessages((current) => append ? mergeChatMessages(current, page) : page);
      setHasMore(rows.length === MESSAGE_LIMIT);

      if (currentOffset === 0) {
        const hasUnreadAdmin = rows.some(
          (message) => message.sender_role === 'admin' && !message.read_by_student,
        );
        if (hasUnreadAdmin) {
          const { error: readError } = await supabase.rpc('mark_conversation_messages_read_by_student', {
            p_conversation_id: conversation.id,
          });
          if (readError) {
            console.error('Error marking widget messages as read:', readError.message);
          } else {
            setUnreadCount(0);
            window.dispatchEvent(new Event('student-chat-read'));
          }
        }
        scrollToBottom();
      }
    } catch (err) {
      console.error('Error loading support messages:', err);
      setLoadError('Messages could not be loaded. Please try again.');
    } finally {
      if (currentOffset === 0) setLoading(false);
    }
  }, [conversation, scrollToBottom]);

  // Refresh the latest page after opening or returning from a hidden/offline
  // state so messages missed while disconnected are reconciled once.
  useEffect(() => {
    if (!isOpen || disabled || !conversation || !isRealtimeAvailable) return;
    setOffset(0);
    void fetchMessages(0, false);
  }, [isOpen, disabled, conversation, isRealtimeAvailable, fetchMessages]);

  // Realtime messages subscription
  useEffect(() => {
    if (!isOpen || disabled || !conversation || !isRealtimeAvailable) return;

    const channelId = `widget_chat_messages_${conversation.id}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        async (payload) => {
          const newMsg = toChatMessage(payload.new);
          if (!newMsg) return;
          
          if (newMsg.sender_role === 'admin') {
            const { error: readError } = await supabase.rpc('mark_conversation_messages_read_by_student', {
              p_conversation_id: conversation.id,
            });
            if (readError) {
              console.error('Error marking widget message as read:', readError.message);
            } else {
              newMsg.read_by_student = true;
              setUnreadCount(0);
              window.dispatchEvent(new Event('student-chat-read'));
            }
            setMessages((prev) => mergeChatMessages(prev, [newMsg]));
            scrollToBottom();
          } else {
            setMessages((prev) => mergeChatMessages(prev, [newMsg]));
            scrollToBottom();
          }
        }
      )
      .subscribe();
    const unregisterChannel = registerRealtimeChannel(channelId);

    return () => {
      unregisterChannel();
      void supabase.removeChannel(channel);
    };
  }, [conversation, isOpen, disabled, isRealtimeAvailable, scrollToBottom]);

  const handleLoadMore = async () => {
    const nextOffset = offset + MESSAGE_LIMIT;
    setOffset(nextOffset);
    await fetchMessages(nextOffset, true);
  };

  const handleRetry = () => {
    setLoadError(null);
    if (conversation) void fetchMessages(0, false);
    else setRetryNonce((current) => current + 1);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !conversation || !isOnline || !inputText.trim() || sending) return;

    if (checkIsProfane(inputText)) {
      setWarningMsg('Inappropriate language detected. Please check your message.');
      return;
    }
    setWarningMsg(null);

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const { data: insertedMsg, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          sender_role: 'student',
          content: messageText,
        })
        .select(CHAT_MESSAGE_FIELDS)
        .single();

      if (error) {
        console.error('Failed to send widget message:', error.message);
        setInputText(messageText); // restore text on failure
      } else if (insertedMsg) {
        const message = toChatMessage(insertedMsg);
        if (message) setMessages((prev) => mergeChatMessages(prev, [message]));
        scrollToBottom();
      }
    } catch (err) {
      console.error('Failed to send:', err);
    } finally {
      setTimeout(() => {
        setSending(false);
      }, 1000);
    }
  };

  const handleToggle = () => {
    if (isOpen) {
      setIsOpen(false);
    } else {
      setIsOpen(true);
    }
  };

  if (disabled) return null;

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <button
        onClick={handleToggle}
        className="fixed bottom-6 right-6 z-[9999] w-14 h-14 bg-[#1A3C2E] hover:bg-[#123524] text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 border border-[#F5B400]/40 cursor-pointer group"
        aria-label="Toggle chat support helpdesk"
      >
        <span className="absolute inset-0 rounded-full bg-[#FAF7EA]/10 scale-0 group-hover:scale-100 transition-transform duration-300" />
        
        {/* Pulse outline ring */}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -inset-1 rounded-full border-2 border-[#F5B400] animate-ping opacity-75" />
        )}
        {!isOpen && unreadCount === 0 && (
          <span className="absolute -inset-1 rounded-full border border-[#1A3C2E]/30 animate-pulse" />
        )}

        {isOpen ? (
          <X size={22} className="relative z-10 transition-transform duration-300 rotate-90" />
        ) : (
          <MessageCircle size={24} className="relative z-10 transition-transform duration-300 group-hover:rotate-6" />
        )}

        {/* Unread Badge */}
        {!isOpen && unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-[#F5B400] text-[#1A3C2E] font-sans font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-md animate-bounce">
            {unreadCount}
          </div>
        )}
      </button>

      {/* Chat support popup card */}
      <div
        className={`fixed bottom-24 right-6 z-[9999] w-[350px] sm:w-[380px] h-[500px] max-h-[75vh] flex flex-col bg-white rounded-3xl border border-stone-100 shadow-2xl overflow-hidden transition-all duration-300 origin-bottom-right ${
          isOpen
            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
            : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
        }`}
      >
        {/* Header section */}
        <div className="bg-gradient-to-r from-[#1A3C2E] to-[#123524] text-white px-5 py-4 flex items-center justify-between border-b border-[#F5B400]/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center border border-[#F5B400]/40 overflow-hidden shrink-0">
                <img
                  src="/images/CCIS-Logo.png"
                  alt="CCIS Logo"
                  className="w-7 h-7 object-contain"
                  onError={(e) => {
                    // Fallback if the logo fails to load
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border border-[#1A3C2E] rounded-full animate-pulse" />
            </div>
            <div>
              <h3 className="font-serif font-black text-sm tracking-wide">CCIS Support Hub</h3>
              <p className="text-[10px] text-white/60 font-mono tracking-tight">Typically replies in minutes</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Message / Content area */}
        <div className="flex-1 bg-[#FAF7EA]/30 overflow-y-auto p-4 flex flex-col gap-3 font-sans">
          {/* Out of hours advisory banner */}
          {user && !loading && !isWorkingHours() && (
            <div className="bg-[#FAF7EA] border-2 border-[#1A3C2E]/10 rounded-2xl p-3.5 text-left text-xs text-stone-750 flex items-start gap-2.5 shadow-xs animate-fade-in shrink-0">
              <Clock size={16} className="text-[#FFBC00] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-[#1A3C2E]">CCIS Support Offline</p>
                <p className="leading-relaxed text-[10.5px] text-stone-600">
                  Our normal working hours are Mon–Fri, 8:00 AM–5:00 PM. Committee members may not reply immediately right now, but please leave your concern below and we will get back to you!
                </p>
              </div>
            </div>
          )}

          {!user ? (
            /* Guest / Logged out view */
            <div className="my-auto text-center flex flex-col items-center justify-center px-4 py-8">
              <div className="w-16 h-16 rounded-full bg-[#F5B400]/10 text-[#F5B400] flex items-center justify-center mb-4 border border-[#F5B400]/30 shadow-inner">
                <Lock size={28} />
              </div>
              <h4 className="font-serif font-black text-[#1A3C2E] text-base mb-2">Sign in to support</h4>
              <p className="text-xs text-stone-500 leading-relaxed max-w-[260px] mb-6">
                To message the student council or send a direct concern to support representatives, please log in to your student account first.
              </p>
              <button
                onClick={() => {
                  setIsOpen(false);
                  onNavigate('login');
                }}
                className="w-full bg-[#1A3C2E] hover:bg-[#123524] text-white py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer border border-[#F5B400]/20"
              >
                Go to Sign In
              </button>
            </div>
          ) : !isOnline ? (
            <div className="my-auto text-center flex flex-col items-center justify-center px-5 py-8">
              <MessageSquare className="text-stone-300 mb-3" size={28} />
              <h4 className="font-serif font-black text-[#1A3C2E] text-sm">You are offline</h4>
              <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                Reconnect to load or send support messages. Chat will resume automatically.
              </p>
            </div>
          ) : loading ? (
            /* Loading state */
            <div className="my-auto flex flex-col items-center justify-center gap-2">
              <Loader2 className="animate-spin text-[#1A3C2E]" size={24} />
              <span className="text-[10px] font-mono text-stone-400">Loading support conversation...</span>
            </div>
          ) : loadError ? (
            <div className="my-auto text-center flex flex-col items-center justify-center px-5 py-8">
              <MessageSquare className="text-rose-300 mb-3" size={28} />
              <p className="text-xs text-stone-600 leading-relaxed">{loadError}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="mt-4 rounded-xl bg-[#1A3C2E] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white"
              >
                Retry
              </button>
            </div>
          ) : (
            /* Logged in state with conversation messages */
            <>
              {hasMore && (
                <button
                  type="button"
                  onClick={() => void handleLoadMore()}
                  className="mx-auto rounded-full border border-stone-200 bg-white px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-[#1A3C2E]"
                >
                  Load older messages
                </button>
              )}
              {messages.length === 0 ? (
                /* Empty state / Welcome message */
                <div className="flex gap-2.5 items-start mt-2">
                  <div className="w-7 h-7 rounded-full bg-[#1A3C2E] flex items-center justify-center shrink-0 border border-[#F5B400]/30">
                    <MessageSquare size={12} className="text-white" />
                  </div>
                  <div className="bg-stone-100 text-stone-800 rounded-2xl rounded-tl-none px-4 py-3 max-w-[85%] text-xs leading-relaxed shadow-xs font-sans">
                    <p className="font-semibold text-[10px] text-[#1A3C2E] mb-1 font-mono">CCIS SUPPORT TEAM</p>
                    Hi there! 👋 Welcome to the official CCIS Representative Helpdesk. Ask us about announcements, events, registration issues, or any general concerns. We're here to help you!
                  </div>
                </div>
              ) : (
                /* Message history */
                messages.map((m, idx) => {
                  const isMe = m.sender_role === 'student';
                  
                  // Determine if we should show a time header
                  let showTimeHeader = false;
                  if (idx === 0) {
                    showTimeHeader = true;
                  } else {
                    const prevMsg = messages[idx - 1];
                    const diffMs = new Date(m.created_at).getTime() - new Date(prevMsg.created_at).getTime();
                    const diffMins = diffMs / (1000 * 60);
                    if (diffMins > 10) {
                      showTimeHeader = true;
                    }
                  }

                  return (
                    <React.Fragment key={m.id}>
                      {showTimeHeader && (
                        <div className="w-full text-center my-2 select-none shrink-0 animate-fade-in">
                          <span className="text-[9px] font-mono tracking-wider font-bold text-stone-400 bg-stone-100/80 px-2.5 py-0.5 rounded-md border border-stone-200/40">
                            {formatMessageTimeHeader(m.created_at)}
                          </span>
                        </div>
                      )}

                      <div
                        className={`flex gap-2 items-start ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isMe && (
                          <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0 border border-[#F5B400]/30 overflow-hidden shadow-xs">
                            <img src="/images/CCIS-Logo.png" alt="CCIS" className="w-5 h-5 object-contain" />
                          </div>
                        )}
                        <div
                          className={`px-3.5 py-2 rounded-2xl text-xs leading-relaxed shadow-2xs font-sans ${
                            isMe
                              ? 'bg-[#1A3C2E] text-white rounded-tr-none max-w-[80%]'
                              : 'bg-stone-100 text-stone-800 rounded-tl-none max-w-[80%]'
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input box (only when logged in) */}
        {user && !loading && (
          <div className="flex flex-col border-t border-stone-100 bg-white shrink-0">
            {warningMsg && (
              <div className="bg-rose-50 border-b border-rose-100 px-4 py-2 text-left text-[10px] text-rose-600 flex items-center gap-2 animate-fade-in">
                <span className="font-bold uppercase tracking-wider bg-rose-100 px-1.5 py-0.5 rounded text-[8px] border border-rose-200">Blocked</span>
                <span>{warningMsg}</span>
              </div>
            )}
            <form
              onSubmit={handleSend}
              className="p-3 flex items-center gap-2"
            >
              <textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  if (warningMsg) setWarningMsg(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (inputText.trim() && !sending) {
                      handleSend(e as any);
                    }
                  }
                }}
                placeholder="Type your message here..."
                rows={1}
                className="flex-1 bg-stone-50 border border-stone-100 focus:outline-none focus:ring-1 focus:ring-[#F5B400] focus:bg-white rounded-2xl px-4 py-2 text-xs font-sans transition-all resize-none min-h-[36px] max-h-[100px] overflow-y-auto leading-relaxed"
                disabled={sending || !isOnline}
              />
              <button
                type="submit"
                disabled={sending || !isOnline || !inputText.trim()}
                className="w-9 h-9 rounded-full bg-[#1A3C2E] text-white hover:bg-[#123524] disabled:bg-stone-100 disabled:text-stone-300 disabled:scale-100 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shrink-0 border border-[#F5B400]/20 cursor-pointer self-end mb-0.5"
              >
                {sending ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Send size={14} />
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
