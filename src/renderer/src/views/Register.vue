
<template>
  <AuthCard
    mode="signup"
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
  username: '',
  birthDate: '', // yyyy-mm-dd
});

const { loading, error, emailError, passwordError, usernameError, birthError, submit } =
  useAuth('signup', user);
</script>
