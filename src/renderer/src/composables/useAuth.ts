
// useAuth.ts
import { computed, ref } from 'vue';
import api from '@renderer/services/api';
import { session, saveSession } from '../store/session';
import { useRouter } from 'vue-router';

export function useAuth(mode: 'login' | 'signup', user: { email: string; password: string; displayName?: string }) {
  const loading = ref(false);
  const error = ref('');

  const router = useRouter();           

  const canSubmit = computed(() => {
    const okEmail = !!user.email && /\S+@\S+\.\S+/.test(user.email);
    const okPwd = !!user.password && user.password.length >= 6;
    return okEmail && okPwd;
  });

  async function submit() {
    if (!canSubmit.value || loading.value) return;
    loading.value = true;
    error.value = '';

    try {
      const payload: Record<string, any> = {
        email: user.email,
        password: user.password,
      };
      if (mode === 'signup') payload.displayName = user.displayName;

      const { data } = await api.post(mode === 'login' ? '/auth/login' : '/auth/signup', payload);
      session.token = data.token;
      session.user = data.user;
      saveSession();
      await router.push({ name: 'home' });
    } catch (e: any) {
      error.value = e?.response?.data?.error || e?.message || (mode === 'login' ? 'Login failed' : 'Signup failed');
    } finally {
      loading.value = false;
    }
  }

  return { loading, error, canSubmit, submit };
}
