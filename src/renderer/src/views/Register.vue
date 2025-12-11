
<template>
<AuthCard
  :mode="mode"
  :email="user.email"
  :password="user.password"
  :displayName="user.displayName"
  :loading="loading"
  :error="error"
  :canSubmit="canSubmit"
  @update:email="v => (user.email = v)"
  @update:password="v => (user.password = v)"
  @update:displayName="v => (user.displayName = v)"
  @submit="submit()"
/>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import AuthCard from '@renderer/components/AuthCard.vue';
import { useAuth } from '@renderer/composables/useAuth';

const mode = 'signup';
const user = reactive({
  email: '',
  password: '',
  displayName: '',
});

const { loading, error, canSubmit, submit } = useAuth(mode, user);
</script>

