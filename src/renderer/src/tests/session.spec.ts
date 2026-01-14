import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSessionStore, type User } from '../store/session'

describe('useSessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('initializes state from empty localStorage', () => {
    const store = useSessionStore()
    expect(store.token).toBe('')
    expect(store.user).toBeNull()
  })

  it('initializes state from existing localStorage', () => {
    localStorage.setItem('token', 'abc123')
    const user: User = { id: 7, email: 'u@example.com', displayName: 'User' }
    localStorage.setItem('user', JSON.stringify(user))

    const store = useSessionStore()

    expect(store.token).toBe('abc123')
    expect(store.user).toEqual(user)
  })

  it('gracefully handles invalid user JSON on init', () => {
    localStorage.setItem('user', '{bad json')
    const store = useSessionStore()

    expect(store.user).toBeNull()
  })

  it('save() persists token and user to localStorage (only when present)', () => {
    const store = useSessionStore()

    // When token or user are empty, save() should not write them
    store.save()
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()

    // Set and save
    store.token = 'tok_456'
    store.user = { id: 1, email: 'john@doe.com', displayName: 'John' }
    store.save()

    expect(localStorage.getItem('token')).toBe('tok_456')
    expect(localStorage.getItem('user')).toBe(JSON.stringify(store.user))
  })

  it('clear() wipes state and localStorage', () => {
    localStorage.setItem('token', 'abc')
    localStorage.setItem('user', JSON.stringify({ id: 10, email: 'a@b.c' }))

    const store = useSessionStore()
    // ensure it loaded
    expect(store.token).toBe('abc')
    expect(store.user).toEqual({ id: 10, email: 'a@b.c' })

    store.clear()

    expect(store.token).toBe('')
    expect(store.user).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('load() re-reads from localStorage', () => {
    const store = useSessionStore()
    // set different values after store creation to validate re-load
    localStorage.setItem('token', 'late_token')
    localStorage.setItem('user', JSON.stringify({ id: 2, email: 'late@ex.com' }))

    // store still has initial state before calling load()
    expect(store.token).toBe('')
    expect(store.user).toBeNull()

    store.load()

    expect(store.token).toBe('late_token')
    expect(store.user).toEqual({ id: 2, email: 'late@ex.com' })
  })

  it('load() handles corrupted user JSON', () => {
    const store = useSessionStore()
    localStorage.setItem('token', 't')
    localStorage.setItem('user', '{not json')
    store.load()

    expect(store.token).toBe('t')
    expect(store.user).toBeNull()
  })

  it('save() should not overwrite with empty values', () => {
    // if only token is set, ensure user key remains untouched
    localStorage.setItem('user', JSON.stringify({ id: 3, email: 'kept@ex.com' }))
    const store = useSessionStore()
    store.user = null
    store.token = 'x'
    store.save()

    expect(localStorage.getItem('token')).toBe('x')
    // user should remain the previous value (no overwrite to "null" or empty)
    expect(localStorage.getItem('user')).toBe(JSON.stringify({ id: 3, email: 'kept@ex.com' }))
  })
})
