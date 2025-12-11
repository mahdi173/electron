
// src/renderer/src/services/api.ts
import axios, { InternalAxiosRequestConfig } from 'axios'
import { useSessionStore } from '@renderer/store/session'

/**
 * Prefer .env override, fallback to your existing URL.
 * In your renderer .env: VITE_API_BASE_URL=http://127.0.0.1:3900/api
 */
const API_BASE_URL =
  (import.meta as any)?.env?.VITE_API_BASE_URL || 'http://127.0.0.1:3900/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

/**
 * Safe token getter:
 * - First try Pinia store (preferred)
 * - Fallback to localStorage (works even if store not yet active)
 */
function getTokenSafely(): string | undefined {
  try {
    const store = useSessionStore()
    if (store?.token) return store.token
  } catch {
    // Pinia might not be ready during very early imports
  }
  const t = localStorage.getItem('token')
  return t || undefined
}

// Attach Bearer token if available
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getTokenSafely()
  if (token) {
    config.headers = config.headers ?? {}
    ;(config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }
  return config
})

export default api
