
// src/stores/chat.ts
import { defineStore } from 'pinia'
import { io, type Socket } from 'socket.io-client'

type MsgSender = { id: number; displayName?: string; email?: string }
type ChatMessage = {
  id?: number
  room: string
  sender: MsgSender
  content: string
  createdAt: string
}
type MessagesByRoom = Record<string, ChatMessage[]>

export const useChatStore = defineStore('chat', {
  state: () => ({
    socket: null as Socket | null,
    connecting: false,
    connected: false,
    loading: false,
    error: null as string | null,
    messagesByRoom: {} as MessagesByRoom,
  }),
  actions: {
    _attachSocketHandlers() {
      if (!this.socket) return
      this.socket.on('connect', () => { this.connected = true; this.connecting = false })
      this.socket.on('disconnect', () => { this.connected = false })
      this.socket.on('message:new', (msg: ChatMessage) => {
        const list = this.messagesByRoom[msg.room] ?? []
        this.messagesByRoom[msg.room] = [...list, msg]
      })
      this.socket.on('error', (payload: any) => {
        this.error = typeof payload?.error === 'string' ? payload.error : 'Socket error'
      })
    },

    async connectSocket(jwt: string) {
      if (this.socket?.connected) { this.connected = true; return }
      this.connecting = true
      this.error = null
      const url = 'http://localhost:3900'
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

    // ⬇️ IMPORTANT: send Authorization header
    async fetchHistory(apiBase: string, room: string, jwt: string) {
      this.loading = true
      this.error = null
      try {
        const res = await fetch(
          `${apiBase}/api/messages?room=${encodeURIComponent(room)}`,
          {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${jwt}`,
            },
          }
        )
        if (res.status === 401) throw new Error('Unauthorized (401)')
        if (!res.ok) throw new Error(`Failed: ${res.status} ${res.statusText}`)
        const rows = (await res.json()) as any[]

        const msgs: ChatMessage[] = rows.map((r: any) => ({
          id: r.id,
          room: r.room,
          sender: {
            id: r.sender?.id ?? r.sender_id ?? 0,
            displayName: r.sender?.displayName ?? r.display_name ?? '',
            email: r.sender?.email ?? r.email ?? '',
          },
          content: r.content,
          createdAt: r.created_at ?? r.createdAt ?? new Date().toISOString(),
        }))
        this.messagesByRoom[room] = msgs
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load history'
      } finally {
        this.loading = false
      }
    },

    async sendMessage(room: string, content: string) {
      if (!this.socket || !this.connected) throw new Error('Not connected')
      this.socket.emit('message:send', { room, content })
    },
  },
})
