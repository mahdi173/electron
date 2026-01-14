import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from '../store/chat'

describe('Chat Store', () => {
  let store: ReturnType<typeof useChatStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useChatStore()
  })

  it('initializes with default state', () => {
    expect(store.connected).toBe(false)
    expect(store.connecting).toBe(false)
    expect(store.messagesByRoom).toEqual({})
    expect(store.currentUserId).toBeNull()
  })

  it('sets current user ID', () => {
    store.setCurrentUserId(42)
    expect(store.currentUserId).toBe(42)
  })

  it('sets auth data', () => {
    store.setAuth({ apiBase: 'http://api.test', jwt: 'token123' })
    expect(store.apiBase).toBe('http://api.test')
    expect(store.jwt).toBe('token123')
  })

  it('adds optimistic message when sending', async () => {
    store.connected = true
    store.currentUserId = 1
    store.socket = { emit: vi.fn() } as any

    await store.sendMessage('room1', 'Hello', { optimistic: true })
    const msgs = store.messagesByRoom['room1']
    expect(msgs.length).toBe(1)
    expect(msgs[0]._status).toBe('sending')
    expect(msgs[0].content).toBe('Hello')
  })

  it('clears a room', () => {
    store.messagesByRoom['room1'] = [{ room: 'room1', sender: { id: 1 }, content: 'Hi', createdAt: 'now' }]
    store.clearRoom('room1')
    expect(store.messagesByRoom['room1']).toBeUndefined()
  })

  it('resets the store', () => {
    store.connected = true
    store.messagesByRoom['room1'] = [{ room: 'room1', sender: { id: 1 }, content: 'Hi', createdAt: 'now' }]
    store.reset()
    expect(store.connected).toBe(false)
    expect(store.messagesByRoom).toEqual({})
    expect(store.currentUserId).toBeNull()
  })

  it('increments and marks unread messages', () => {
    store.incrementUnread('room1')
    expect(store.unreadByRoom['room1']).toBe(1)
    store.markRoomRead('room1')
    expect(store.unreadByRoom['room1']).toBe(0)
  })
})
