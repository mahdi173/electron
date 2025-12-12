
<template>
  <v-sheet
    rounded="lg"
    :class="['bubble-base', mine ? 'bubble-mine' : 'bubble-theirs']"
    max-width="75%"
    class="py-2 px-3"
    :elevation="message._status === 'sending' ? 0 : 1"
  >
    <!-- Show name only for the other user's messages -->
    <div class="text-caption mb-1" v-if="!mine && message.sender?.displayName">
      {{ message.sender.displayName }}
    </div>

    <div class="text-body-2 message-text">{{ message.content }}</div>

    <div class="text-caption mt-1 d-flex align-center ga-2 bubble-meta">
      <span>{{ formattedTime }}</span>

      <template v-if="message._status === 'sending'">
        <v-progress-circular size="14" indeterminate color="on-surface" />
        <span>Sending…</span>
      </template>

      <template v-else-if="message._status === 'error'">
        <v-icon size="16" color="error">mdi-alert-circle</v-icon>
        <span class="text-error">Failed</span>
      </template>
    </div>
  </v-sheet>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChatMessage } from '@renderer/store/chat'

const props = defineProps<{
  message: ChatMessage
  mine: boolean
}>()

const formattedTime = computed(() => {
  const iso = props.message?.createdAt
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})
</script>

<style scoped>
/* Base bubble styling encapsulated here so Chat.vue stays slim */
.bubble-base {
  border: 1px solid rgba(0, 0, 0, 0.08);
  color: var(--v-theme-on-surface);
  background: var(--v-theme-surface);
}

/* YOU (current user): LEFT + GREEN */
.bubble-mine {
  background: #2e7d32;   /* Green 800 */
  color: #fff;
  border-color: transparent;
}

/* OTHER user: RIGHT + WHITE */
.bubble-theirs {
  background: #ffffff;   /* White */
  color: #1f1f1f;
  border-color: rgba(0, 0, 0, 0.12);
}

.message-text { white-space: pre-wrap; word-break: break-word; }
.bubble-meta { opacity: 0.8; }
</style>
