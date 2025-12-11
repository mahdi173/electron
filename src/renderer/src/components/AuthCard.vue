
<template>
  <div class="auth-wrap">
    <div class="auth-card">
      <h2>{{ mode === 'login' ? 'Welcome back' : 'Create your account' }}</h2>
      <p class="subtitle">
        {{ mode === 'login' ? 'Please sign in to continue' : 'Fill in the details to get started' }}
      </p>

      <form @submit.prevent="$emit('submit')" class="form" novalidate>
        <div class="field">
          <input
            :value="email"
            @input="$emit('update:email', ($event.target as HTMLInputElement).value)"
            type="email"
            placeholder="Email"
            autocomplete="email"
            :disabled="loading"
            required
          />
        </div>

        <div class="field">
          <input
            :value="password"
            @input="$emit('update:password', ($event.target as HTMLInputElement).value)"
            type="password"
            placeholder="Password"
            autocomplete="current-password"
            :disabled="loading"
            minlength="6"
            required
          />
        </div>

        <transition name="slide-fade">
          <div v-if="mode === 'signup'" class="field">
            <input
              :value="displayName"
              @input="$emit('update:displayName', ($event.target as HTMLInputElement).value)"
              type="text"
              placeholder="Display name (optional)"
              :disabled="loading"
              maxlength="50"
            />
          </div>
        </transition>

        <button class="btn primary" :disabled="loading || !canSubmit">
          <span v-if="!loading">{{ mode === 'login' ? 'Login' : 'Sign Up' }}</span>
          <span v-else class="spinner"></span>
        </button>

        <p v-if="error" class="error">{{ error }}</p>
      </form>

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
  displayName?: string;
  loading: boolean;
  error?: string;
  canSubmit: boolean;
}>();

defineEmits<{
  (e: 'update:email', value: string): void;
  (e: 'update:password', value: string): void;
  (e: 'update:displayName', value: string): void;
  (e: 'submit'): void;
  (e: 'switch'): void;
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
h2 {
  margin: 0 0 6px;
  font-size: 22px;
  color: #111827;
}
.subtitle {
  margin: 0 0 18px;
  color: #6b7280;
  font-size: 13px;
}

/* Form */
.form {
  display: grid;
  gap: 12px;
}
.field input {
  width: 100%;
  padding: 12px 12px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: #fafafa;
  font-size: 14px;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.field input:focus {
  outline: none;
  border-color: #2563eb;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 14px;
  border: 0;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: transform 0.04s ease, filter 0.15s ease, opacity 0.15s ease;
}
.btn:active { transform: translateY(1px); }

.switch {
    span {
        color: #111827;
    }
}

.error {
    color: red;
}
</style>