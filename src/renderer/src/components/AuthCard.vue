
<template>
  <v-container class="d-flex justify-center align-center" style="min-height: 100vh;">
    <v-card elevation="8" max-width="400" class="pa-6">
      <v-card-title class="text-h6 text-center">
        {{ mode === 'login' ? 'Welcome back' : 'Create your account' }}
      </v-card-title>
      <v-card-subtitle class="text-center mb-4">
        {{ mode === 'login' ? 'Please sign in to continue' : 'Fill in the details to get started' }}
      </v-card-subtitle>

      <v-form @submit.prevent="$emit('submit')" class="d-flex flex-column gap-4">
        <!-- Email -->
        <v-text-field
          v-model="localEmail"
          label="Email"
          type="email"
          :error-messages="emailError ? [emailError] : []"
          :disabled="loading"
          autocomplete="email"
          @input="$emit('update:email', localEmail)"
        />

        <!-- Password -->
        <v-text-field
          v-model="localPassword"
          label="Password"
          type="password"
          :error-messages="passwordError ? [passwordError] : []"
          :disabled="loading"
          autocomplete="current-password"
          @input="$emit('update:password', localPassword)"
        />

        <!-- Extra signup fields -->
        <template v-if="mode === 'signup'">
          <v-text-field
            v-model="localUsername"
            label="Username"
            :error-messages="usernameError ? [usernameError] : []"
            :disabled="loading"
            @input="$emit('update:username', localUsername)"
          />

          <v-text-field
            v-model="localBirthDate"
            label="Birth Date"
            type="date"
            :error-messages="birthError ? [birthError] : []"
            :disabled="loading"
            @input="$emit('update:birthDate', localBirthDate)"
          />
        </template>

        <!-- Submit -->
        <v-btn
          type="submit"
          color="primary"
          block
          :disabled="loading"
        >
          <template v-if="!loading">
            {{ mode === 'login' ? 'Login' : 'Sign Up' }}
          </template>
          <template v-else>
            <v-progress-circular indeterminate color="white" size="20" />
          </template>
        </v-btn>

        <!-- General error -->
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          class="mt-2"
        >
          {{ error }}
        </v-alert>
      </v-form>

      <!-- Switch link -->
      <div class="text-center mt-4">
        <span v-if="mode === 'login'">
          Don’t have an account?
          <RouterLink :to="{ name: 'register' }" class="text-primary font-weight-bold">Create one</RouterLink>
        </span>
        <span v-else>
          Already have an account?
          <RouterLink :to="{ name: 'login' }" class="text-primary font-weight-bold">Sign in</RouterLink>
        </span>
      </div>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

type Mode = 'login' | 'signup'

const props = defineProps<{
  mode: Mode
  email: string
  password: string
  username?: string
  birthDate?: string
  loading: boolean
  error?: string
  emailError?: string
  passwordError?: string
  usernameError?: string
  birthError?: string
}>()

defineEmits<{
  (e: 'update:email', value: string): void
  (e: 'update:password', value: string): void
  (e: 'update:username', value: string): void
  (e: 'update:birthDate', value: string): void
  (e: 'submit'): void
}>()

// Local refs for v-model
const localEmail = ref(props.email)
const localPassword = ref(props.password)
const localUsername = ref(props.username || '')
const localBirthDate = ref(props.birthDate || '')

// Sync props with local refs
watch(() => props.email, val => localEmail.value = val)
watch(() => props.password, val => localPassword.value = val)
watch(() => props.username, val => localUsername.value = val || '')
watch(() => props.birthDate, val => localBirthDate.value = val || '')
</script>
