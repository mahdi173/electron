
// src/stores/chat.ts
import { IChatMessage } from '@renderer/types/IChatMessage'

type MessagesByRoom = Record<string, IChatMessage[]>


export interface IChatState {
  connecting: boolean;
  connected: boolean;
  loading: boolean;
  error: string | null;
  messagesByRoom: MessagesByRoom;
  currentUserId: number | null;
  apiBase: string;
  jwt: string;
  pendingAckTimers: Map<string, any>;
  unreadByRoom: Record<string, number>;
}
