
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUsersStore } from '../store/user'

/**
 * Helpers
 */
function mockFetchOnce(ok: boolean, payload: any, status = 200) {
  const json = typeof payload === 'function' ? payload : () => payload
  globalThis.fetch = vi.fn(async () => ({
    ok,
    status,
    json: async () => json(),
  })) as any
}

function mockFetchReject(errMsg: string) {
  globalThis.fetch = vi.fn(async () => {
    throw new Error(errMsg)
  }) as any
}

describe('users store', () => {
  let store: ReturnType<typeof useUsersStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useUsersStore()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initial state is correct', () => {
    expect(store.byId).toEqual({})
    expect(store.allIds).toEqual([])
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.fetchedOnce).toBe(false)
    expect(store.presenceById).toEqual({})
  })

  it('getters: users, usersById, getById, usersExcept', () => {
    // Seed some data via upsertMany to also test normalization
    store.upsertMany([
      { id: 2, email: 'b@example.com', displayName: 'Bob' },
      { id: 1, email: 'a@example.com', display_name: 'Alice' }, // snake case normalized
      { id: 3, email: 'c@example.com', displayName: 'Charlie' },
    ])

    // Sorted by displayName: Alice, Bob, Charlie
    expect(store.allIds).toEqual([1, 2, 3])

    const users = store.users
    expect(users.map(u => u?.displayName)).toEqual(['Alice', 'Bob', 'Charlie'])

    expect(store.usersById[1]?.email).toBe('a@example.com')

    expect(store.getById(2)).toEqual({
      id: 2, email: 'b@example.com', displayName: 'Bob'
    })

    expect(store.getById(999)).toBeNull()

    const except2 = store.usersExcept(2)
    expect(except2.map(u => u.id)).toEqual([1, 3])

    const exceptNull = store.usersExcept(null)
    expect(exceptNull.map(u => u.id)).toEqual([1, 2, 3])
  })

  it('upsertMany: dedup + merges fields + ignores invalid ids + sorts by displayName', () => {
    // First insert
    store.upsertMany([
      { id: '10', email: 'j@example.com', displayName: 'Jane', birth_date: '1990-01-01' }, // normalization + snake_case
      { id: 11, email: 'k@example.com', displayName: 'Karl' },
      { id: null, email: 'x@example.com', displayName: 'NoId' }, // invalid id
      { id: NaN, email: 'y@example.com', displayName: 'NaN' }, // invalid id
    ])

    expect(store.allIds).toEqual([11, 10].sort((a, b) => {
      const A = store.byId[a]?.displayName?.toLowerCase() || ''
      const B = store.byId[b]?.displayName?.toLowerCase() || ''
      return A.localeCompare(B)
    }))

    expect(store.byId[10]).toMatchObject({
      id: 10,
      email: 'j@example.com',
      displayName: 'Jane',
      birthDate: '1990-01-01',
    })

    // Upsert with merge and dedup
    store.upsertMany([
      { id: 10, display_name: 'Jane Roe', created_at: '2020-05-05' },
      { id: 11, displayName: 'Karl' }, // duplicate entry, same displayName
      { id: 12, email: 'l@example.com', displayName: 'alice' }, // lower-case name to test sorting
    ])

    // 10 should have merged fields
    expect(store.byId[10]).toMatchObject({
      id: 10,
      email: 'j@example.com',
      displayName: 'Jane Roe',
      birthDate: '1990-01-01',
      createdAt: '2020-05-05',
    })

    // allIds should be unique and sorted by displayName (case-insensitive)
    const namesById = store.allIds.map(id => store.byId[id]?.displayName?.toLowerCase())
    const sorted = [...namesById].sort((a, b) => a.localeCompare(b))
    expect(namesById).toEqual(sorted)
    expect(new Set(store.allIds).size).toBe(store.allIds.length)
  })

  it('setPresence sets online/offline per id', () => {
    store.setPresence(1, true)
    expect(store.presenceById[1]).toBe('online')

    store.setPresence(1, false)
    expect(store.presenceById[1]).toBe('offline')
  })

  describe('fetchAll', () => {
    const apiBase = 'http://localhost:7777'
    const token = 'test-token'

    it('does nothing if apiBase or token missing', async () => {
      await store.fetchAll('', token)
      expect(store.loading).toBe(false)
      expect(store.fetchedOnce).toBe(false)

      await store.fetchAll(apiBase, '')
      expect(store.loading).toBe(false)
      expect(store.fetchedOnce).toBe(false)
    })

    it('loads users successfully and sets fetchedOnce', async () => {
      mockFetchOnce(true, [
        { id: 1, email: 'a@example.com', displayName: 'Alice' },
        { id: 2, email: 'b@example.com', display_name: 'Bob' },
      ])
      const p = store.fetchAll(apiBase, token)
      expect(store.loading).toBe(true)
      await p
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
      expect(store.fetchedOnce).toBe(true)
      expect(store.allIds).toEqual([1, 2]) // sorted by displayName A..B
    })

    it('handles HTTP error', async () => {
      globalThis.fetch = vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => [],
      })) as any
      await store.fetchAll(apiBase, token)
      expect(store.loading).toBe(false)
      expect(store.error).toMatch(/HTTP 500/)
    })

    it('handles network error', async () => {
      mockFetchReject('Network down')
      await store.fetchAll(apiBase, token)
      expect(store.loading).toBe(false)
      expect(store.error).toBe('Network down')
    })
  })

  describe('fetchByIds', () => {
    const apiBase = 'http://localhost:7777'
    const token = 'test-token'

    beforeEach(() => {
      // Pre-cache user 1 so that it won't be fetched again
      store.upsertMany([{ id: 1, email: 'a@example.com', displayName: 'Alice' }])
    })

    it('skips when no missing ids', async () => {
      const spy = vi.spyOn(globalThis, 'fetch')
      await store.fetchByIds(apiBase, token, [1])
      expect(spy).not.toHaveBeenCalled()
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('fetches only missing ids and upserts', async () => {
      mockFetchOnce(true, [
        { id: 2, email: 'b@example.com', displayName: 'Bob' },
        { id: 3, email: 'c@example.com', displayName: 'Charlie' },
      ])
      const p = store.fetchByIds(apiBase, token, [1, 2, 3])
      expect(store.loading).toBe(true)
      await p
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
      expect(store.getById(2)?.displayName).toBe('Bob')
      expect(store.getById(3)?.displayName).toBe('Charlie')
      // should be sorted by displayName (Alice, Bob, Charlie)
      expect(store.allIds).toEqual([1, 2, 3])
      // Expect endpoint was called with only missing ids
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${apiBase}/api/users?ids=${encodeURIComponent('2,3')}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          }),
        })
      )
    })

    it('handles HTTP error', async () => {
      globalThis.fetch = vi.fn(async () => ({
        ok: false,
        status: 404,
        json: async () => [],
      })) as any
      await store.fetchByIds(apiBase, token, [2])
      expect(store.loading).toBe(false)
      expect(store.error).toMatch(/HTTP 404/)
    })

    it('handles network error', async () => {
      mockFetchReject('Network down')
      await store.fetchByIds(apiBase, token, [2])
      expect(store.loading).toBe(false)
      expect(store.error).toBe('Network down')
    })
  })

  describe('search', () => {
    const apiBase = 'http://localhost:7777'
    const token = 'test-token'

    it('returns [] when query empty/whitespace', async () => {
      const r1 = await store.search(apiBase, token, '')
      const r2 = await store.search(apiBase, token, '   ')
      expect(r1).toEqual([])
      expect(r2).toEqual([])
      expect(store.loading).toBe(false)
    })

    it('returns matched ids and upserts cache', async () => {
      mockFetchOnce(true, [
        { id: 42, email: 'x@example.com', displayName: 'Xavier' },
        { id: 7, email: 'g@example.com', display_name: 'George' },
      ])
      const p = store.search(apiBase, token, 'ge')
      expect(store.loading).toBe(true)
      const ids = await p
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
      expect(ids).toEqual([42, 7])
      expect(store.getById(7)?.displayName).toBe('George')
      expect(store.getById(42)?.displayName).toBe('Xavier')
      // Sort stable
      const names = store.allIds.map(id => store.byId[id]?.displayName)
      const sortedNames = [...names].sort((a, b) =>
        (a ?? '').toLowerCase().localeCompare((b ?? '').toLowerCase())
      )
      expect(names).toEqual(sortedNames)
    })

    it('handles HTTP error returns []', async () => {
      globalThis.fetch = vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => [],
      })) as any
      const ids = await store.search(apiBase, token, 'bob')
      expect(store.loading).toBe(false)
      expect(store.error).toMatch(/HTTP 500/)
      expect(ids).toEqual([])
    })

    it('handles network error returns []', async () => {
      mockFetchReject('Network down')
      const ids = await store.search(apiBase, token, 'bob')
      expect(store.loading).toBe(false)
      expect(store.error).toBe('Network down')
      expect(ids).toEqual([])
    })
  })

  it('clear resets the store', () => {
    store.upsertMany([{ id: 1, email: 'a@example.com', displayName: 'Alice' }])
    store.setPresence(1, true)
    store.loading = true
    store.error = 'x'
    store.fetchedOnce = true

    store.clear()

    expect(store.byId).toEqual({})
    expect(store.allIds).toEqual([])
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.fetchedOnce).toBe(false)
    expect(store.presenceById).toEqual({})
  })
})
