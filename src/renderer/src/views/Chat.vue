
<template>
  <!-- Full-height column layout -->
  <v-container class="chat-root pa-0" fluid>
    <!-- Top Bar -->
    <v-sheet class="d-flex align-center px-4 py-3 border-b" color="surface">
      <!-- Back button: tries to go back, otherwise goes home -->
      <v-btn icon="mdi-arrow-left" variant="text" @click="goBack" class="mr-3" />

      <div class="d-flex flex-column">
        <span class="text-subtitle-1 font-weight-medium">
          Chat with user: {{ otherName }}
        </span>
        <span class="text-caption text-medium-emphasis" v-if="roomId">
          Room: {{ roomId }}
        </span>
      </div>

      <v-spacer />

      <v-chip
        v-if="connecting"
        label size="small" color="primary" variant="tonal"
        class="mr-2"
      >
        Connecting…
      </v-chip>
      <v-chip
        v-else
        :color="connected ? 'success' : 'error'"
        label size="small" variant="tonal"
        class="mr-2"
      >
        {{ connected ? 'Online' : 'Offline' }}
      </v-chip>

      <!-- Close (always go home) -->
      <v-btn icon="mdi-close" variant="text" @click="goHome" />
    </v-sheet>

    <!-- Messages area (scrollable) -->
    <div ref="scrollArea" class="chat-scroll">
      <v-container fluid class="py-4">
        <div v-if="loading" class="d-flex justify-center my-6">
          <v-progress-circular indeterminate color="primary" />
        </div>

        <div v-else-if="error" class="d-flex justify-center my-6">
          <v-alert type="error" variant="tonal" density="comfortable">
            {{ error }}
          </v-alert>
        </div>

        <template v-else>
          <div v-if="!messages.length" class="d-flex justify-center my-6">
            <v-alert type="info" variant="tonal" density="comfortable">
              No messages yet. Say hi! 👋
            </v-alert>
          </div>

          <div v-else class="d-flex flex-column ga-3">
            <div
              v-for="m in messages"
              :key="m.id ?? (m.createdAt + '-' + m.sender?.id)"
              class="d-flex"
              :class="m.sender?.id === me?.id ? 'justify-end' : 'justify-start'"
            >
              <!-- Own message: blue; Other's message: green -->
              <v-sheet
                rounded="lg"
                :color="m.sender?.id === me?.id ? 'primary' : 'success'"
                :class="m.sender?.id === me?.id ? 'text-white' : 'text-white'"
                max-width="75%"
                class="py-2 px-3"
                elevation="0"
              >
                <!-- Show sender name on incoming messages -->
                <div
                  class="text-caption mb-1"
                  :class="m.sender?.id === me?.id ? 'text-white text-opacity-80' : 'text-white text-opacity-80'"
                  v-if="m.sender && m.sender.id !== me?.id && m.sender.displayName"
                >
                  {{ m.sender.displayName }}
                </div>
                <div class="text-body-2" style="white-space: pre-wrap">{{ m.content }}</div>
                <div
                  class="text-caption mt-1"
                  :class="m.sender?.id === me?.id ? 'text-white text-opacity-70' : 'text-white text-opacity-70'"
                >
                  {{ formatTime(m.createdAt) }}
                </div>
              </v-sheet>
            </div>
          </div>
        </template>
      </v-container>
    </div>

    <!-- Composer (pinned bottom) -->
    <v-sheet class="px-3 py-2 border-t composer" color="surface">
      <v-form @submit.prevent="handleSend">
        <div class="d-flex align-center ga-2">
          <v-textarea
            v-model="draft"
            variant="outlined"
            rows="1"
            auto-grow
            density="comfortable"
            placeholder="Type a message…"
            class="flex-1"
            :disabled="!connected || sending"
            @keydown.enter.exact.prevent="handleSend"
          />
          <v-btn
            color="primary"
            prepend-icon="mdi-send"
            :disabled="!canSend"
            :loading="sending"
            @click="handleSend"
          >
            Send
          </v-btn>
        </div>
      </v-form>
    </v-sheet>
  </v-container>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useSessionStore } from '@renderer/store/session'
import { useChatStore } from '@renderer/store/chat'

const API_BASE = 'http://localhost:3900'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const chat = useChatStore()

const { token, user: me } = storeToRefs(session)
const { connecting, connected, loading, error, messagesByRoom } = storeToRefs(chat)

const userIdParam = computed(() => Number(route.params.userId))

/** We pass display name via query from Home.vue */
const otherName = computed(() => String(route.query.name || `user #${userIdParam.value}`))

/** Stable DM room id: dm:<smallerUserId>:<largerUserId> */
const roomId = computed(() => {
  const a = Number(me.value?.id ?? 0)
  const b = Number(userIdParam.value ?? 0)
  if (!a || !b) return ''
  return a < b ? `dm:${a}:${b}` : `dm:${b}:${a}`
})

const messages = computed(() => messagesByRoom.value[roomId.value] ?? [])

const draft = ref('')
const sending = ref(false)

const canSend = computed(() =>
  connected.value && draft.value.trim().length > 0 && !!roomId.value
)

function goHome() {
  router.push({ name: 'home' })
}

function goBack() {
  if (window.history.length <= 1) {
    goHome()
  } else {
    router.back()
    setTimeout(() => {
      if (router.currentRoute.value.name === 'chat') goHome()
    }, 0)
  }
}

function formatTime(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const scrollArea = ref<HTMLElement | null>(null)
function scrollToBottom() {
  nextTick(() => {
    if (scrollArea.value) {
      scrollArea.value.scrollTop = scrollArea.value.scrollHeight
    }
  })
}

async function ensureSocket() {
  if (!connected.value && token.value) {
    await chat.connectSocket(token.value)
  }
}

async function loadHistory() {
  if (!roomId.value || !token.value) return
  await chat.fetchHistory(API_BASE, roomId.value, token.value) // Authorization header
  scrollToBottom()
}

async function joinTheRoom() {
  if (!roomId.value) return
  await chat.joinRoom(roomId.value)
}

async function handleSend() {
  if (!canSend.value) return
  const content = draft.value.trim()
  draft.value = ''
  sending.value = true
  try {
    await chat.sendMessage(roomId.value, content) // server will emit message:new
    scrollToBottom()
  } finally {
    sending.value = false
  }
}

watch(messages, () => {
  // Auto-scroll on history load and on new messages
  scrollToBottom()
})

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown)
  await ensureSocket()
  await loadHistory()
  await joinTheRoom()
  scrollToBottom()
})

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') goBack()
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  if (roomId.value) chat.leaveRoom(roomId.value)
})
</script>

<style scoped>
/* Full-height column layout */
.chat-root {
  display: flex;
  flex-direction: column;
  height: 100vh; /* makes bottom composer stick to bottom */
}

/* Scrollable messages area */
.chat-scroll {
  flex: 1;
  overflow: auto;
}

/* Composer pinned bottom */
.composer {
  position: sticky;
  bottom: 0;
  z-index: 2;
}

.border-b { border-bottom: 1px solid rgba(0,0,0,.08); }
.border-t { border-top: 1px solid rgba(0,0,0,.08); }
.flex-1 { flex: 1; }
</style>