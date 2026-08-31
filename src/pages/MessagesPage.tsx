import React, { useCallback, useEffect, useReducer, useRef } from 'react';
import { AlertCircle, ArrowLeft, Clock, Loader2, MessageSquare, Send, User } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useRealtimeAvailability } from '../hooks/useRealtimeAvailability';
import {
  CHAT_MESSAGE_FIELDS,
  mergeChatMessages,
  registerRealtimeChannel,
  toChatMessage,
  toChatMessages,
} from '../lib/chatLifecycle';
import { supabase } from '../lib/supabase';
import type { Conversation, Message } from '../types/database';

interface MessagesPageProps {
  onNavigate: (tab: string) => void;
}

const MESSAGE_PAGE_SIZE = 30;

interface ChatState {
  conversation: Conversation | null;
  messages: Message[];
  inputText: string;
  loading: boolean;
  sending: boolean;
  hasMore: boolean;
  offset: number;
  errorMessage: string | null;
  retryNonce: number;
}

const INITIAL_CHAT_STATE: ChatState = {
  conversation: null,
  messages: [],
  inputText: '',
  loading: true,
  sending: false,
  hasMore: false,
  offset: 0,
  errorMessage: null,
  retryNonce: 0,
};

function chatReducer(
  state: ChatState,
  update: Partial<ChatState> | ((state: ChatState) => Partial<ChatState>),
): ChatState {
  return { ...state, ...(typeof update === 'function' ? update(state) : update) };
}

