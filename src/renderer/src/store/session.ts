
import { defineStore } from 'pinia'

export interface User {
  id: number
  email: string
  displayName?: string
}

function loadUserFromStorage(): User | null {
  const u = localStorage.getItem('user')
  if (!u) return null
  try {
    return JSON.parse(u) as User
  } catch {
    return null
  }
}

export const useSessionStore = defineStore('session', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: loadUserFromStorage() as User | null,
  }),
  actions: {
    /** Persist current session to localStorage */
    save() {
      if (this.token) localStorage.setItem('token', this.token)
      if (this.user) localStorage.setItem('user', JSON.stringify(this.user))
    },

    /** Clear session (state + localStorage) */
    clear() {
      this.token = ''
      this.user = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    },

    /** Optional: explicitly reload from localStorage */
    load() {
      this.token = localStorage.getItem('token') || ''
      this.user = loadUserFromStorage()
    },
  },
})
