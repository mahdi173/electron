<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { loadSession } from './store/session';

onMounted(loadSession);
</script>