export default function MessagesPage({ onNavigate }: MessagesPageProps) {
  const { user, profile } = useAuth();
  const { isOnline, isRealtimeAvailable } = useRealtimeAvailability();
  const [chat, updateChat] = useReducer(chatReducer, INITIAL_CHAT_STATE);
  const { conversation, messages, inputText, loading, sending, hasMore, offset, errorMessage, retryNonce } = chat;
  const chatEndRef = useRef<HTMLDivElement>(null);
  const userGeneration = useRef(0);

  const scrollToBottom = useCallback(() => {
    window.setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  useEffect(() => {
    userGeneration.current += 1;
    updateChat({ ...INITIAL_CHAT_STATE, loading: Boolean(user?.id) });
  }, [user?.id]);

  useEffect(() => {
    if (!user || !isRealtimeAvailable || conversation) return;
    let active = true;
    updateChat({ loading: true, errorMessage: null });

    void supabase.rpc('ensure_conversation').single().then(({ data, error }) => {
      if (!active) return;
      if (error || !data) {
        updateChat({ errorMessage: 'The support conversation could not be opened. Please try again.', loading: false });
        return;
      }
      updateChat({ conversation: data as Conversation });
    });
    return () => { active = false; };
  }, [user?.id, isRealtimeAvailable, conversation, retryNonce]);

  const fetchMessages = useCallback(async (currentOffset: number, append = false) => {
    if (!conversation) return;
    const generation = userGeneration.current;
    const isCurrentUser = () => generation === userGeneration.current;
    if (currentOffset === 0) updateChat({ loading: true });
    updateChat({ errorMessage: null });
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(CHAT_MESSAGE_FIELDS)
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(currentOffset, currentOffset + MESSAGE_PAGE_SIZE - 1);
      if (error) throw error;

      const rows = toChatMessages(data);
      const page = [...rows].reverse();
      if (!isCurrentUser()) return;
      updateChat(current => ({
        messages: append ? mergeChatMessages(current.messages, page) : page,
        hasMore: rows.length === MESSAGE_PAGE_SIZE,
      }));

      if (currentOffset === 0 && rows.some(message => message.sender_role === 'admin' && !message.read_by_student)) {
        const { error: readError } = await supabase.rpc('mark_conversation_messages_read_by_student', {
          p_conversation_id: conversation.id,
        });
        if (isCurrentUser() && !readError) window.dispatchEvent(new Event('student-chat-read'));
      }
      if (isCurrentUser() && currentOffset === 0) scrollToBottom();
    } catch (error) {
      if (!isCurrentUser()) return;
      console.error('Failed to load student chat:', error);
      updateChat({ errorMessage: 'Messages could not be loaded. Check your connection and retry.' });
    } finally {
      if (currentOffset === 0 && generation === userGeneration.current) updateChat({ loading: false });
    }
  }, [conversation, scrollToBottom, updateChat]);

  useEffect(() => {
    if (!conversation || !isRealtimeAvailable) return;
    updateChat({ offset: 0 });
    void fetchMessages(0);
  }, [conversation, isRealtimeAvailable, fetchMessages]);

  useEffect(() => {
    if (!conversation || !isRealtimeAvailable) return;
    const channelName = `student_chat_messages_${conversation.id}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversation.id}`,
      }, async payload => {
        const message = toChatMessage(payload.new);
        if (!message) return;
        const generation = userGeneration.current;
        if (message.sender_role === 'admin' && !message.read_by_student) {
          const { error } = await supabase.rpc('mark_conversation_messages_read_by_student', {
            p_conversation_id: conversation.id,
          });
          if (generation === userGeneration.current && !error) window.dispatchEvent(new Event('student-chat-read'));
        }
        if (generation !== userGeneration.current) return;
        updateChat(current => ({ messages: mergeChatMessages(current.messages, [message]) }));
        scrollToBottom();
      })
      .subscribe();
    const unregister = registerRealtimeChannel(channelName);
    return () => {
      unregister();
      void supabase.removeChannel(channel);
    };
  }, [conversation, isRealtimeAvailable, scrollToBottom, updateChat]);

  const loadOlder = async () => {
    const nextOffset = offset + MESSAGE_PAGE_SIZE;
    updateChat({ offset: nextOffset });
    await fetchMessages(nextOffset, true);
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !conversation || !isOnline || sending || !inputText.trim()) return;
    const content = inputText.trim();
    const generation = userGeneration.current;
    updateChat({ inputText: '', sending: true });
    try {
      const { data, error } = await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        sender_role: 'student',
        content,
      }).select(CHAT_MESSAGE_FIELDS).single();
      if (error) throw error;
      const message = toChatMessage(data);
      if (generation !== userGeneration.current) return;
      if (message) updateChat(current => ({ messages: mergeChatMessages(current.messages, [message]) }));
      scrollToBottom();
    } catch (error) {
      if (generation !== userGeneration.current) return;
      console.error('Failed to send student message:', error);
      updateChat({ inputText: content, errorMessage: 'Your message was not sent. Please retry.' });
    } finally {
      if (generation === userGeneration.current) updateChat({ sending: false });
    }
  };

  if (!user || !profile) return null;

  return (
    <div className="min-h-screen bg-[var(--color-bg-cream,#FAF7EA)] px-4 py-8 font-sans sm:px-6 sm:py-12">
      <div className="mx-auto flex h-[75vh] max-w-4xl flex-col overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between bg-[var(--color-primary-green,#1A3C2E)] px-4 py-4 text-white sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => onNavigate('home')} className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white" aria-label="Back to home">
              <ArrowLeft size={18} />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#F5B400]/40 bg-white/10">
              <MessageSquare size={18} className="text-[#F5B400]" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight">Council Direct Support</h1>
              <p className="font-mono text-[10px] text-white/60">Scoped student conversation</p>
            </div>
          </div>
          <span className={`text-[10px] font-bold ${isOnline ? 'text-emerald-300' : 'text-amber-300'}`}>{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        <div className="flex flex-1 flex-col space-y-4 overflow-y-auto bg-zinc-50/50 p-4 sm:p-6">
          {errorMessage && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <span>{errorMessage}</span>
              <button onClick={() => conversation ? void fetchMessages(0) : updateChat({ retryNonce: retryNonce + 1 })} className="font-bold underline">Retry</button>
            </div>
          )}
          {!isOnline && <p className="rounded-xl border border-zinc-200 bg-white p-3 text-center text-xs text-zinc-500">Chat is paused while you are offline.</p>}
          {loading ? (
            <div className="flex flex-1 items-center justify-center"><Loader2 className="animate-spin text-[#1A3C2E]" size={24} /></div>
          ) : (
            <>
              {hasMore && <button onClick={() => void loadOlder()} className="mx-auto rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-[10px] font-bold uppercase text-[#1A3C2E]">Load older messages</button>}
              {messages.length === 0 ? (
                <div className="m-auto max-w-md text-center">
                  <MessageSquare className="mx-auto mb-3 text-[#F5B400]" size={28} />
                  <h2 className="text-sm font-bold text-[#1A3C2E]">Start a conversation</h2>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">Ask the Student Council about events, tickets, or portal support.</p>
                </div>
              ) : (
                <div className="mt-auto space-y-3.5">
                  {messages.map(message => {
                    const fromAdmin = message.sender_role === 'admin';
                    return (
                      <div key={message.id} className={`flex ${fromAdmin ? 'justify-start' : 'justify-end'}`}>
                        <div className={`flex max-w-[85%] items-start gap-2 ${fromAdmin ? '' : 'flex-row-reverse'}`}>
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white"><User size={12} /></span>
                          <div>
                            <div className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-xs ${fromAdmin ? 'rounded-tl-none border border-zinc-150 bg-white text-[#222B26]' : 'rounded-tr-none bg-[#1A3C2E] text-[#FAF7EA]'}`}>
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>
                            </div>
                            <span className={`mt-1 flex items-center gap-1 font-mono text-[9px] text-zinc-400 ${fromAdmin ? '' : 'justify-end'}`}>
                              <Clock size={8} /> {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

        <form onSubmit={handleSend} className="shrink-0 border-t border-zinc-100 bg-white p-4">
          <div className="flex items-center gap-2">
            <input value={inputText} onChange={event => updateChat({ inputText: event.target.value })} disabled={loading || sending || !isOnline} maxLength={1000} placeholder={isOnline ? 'Type your message...' : 'Reconnect to send a message'} className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs outline-none focus:border-[#F5B400]" />
            <button type="submit" disabled={loading || sending || !isOnline || !inputText.trim()} className="rounded-xl bg-[#F5B400] p-2.5 text-[#1A3C2E] disabled:opacity-50" aria-label="Send message">
              {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            </button>
          </div>
          <p className="mt-2 flex items-center justify-end gap-1 font-mono text-[9px] text-stone-400"><AlertCircle size={10} /> Messages are visible to authorized CCIS support staff.</p>
        </form>
      </div>
    </div>
  );
}
