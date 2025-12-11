
<template>
  <div class="auth-wrap">
    <div class="auth-card">
      <h2>{{ mode === 'login' ? 'Welcome back' : 'Create your account' }}</h2>
      <p class="subtitle">
        {{ mode === 'login' ? 'Please sign in to continue' : 'Fill in the details to get started' }}
      </p>

      <form @submit.prevent="$emit('submit')" class="form" novalidate>
        <!-- Email -->
        <div class="field">
          <input
            :value="email"
            @input="$emit('update:email', ($event.target as HTMLInputElement).value)"
            type="email"
            placeholder="Email"
            autocomplete="email"
            :disabled="loading"
          />
          <small v-if="emailError" class="field-error">{{ emailError }}</small>
        </div>

        <!-- Password -->
        <div class="field">
          <input
            :value="password"
            @input="$emit('update:password', ($event.target as HTMLInputElement).value)"
            type="password"
            placeholder="Password"
            autocomplete="current-password"
            :disabled="loading"
          />
          <small v-if="passwordError" class="field-error">{{ passwordError }}</small>
        </div>

        <!-- Extra signup fields -->
        <transition name="slide-fade">
          <div v-if="mode === 'signup'">
            <div class="field">
              <input
                :value="username"
                @input="$emit('update:username', ($event.target as HTMLInputElement).value)"
                type="text"
                placeholder="Username"
                :disabled="loading"
              />
              <small v-if="usernameError" class="field-error">{{ usernameError }}</small>
            </div>

            <div class="field">
              <input
                :value="birthDate"
                @input="$emit('update:birthDate', ($event.target as HTMLInputElement).value)"
                type="date"
                placeholder="Birth date"
                :disabled="loading"
              />
              <small v-if="birthError" class="field-error">{{ birthError }}</small>
            </div>
          </div>
        </transition>

        <!-- Submit -->
        <button class="btn primary" :disabled="loading">
          <span v-if="!loading">{{ mode === 'login' ? 'Login' : 'Sign Up' }}</span>
          <span v-else class="spinner"></span>
        </button>

        <!-- General error -->
        <p v-if="error" class="error">{{ error }}</p>
      </form>

      <!-- Switch link (router-based) -->
      <p class="switch">
        <span v-if="mode === 'login'">
          Don’t have an account?
          <router-link :to="{ name: 'register' }">Create one</router-link>
        </span>
        <span v-else>
          Already have an account?
          <router-link :to="{ name: 'login' }">Sign in</router-link>
        </span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
type Mode = 'login' | 'signup';

defineProps<{
  mode: Mode;
  email: string;
  password: string;
  username?: string;
  birthDate?: string; // yyyy-mm-dd
  loading: boolean;
  error?: string;
  // field-level errors
  emailError?: string;
  passwordError?: string;
  usernameError?: string;
  birthError?: string;
  // keep canSubmit for backward compat (not used anymore)
  canSubmit?: boolean;
}>();

defineEmits<{
  (e: 'update:email', value: string): void;
  (e: 'update:password', value: string): void;
  (e: 'update:username', value: string): void;
  (e: 'update:birthDate', value: string): void;
  (e: 'submit'): void;
}>();
</script>

<style scoped>
/* Layout */
.auth-wrap {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(80% 120% at 20% 10%, #eef3ff 0%, #f7f7f7 50%, #f4f4f4 100%);
  padding: 24px;
}
.auth-card {
  width: 100%;
  max-width: 380px;
  background: #fff;
  border-radius: 14px;
  padding: 28px 24px;
  box-shadow: 0 10px 30px rgba(16, 24, 40, 0.08);
}
h2 { margin: 0 0 6px; font-size: 22px; color: #111827; }
.subtitle { margin: 0 0 18px; color: #6b7280; font-size: 13px; }

/* Form */
.form { display: grid; gap: 12px; }
.field input {
  width: 100%; padding: 12px 12px; border-radius: 10px;
  border: 1px solid #e5e7eb; background: #fafafa; font-size: 14px;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.field input:focus {
  outline: none; border-color: #2563eb; background: #ffffff;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}
.field-error {
  margin-top: 6px;
  color: #b91c1c;
  font-size: 12px;
}

/* Buttons */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 8px; padding: 12px 14px; border: 0; border-radius: 10px;
  font-weight: 600; font-size: 14px; cursor: pointer;
  transition: transform 0.04s ease, filter 0.15s ease, opacity 0.15s ease;
}
.btn:active { transform: translateY(1px); }
.btn.primary { color: #fff; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); }
.btn:disabled { opacity: 0.7; cursor: not-allowed; }

/* General error */
.error {
  color: #b91c1c; background: #fee2e2; border: 1px solid #fecaca;
  padding: 8px 10px; border-radius: 8px; font-size: 13px; margin-top: 10px;
}

/* Switch link */
.switch { margin-top: 14px; text-align: center; color: #6b7280; font-size: 13px; }
.switch a { color: #2563eb; text-decoration: none; font-weight: 600; }
.switch a:hover { text-decoration: underline; }

/* Tiny loading indicator */
.spinner {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2.5px solid rgba(255, 255, 255, 0.5); border-top-color: #fff;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Transition */
.slide-fade-enter-active, .slide-fade-leave-active { transition: all 180ms ease; }
.slide-fade-enter-from, .slide-fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
