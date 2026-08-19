import React, { useState, useEffect, useRef } from 'react';
import { Send, ArrowLeft, Loader2, MessageSquare, Clock, User, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Conversation, Message } from '../types/database';

interface MessagesPageProps {
  onNavigate: (tab: string) => void;
}

export default function MessagesPage({ onNavigate }: MessagesPageProps) {
  const { user, profile } = useAuth();
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const chatEndRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);

  // Initialize or fetch conversation
  useEffect(() => {
    if (!user) return;

    const initConversation = async () => {
      setLoading(true);
      try {
        // Use the ensure_conversation() RPC which does INSERT ... ON CONFLICT DO NOTHING
        // internally, so it never throws a 409 duplicate key error.
        const { data: con, error } = await supabase
          .rpc('ensure_conversation')
          .single();

        if (error) {
          console.error('Error fetching conversation:', error.message);
        }

        setConversation(con as Conversation);
      } catch (err) {
        console.error('Unexpected conversation init error:', err);
      } finally {
        setLoading(false);
      }
    };

    initConversation();
  }, [user]);

  // Fetch messages helper
  const fetchMessages = async (currentOffset: number, append: boolean = false) => {
    if (!conversation) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + limit - 1);

      if (error) {
        console.error('Error fetching messages:', error.message);
        return;
      }

      if (data) {
        // Reverse array because database retrieves descending but chat renders ascending
        const newMessages = [...data].reverse() as Message[];
        
        if (append) {
          setMessages((prev) => [...newMessages, ...prev]);
        } else {
          setMessages(newMessages);
        }

        setHasMore(data.length === limit);
        
        // Mark admin messages as read by student in the entire conversation
        const latestAdminMsg = [...data].reverse().find(m => m.sender_role === 'admin');
        const hasUnreadAdmin = data.some(m => m.sender_role === 'admin' && !m.read_by_student);
        if (hasUnreadAdmin) {
          const { error: readError } = await supabase.rpc('mark_conversation_messages_read_by_student', {
            p_conversation_id: conversation.id,
          });
          if (readError) {
            console.error('Error marking messages as read:', readError.message);
          } else if (latestAdminMsg && user) {
            localStorage.setItem(`dismissed_msg_${user.id}`, latestAdminMsg.id);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Initial messages load
  useEffect(() => {
    if (conversation) {
      fetchMessages(0, false).then(() => {
        if (isFirstLoad.current) {
          scrollToBottom();
          isFirstLoad.current = false;
        }
      });
    }
  }, [conversation]);
  // Set up realtime channel subscription to listen for inserts/updates
  useEffect(() => {
    if (!conversation) return;

    const channelId = `student_chat_messages_${conversation.id}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Message;
            
            // Mark admin messages as read by student in the database
            if (newMsg.sender_role === 'admin' && !newMsg.read_by_student) {
              const { error: readError } = await supabase.rpc('mark_conversation_messages_read_by_student', {
                p_conversation_id: conversation.id,
              });
              if (readError) {
                console.error('Error marking message as read:', readError.message);
              } else {
                newMsg.read_by_student = true;
              }
            }

            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            scrollToBottom();
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as Message;
            setMessages((prev) => 
              prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation]);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Load older messages
  const handleLoadMore = async () => {
    const nextOffset = offset + limit;
    setOffset(nextOffset);
    await fetchMessages(nextOffset, true);
  };

  // Send message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !conversation || !inputText.trim() || sending) return;

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
        .select()
        .single();

      if (error) {
        console.error('Failed to send message:', error.message);
        setInputText(messageText); // restore text on failure
      } else if (insertedMsg) {
        setMessages((prev) => [...prev, insertedMsg as Message]);
        scrollToBottom();
      }
    } catch (err) {
      console.error('Failed to send:', err);
    } finally {
      // 1.5s anti-spam debounce delay
      setTimeout(() => {
        setSending(false);
      }, 1500);
    }
  };

  if (!user || !profile) return null;

  return (
    <div className="min-h-screen bg-[var(--color-bg-cream,#FAF7EA)] py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto flex flex-col h-[75vh] bg-white rounded-3xl border border-zinc-100 shadow-xl overflow-hidden">
        
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-[var(--color-primary-green,#1A3C2E)] text-white shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onNavigate('home')} 
              className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-[#F5B400]/40 shrink-0">
              <MessageSquare size={18} className="text-[#F5B400]" />
            </div>
            <div>
              <h2 className="font-sans font-black text-sm tracking-tight">Council Direct Support</h2>
              <p className="text-[10px] text-white/60 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                DevCom Live Support Inbox
              </p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-[9px] font-mono uppercase tracking-wider text-[#F5B400] font-bold bg-[#F5B400]/10 border border-[#F5B400]/20 px-2 py-0.5 rounded-md">
              Student Channel
            </span>
          </div>
        </div>

        {/* Chat Messages Panel */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/50 flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 space-y-2">
              <Loader2 className="animate-spin text-[var(--color-accent-gold,#F5B400)]" size={24} />
              <p className="text-xs font-mono uppercase tracking-wider">Loading inbox connection...</p>
            </div>
          ) : (
            <>
              {/* Load older messages trigger */}
              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  className="mx-auto bg-white hover:bg-zinc-50 text-[var(--color-primary-green,#1A3C2E)] border border-zinc-200/80 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors shadow-xs"
                >
                  Load older messages
                </button>
              )}

              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
                  <div className="w-14 h-14 bg-[var(--color-accent-gold,#F5B400)]/10 text-[var(--color-accent-gold,#F5B400)] rounded-full flex items-center justify-center">
                    <MessageSquare size={24} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-[var(--color-primary-green,#1A3C2E)]">Start a Conversation</h3>
                    <p className="text-xs text-stone-400 leading-relaxed">
                      Send a message to our student council developers or administrative officers. Ask about ticket issues, college events, or platform help.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 mt-auto">
                  {messages.map((msg) => {
                    const isAdmin = msg.sender_role === 'admin';
                    return (
                      <div 
                        key={msg.id} 
                        className={`flex ${isAdmin ? 'justify-start' : 'justify-end'} animate-fade-in`}
                      >
                        <div className={`flex items-start gap-2.5 max-w-[80%] ${isAdmin ? 'flex-row' : 'flex-row-reverse'}`}>
                          
                          {/* Avatar icon */}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isAdmin 
                              ? 'bg-[var(--color-primary-green,#1A3C2E)] text-[#F5B400] border border-[#F5B400]/20' 
                              : 'bg-[var(--color-accent-gold,#F5B400)]/10 text-[var(--color-primary-green,#1A3C2E)] border border-zinc-200'
                          }`}>
                            {isAdmin ? <User size={12} /> : <User size={12} />}
                          </div>

                          {/* Chat bubble body */}
                          <div className="flex flex-col">
                            <div className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                              isAdmin 
                                ? 'bg-white border border-zinc-150 text-[#222B26] rounded-tl-none' 
                                : 'bg-[var(--color-primary-green,#1A3C2E)] text-[#FAF7EA] rounded-tr-none'
                            }`}>
                              <p className="whitespace-pre-wrap" style={{ wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                            </div>
                            
                            {/* Timestamp / Read indicator */}
                            <span className={`text-[8.5px] font-mono text-zinc-400 mt-1 flex items-center gap-1 ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                              <Clock size={8} />
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {!isAdmin && (
                                <span className={`font-bold uppercase tracking-wider text-[7.5px] ml-1 ${
                                  msg.read_by_admin ? 'text-emerald-500' : 'text-zinc-300'
                                }`}>
                                  · {msg.read_by_admin ? 'Seen' : 'Sent'}
                                </span>
                              )}
                            </span>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input form */}
        <form onSubmit={handleSend} className="p-4 bg-white border-t border-zinc-100 shrink-0 font-sans">
          <div className="flex items-center gap-2">
            <input
              type="text"
              required
              disabled={loading || sending}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={sending ? 'Sending disabled briefly (cooldown)...' : 'Type your message to the student council...'}
              className="flex-1 bg-zinc-50 border border-zinc-200 focus:border-[#F5B400] focus:ring-1 focus:ring-[#F5B400] rounded-xl px-4 py-2.5 text-xs outline-none transition-colors disabled:bg-zinc-100 disabled:text-zinc-400"
              maxLength={1000}
            />
            <button
              type="submit"
              disabled={loading || sending || !inputText.trim()}
              className="p-2.5 bg-[#F5B400] hover:bg-[#ffc522] text-[#1A3C2E] rounded-xl shadow-xs transition-colors flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send Message"
            >
              {sending ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
          
          <div className="flex items-center gap-1 text-[9px] text-stone-400 mt-2 font-mono justify-end">
            <AlertCircle size={10} />
            <span>Messages are checked by CCIS Officers and DevCom heads.</span>
          </div>
        </form>

      </div>
    </div>
  );
}
