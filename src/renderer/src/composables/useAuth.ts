
// src/renderer/src/composables/useAuth.ts
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@renderer/services/api'
import { useSessionStore } from '@renderer/store/session'

type Mode = 'login' | 'signup'

type User = {
  email: string
  password: string
  username?: string
  birthDate?: string // yyyy-mm-dd
}

/** Error message extractor (Axios or generic errors) */
function getErrorMessage(e: unknown, fallback: string): string {
  const anyErr = e as any
  return (
    anyErr?.response?.data?.error ||
    anyErr?.response?.data?.message ||
    anyErr?.message ||
    fallback
  )
}

/** Validators */
const isEmailValid = (email: string) => /\S+@\S+\.\S+/.test(email)
const isPasswordValid = (pwd: string) => typeof pwd === 'string' && pwd.length >= 6
const isUsernameValid = (name?: string) => !!name && /^[A-Za-z0-9_]{3,30}$/.test(name)

const isBirthValidAnd13Plus = (birth?: string) => {
  if (!birth) return false
  const d = new Date(birth)
  if (Number.isNaN(d.getTime())) return false
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--
  return age >= 13
}

export function useAuth(mode: Mode, user: User) {
  const router = useRouter()
  const sessionStore = useSessionStore()

  // state
  const loading = ref(false)
  const error = ref('')

  // field-level errors
  const emailError = ref('')
  const passwordError = ref('')
  const usernameError = ref('')
  const birthError = ref('')

  // UI-only helper (does not block submit)
  const canSubmit = computed(() => {
    const okEmail = isEmailValid(user.email)
    const okPwd = isPasswordValid(user.password)
    if (mode === 'login') return okEmail && okPwd
    return okEmail && okPwd && isUsernameValid(user.username) && isBirthValidAnd13Plus(user.birthDate)
  })

  function clearFieldErrors() {
    emailError.value = ''
    passwordError.value = ''
    usernameError.value = ''
    birthError.value = ''
  }

  function validateFields(): boolean {
    clearFieldErrors()
    let ok = true

    if (!isEmailValid(user.email)) {
      emailError.value = 'Please enter a valid email address.'
      ok = false
    }
    if (!isPasswordValid(user.password)) {
      passwordError.value = 'Password must be at least 6 characters.'
      ok = false
    }
    if (mode === 'signup') {
      if (!isUsernameValid(user.username)) {
        usernameError.value = 'Username must be 3–30 chars (letters, numbers, underscores).'
        ok = false
      }
      if (!isBirthValidAnd13Plus(user.birthDate)) {
        birthError.value = 'You must be at least 13 years old.'
        ok = false
      }
    }
    return ok
  }

  async function submit() {
    if (loading.value) return
    error.value = ''

    if (!validateFields()) return

    loading.value = true
    try {
      type AuthResponse = { token: string; user: unknown }
      let data: AuthResponse

      if (mode === 'login') {
        const res = await api.post<AuthResponse>('/auth/login', {
          email: user.email,
          password: user.password,
        })
        data = res.data
      } else {
        const res = await api.post<AuthResponse>('/auth/signup', {
          email: user.email,
          password: user.password,
          displayName: user.username,
          birthDate: user.birthDate,
        })
        data = res.data
      }

      // Save to Pinia + persist
      sessionStore.token = data.token
      sessionStore.user = data.user as any
      sessionStore.save()

      await router.push({ name: 'home' })
    } catch (e) {
      error.value = getErrorMessage(e, mode === 'login' ? 'Login failed' : 'Signup failed')
    } finally {
      loading.value = false
    }
  }

  return {
    // state
    loading,
    error,
    // field errors
    emailError,
    passwordError,
    usernameError,
    birthError,
    // derived
    canSubmit,
    // actions
    submit,
    // utilities (optional)
    validateFields,
    clearFieldErrors,
  }
}
