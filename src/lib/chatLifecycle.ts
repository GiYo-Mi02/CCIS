import type { Message } from '../types/database';

export const CHAT_MESSAGE_FIELDS = [
  'id',
  'conversation_id',
  'sender_id',
  'sender_role',
  'content',
  'read_by_student',
  'read_by_admin',
  'created_at',
].join(', ');

const CHAT_CONVERSATION_FIELDS = 'id, profile_id, created_at, last_message_at';

export function toChatMessage(value: unknown): Message | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== 'string'
    || typeof row.conversation_id !== 'string'
    || (row.sender_id !== null && typeof row.sender_id !== 'string')
    || (row.sender_role !== 'student' && row.sender_role !== 'admin')
    || typeof row.content !== 'string'
    || typeof row.created_at !== 'string'
  ) return null;
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id as string | null,
    sender_role: row.sender_role,
    content: row.content,
    read_by_student: row.read_by_student === true,
    read_by_admin: row.read_by_admin === true,
    created_at: row.created_at,
  };
}

export function toChatMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return [];
  return value.map(toChatMessage).filter((message): message is Message => message !== null);
}

export function mergeChatMessages(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map<string, Message>();

  for (const message of [...current, ...incoming]) {
    byId.set(message.id, message);
  }

  return [...byId.values()].sort((left, right) => {
    const timeDifference = new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
    return timeDifference || left.id.localeCompare(right.id);
  });
}

const trackedChannels = new Map<string, number>();

function publishDevelopmentChannelCount() {
  const isDevelopment = Boolean(
    (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV,
  );
  if (!isDevelopment) return;

  const activeCount = getTrackedRealtimeChannelCount();
  (globalThis as typeof globalThis & { __CCIS_ACTIVE_REALTIME_CHANNELS__?: number })
    .__CCIS_ACTIVE_REALTIME_CHANNELS__ = activeCount;
  console.debug(`[Realtime] ${activeCount} active channel${activeCount === 1 ? '' : 's'}`);
}

export function registerRealtimeChannel(channelName: string): () => void {
  trackedChannels.set(channelName, (trackedChannels.get(channelName) || 0) + 1);
  publishDevelopmentChannelCount();

  let registered = true;
  return () => {
    if (!registered) return;
    registered = false;

    const remaining = (trackedChannels.get(channelName) || 1) - 1;
    if (remaining > 0) trackedChannels.set(channelName, remaining);
    else trackedChannels.delete(channelName);
    publishDevelopmentChannelCount();
  };
}

export function getTrackedRealtimeChannelCount(): number {
  return [...trackedChannels.values()].reduce((total, count) => total + count, 0);
}
