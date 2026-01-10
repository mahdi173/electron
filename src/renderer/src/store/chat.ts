
// src/stores/chat.ts
import { defineStore } from 'pinia'
import { io, type Socket } from 'socket.io-client'

export type MsgSender = {
  id: number
  displayName?: string
  email?: string
}

export type ChatMessage = {
  id?: number
  room: string
  sender: MsgSender
  content: string
  createdAt: string
  // client-only
  _tempId?: string
  _status?: 'sending' | 'sent' | 'error'
}

type MessagesByRoom = Record<string, ChatMessage[]>

// --- helpers (inline to keep one file) ---
const keyOf = (m: ChatMessage) =>
  m.id != null
    ? `id:${m.id}`
    : m._tempId
    ? `tmp:${m._tempId}`
    : `room:${m.room}|sender:${m.sender?.id ?? 'x'}|at:${m.createdAt}|hash:${hash(m.content)}`

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h >>> 0
}

function dedupeAppend(list: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const idx = list.findIndex((x) => keyOf(x) === keyOf(incoming))
  if (idx >= 0) {
    const copy = list.slice()
    copy[idx] = { ...list[idx], ...incoming, _status: incoming._status ?? 'sent', _tempId: undefined }
    return copy
  }
  return [...list, incoming]
}

function findOptimisticIndex(
  list: ChatMessage[],
  opts: { tempId?: string; content?: string; senderId?: number }
): number {
  const { tempId, content, senderId } = opts
  if (tempId) {
    const i = list.findIndex((m) => m._tempId === tempId)
    if (i >= 0) return i
  }
  // Heuristic: last sending with same sender/content
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i]
    if (m._status === 'sending') {
      const okSender = senderId != null ? Number(m.sender?.id) === Number(senderId) : true
      const okContent = content != null ? m.content === content : true
      if (okSender && okContent) return i
    }
  }
  return -1
}

