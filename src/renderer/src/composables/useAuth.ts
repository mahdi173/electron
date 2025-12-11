
// src/renderer/src/composables/useAuth.ts
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import api from '@renderer/services/api';
import { session, saveSession } from '@renderer/store/session';

type Mode = 'login' | 'signup';

type User = {
  email: string;
  password: string;
  username?: string;
  birthDate?: string;
};

export function useAuth(mode: Mode, user: User) {
  const router = useRouter();
  const loading = ref(false);
  const error = ref('');

  // field-level errors
  const emailError = ref('');
  const passwordError = ref('');
  const usernameError = ref('');
  const birthError = ref('');

  const isEmailValid = (email: string) => /\S+@\S+\.\S+/.test(email);
  const isPasswordValid = (pwd: string) => typeof pwd === 'string' && pwd.length >= 6;
  const isUsernameValid = (name?: string) => !!name && /^[A-Za-z0-9_]{3,30}$/.test(name);

  const isBirthValidAnd13Plus = (birth?: string) => {
    if (!birth) return false;
    const d = new Date(birth);
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return age >= 13;
  };

  const canSubmit = computed(() => {
    // used only for UI feedback if needed; we no longer disable the button with it
    const okEmail = isEmailValid(user.email);
    const okPwd = isPasswordValid(user.password);
    if (mode === 'login') return okEmail && okPwd;
    return okEmail && okPwd && isUsernameValid(user.username) && isBirthValidAnd13Plus(user.birthDate);
  });

  function clearFieldErrors() {
    emailError.value = '';
    passwordError.value = '';
    usernameError.value = '';
    birthError.value = '';
  }

  function validateFields(): boolean {
    clearFieldErrors();
    let ok = true;

    if (!isEmailValid(user.email)) {
      emailError.value = 'Please enter a valid email address.';
      ok = false;
    }
    if (!isPasswordValid(user.password)) {
      passwordError.value = 'Password must be at least 6 characters.';
      ok = false;
    }
    if (mode === 'signup') {
      if (!isUsernameValid(user.username)) {
        usernameError.value = 'Username must be 3–30 chars (letters, numbers, underscores).';
        ok = false;
      } 
      if (!isBirthValidAnd13Plus(user.birthDate)) {
        birthError.value = 'You must be at least 13 years old.';
        ok = false;
      }
    }
    return ok;
  }

  async function submit() {
    if (loading.value) return;
    error.value = '';

    const valid = validateFields();
    if (!valid) return;

    loading.value = true;

    try {
      if (mode === 'login') {
        const { data } = await api.post('/auth/login', {
          email: user.email,
          password: user.password,
        });
        session.token = data.token;
        session.user = data.user;
        saveSession();
      } else {
        const { data } = await api.post('/auth/signup', {
          email: user.email,
          password: user.password,
          displayName: user.username,
          birthDate: user.birthDate,
        });
        session.token = data.token;
        session.user = data.user;
        saveSession();
      }

      await router.push({ name: 'home' });
    } catch (e: any) {
      error.value =
        e?.response?.data?.error ||
        e?.message ||
        (mode === 'login' ? 'Login failed' : 'Signup failed');
    } finally {
      loading.value = false;
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
    // optional derived
    canSubmit,
    // actions
    submit,
  };
}
