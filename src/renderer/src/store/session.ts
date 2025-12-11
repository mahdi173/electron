
import { reactive, watch } from 'vue';

interface User {
  id: number;
  email: string;
  displayName?: string;
}

export const session = reactive({
  token: '',
  user: null as User | null,
});

export function loadSession() {
  const t = localStorage.getItem('token');
  const u = localStorage.getItem('user');
  if (t) session.token = t;
  if (u) session.user = JSON.parse(u);
}

export function saveSession() {
  if (session.token) localStorage.setItem('token', session.token);
  if (session.user) localStorage.setItem('user', JSON.stringify(session.user));
}

export function clearSession() {
  session.token = '';
  session.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// Auto-save whenever session changes
watch(session, saveSession, { deep: true });