// --- store ---
export const useChatStore = defineStore('chat', {
  state: () => ({
    socket: null as Socket | null,
    connecting: false,
    connected: false,
    loading: false,
    error: null as string | null,

    messagesByRoom: {} as MessagesByRoom,

    currentUserId: null as number | null, // set from session or socket

    apiBase: '' as string,
    jwt: '' as string,

    pendingAckTimers: new Map<string, any>(), // tempId -> timeout
    unreadByRoom: {} as Record<string, number>,
  }),

  getters: {
    messagesForRoom: (state) => (room: string) => state.messagesByRoom[room] ?? [],
    messagesWithMeta:
      (state) =>
      (room: string): (ChatMessage & { isMine: boolean })[] =>
        (state.messagesByRoom[room] ?? []).map((m) => ({
          ...m,
          isMine: state.currentUserId != null && m.sender?.id != null
            ? Number(m.sender.id) === Number(state.currentUserId)
            : false,
        })),
  },

  actions: {
    setCurrentUserId(id: number) {
      this.currentUserId = Number(id)
    },
    setAuth({ apiBase, jwt }: { apiBase: string; jwt: string }) {
      this.apiBase = apiBase
      this.jwt = jwt
    },

    _attachSocketHandlers() {
      if (!this.socket) return

      this.socket.on('connect', () => {
        this.connected = true
        this.connecting = false
      })

      this.socket.on('disconnect', () => {
        this.connected = false
      })

      // Identify "me" early
      
      this.socket.on('session:user', (u: { id: number; displayName?: string; email?: string }) => {
        if (u?.id) this.setCurrentUserId(Number(u.id));
      });


      // Server echo
      this.socket.on('message:new', (raw: any) => {
        const normalized: ChatMessage = {
          id: raw?.id,
          room: String(raw?.room),
          sender: { id: Number(raw?.sender?.id ?? 0), displayName: raw?.sender?.displayName ?? '', email: raw?.sender?.email ?? '' },
          content: String(raw?.content ?? ''),
          createdAt: String(raw?.createdAt ?? new Date().toISOString()),
          _status: 'sent',
          _tempId: undefined,
        }

        const clientId = (raw?.clientId ?? raw?.tempId) as string | undefined
        const list = this.messagesByRoom[normalized.room] ?? []

        // Try to upgrade optimistic
        const idx = findOptimisticIndex(list, {
          tempId: clientId,
          content: normalized.content,
          senderId: normalized.sender.id,
        })
        if (idx >= 0) {
          const copy = list.slice()
          copy[idx] = {
            ...copy[idx],
            id: normalized.id,
            content: normalized.content,
            sender: normalized.sender,
            createdAt: normalized.createdAt,
            _status: 'sent',
            _tempId: undefined,
          }
          this.messagesByRoom[normalized.room] = copy
          if (clientId && this.pendingAckTimers.has(clientId)) {
            clearTimeout(this.pendingAckTimers.get(clientId))
            this.pendingAckTimers.delete(clientId)
          }
          return
        }

        // Else append as new incoming
        this.messagesByRoom[normalized.room] = dedupeAppend(list, normalized)
        const isMine = this.currentUserId != null && Number(normalized.sender.id) === Number(this.currentUserId)
        if (!isMine) {
          this.incrementUnread(normalized.room)
        }
      })

      // Sender-only ack
      this.socket.on('message:sent:ack', (payload: { room: string; id: number; tempId?: string }) => {
        const list = this.messagesByRoom[payload.room] ?? []
        if (!list.length) return

        const idx = list.findIndex((m) => (payload.tempId ? m._tempId === payload.tempId : m.id === payload.id))
        if (idx < 0) return

        const copy = list.slice()
        copy[idx] = { ...copy[idx], id: payload.id, _status: 'sent', _tempId: undefined }
        this.messagesByRoom[payload.room] = copy

        if (payload.tempId && this.pendingAckTimers.has(payload.tempId)) {
          clearTimeout(this.pendingAckTimers.get(payload.tempId))
          this.pendingAckTimers.delete(payload.tempId)
        }
      })

      this.socket.on('error', (payload: any) => {
        this.error = typeof payload?.error === 'string' ? payload.error : 'Socket error'
      })
    },

    async connectSocket(jwt: string) {
      if (this.socket?.connected) {
        this.connected = true
        return
      }
      this.connecting = true
      this.error = null

      const url = 'http://localhost:3900' // TODO: env/config
      const socket = io(url, { transports: ['websocket'], auth: { token: jwt } })
      this.socket = socket
      this._attachSocketHandlers()
    },

    async joinRoom(room: string) {
      if (!this.socket || !this.connected) return
      this.socket.emit('room:join', { room })
    },

    leaveRoom(room: string) {
      if (!this.socket || !this.connected) return
      this.socket.emit('room:leave', { room })
    },

    async fetchHistory(apiBase: string, room: string, jwt: string) {
      this.loading = true
      this.error = null
      try {
        const res = await fetch(`${apiBase}/api/messages?room=${encodeURIComponent(room)}`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${jwt}` },
        })
        if (res.status === 401) throw new Error('Unauthorized (401)')
        if (!res.ok) throw new Error(`Failed: ${res.status} ${res.statusText}`)

        const rows = (await res.json()) as any[]
        const msgs: ChatMessage[] = rows.map((r) => ({
          id: r.id,
          room: r.room,
          sender: { id: Number(r.senderId ?? r.sender_id ?? r.user_id ?? 0), displayName: r.displayName ?? '', email: r.email ?? '' },
          content: r.content,
          createdAt: r.createdAt ?? r.created_at ?? new Date().toISOString(),
          _status: 'sent',
        }))
        this.messagesByRoom[room] = msgs
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load history'
      } finally {
        this.loading = false
      }
    },

    async sendMessage(room: string, content: string, opts?: { optimistic?: boolean }) {
      if (!this.socket || !this.connected) throw new Error('Not connected')
      const optimistic = opts?.optimistic ?? true

      let tempId: string | undefined
      if (optimistic) {
        tempId = (crypto as any)?.randomUUID?.() ?? `tmp-${Date.now()}-${Math.random()}`
        const mineId = Number(this.currentUserId ?? -1)
        const optimisticMsg: ChatMessage = {
          _tempId: tempId,
          _status: 'sending',
          room,
          sender: { id: mineId },
          content,
          createdAt: new Date().toISOString(),
        }
        const list = this.messagesByRoom[room] ?? []
        this.messagesByRoom[room] = dedupeAppend(list, optimisticMsg)

        // Timeout to avoid infinite spinner
        const t = setTimeout(() => {
          const cur = this.messagesByRoom[room] ?? []
          const idx = cur.findIndex((m) => m._tempId === tempId)
          if (idx >= 0 && cur[idx]._status === 'sending') {
            const copy = cur.slice()
            copy[idx] = { ...copy[idx], _status: 'error' }
            this.messagesByRoom[room] = copy
          }
          if (tempId) this.pendingAckTimers.delete(tempId)
        }, 12_000)
        if (tempId) this.pendingAckTimers.set(tempId, t)
      }

      this.socket.emit('message:send', { room, content, tempId })
    },

    clearRoom(room: string) {
      delete this.messagesByRoom[room]
    },

    reset() {
      this.socket?.disconnect()
      this.socket = null
      this.connecting = false
      this.connected = false
      this.loading = false
      this.error = null
      this.messagesByRoom = {}
      this.currentUserId = null
      this.apiBase = ''
      this.jwt = ''
      for (const [, t] of this.pendingAckTimers) clearTimeout(t)
      this.pendingAckTimers.clear()
      this.unreadByRoom = {}
    },
    incrementUnread(room: string) {
      const prev = this.unreadByRoom[room] ?? 0
      this.unreadByRoom[room] = prev + 1
    },
    markRoomRead(room: string) {
      if (!room) return
      this.unreadByRoom[room] = 0
    },
  },
})
