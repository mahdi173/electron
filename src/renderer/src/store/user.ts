
// src/stores/users.ts (or @renderer/store/users.ts)
import { defineStore } from 'pinia'

export interface AppUser {
  id: number
  email: string
  displayName: string
  birthDate?: string
  createdAt?: string
}

type ById = Record<number, AppUser>

function normalizeUserRow(row: any): AppUser {
  return {
    id: Number(row.id),
    email: String(row.email),
    displayName: String(row.displayName ?? row.display_name ?? ''),
    birthDate: row.birthDate ?? row.birth_date ?? undefined,
    createdAt: row.createdAt ?? row.created_at ?? undefined,
  }
}

export const useUsersStore = defineStore('users', {
  state: () => ({
    byId: {} as ById,
    allIds: [] as number[],
    loading: false,
    error: null as string | null,
    fetchedOnce: false,
    // Optional: hook presence later via socket
    presenceById: {} as Record<number, 'online' | 'offline'>,
  }),

  getters: {
    users: (s) => s.allIds.map((id) => s.byId[id]).filter(Boolean),
    usersById: (s) => s.byId,
    getById: (s) => (id: number) => s.byId[id] || null,
    usersExcept: (s) => (excludeId?: number | null) =>
      s.allIds.map((id) => s.byId[id]).filter((u) => u && u.id !== Number(excludeId)),
  },

  actions: {
    upsertMany(rows: any[]) {
      const normalized = (rows ?? [])
        .filter(Boolean)
        .map(normalizeUserRow)
        .filter((u) => Number.isFinite(u.id))

      for (const u of normalized) {
        if (!this.byId[u.id]) this.allIds.push(u.id)
        this.byId[u.id] = { ...this.byId[u.id], ...u }
      }

      // Dedup & sort by displayName for stable UI
      this.allIds = Array.from(new Set(this.allIds)).sort((a, b) => {
        const A = this.byId[a]?.displayName?.toLowerCase() || ''
        const B = this.byId[b]?.displayName?.toLowerCase() || ''
        return A.localeCompare(B)
      })
    },

    setPresence(id: number, online: boolean) {
      this.presenceById[id] = online ? 'online' : 'offline'
    },

    async fetchAll(apiBase: string, token: string) {
      if (!apiBase || !token) return
      this.loading = true
      this.error = null
      try {
        const res = await fetch(`${apiBase}/api/users`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        this.upsertMany(data)
        this.fetchedOnce = true
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load users'
      } finally {
        this.loading = false
      }
    },

    /** Fetch only missing users by id array */
    async fetchByIds(apiBase: string, token: string, ids: number[]) {
      const missing = (ids ?? []).map(Number).filter((id) => !this.byId[id])
      if (!missing.length) return
      this.loading = true
      this.error = null
      try {
        // Prefer a dedicated endpoint that accepts comma-separated ids
        const res = await fetch(
          `${apiBase}/api/users?ids=${encodeURIComponent(missing.join(','))}`,
          { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } }
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        this.upsertMany(data)
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load users by ids'
      } finally {
        this.loading = false
      }
    },

    /** Search users server-side; returns the ids matched and upserts cache */
    async search(apiBase: string, token: string, q: string): Promise<number[]> {
      if (!q?.trim()) return []
      this.loading = true
      this.error = null
      try {
        const res = await fetch(`${apiBase}/api/users/search?q=${encodeURIComponent(q)}`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        this.upsertMany(data)
        return (data ?? []).map((r: any) => Number(r.id)).filter(Number.isFinite)
      } catch (e: any) {
        this.error = e?.message ?? 'Search failed'
        return []
      } finally {
        this.loading = false
      }
    },

    clear() {
      this.byId = {}
      this.allIds = []
      this.loading = false
      this.error = null
      this.fetchedOnce = false
      this.presenceById = {}
    },
  },
})