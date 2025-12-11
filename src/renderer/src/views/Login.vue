
<template>
  <AuthCard
    mode="login"
    :email="user.email"
    :password="user.password"
    :username="user.username"
    :birthDate="user.birthDate"
    :loading="loading"
    :error="error"
    :emailError="emailError"
    :passwordError="passwordError"
    :usernameError="usernameError"
    :birthError="birthError"
    @update:email="v => (user.email = v)"
    @update:password="v => (user.password = v)"
    @update:username="v => (user.username = v)"
    @update:birthDate="v => (user.birthDate = v)"
    @submit="submit()"
  />
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import AuthCard from '@renderer/components/AuthCard.vue';
import { useAuth } from '@renderer/composables/useAuth';

const user = reactive({
  email: '',
  password: '',
  username: '',   // unused on login but harmless
  birthDate: '',  // unused on login but harmless
});

const { loading, error, emailError, passwordError, usernameError, birthError, submit } =
  useAuth('login', user);
</script>
