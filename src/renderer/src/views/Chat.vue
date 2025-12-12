
<template>
  <v-container class="chat-root pa-0" fluid>
    <!-- Header -->
    <v-sheet class="d-flex align-center px-4 py-3 border-b" color="surface">
      <v-btn icon="mdi-arrow-left" variant="text" @click="goBack" class="mr-3" />
      <div class="d-flex flex-column">
        <span class="text-subtitle-1 font-weight-medium">
          Chat with user: {{ otherName }}
        </span>
        <span class="text-caption text-medium-emphasis" v-if="room">
          Room: {{ room }}
        </span>
      </div>
      <v-spacer />
      <v-chip v-if="connecting" label size="small" color="primary" variant="tonal" class="mr-2">
        Connecting…
      </v-chip>
      <v-chip v-else :color="connected ? 'success' : 'error'" label size="small" variant="tonal" class="mr-2">
        {{ connected ? 'Online' : 'Offline' }}
      </v-chip>
      <v-btn icon="mdi-close" variant="text" @click="goHome" />
    </v-sheet>

    <!-- Scrollable list -->
    <div ref="scrollArea" class="chat-scroll">
      <v-container fluid class="py-4">
        <!-- Loading -->
        <div v-if="loading" class="d-flex justify-center my-6">
          <v-progress-circular indeterminate color="primary" />
        </div>

        <!-- Error -->
        <div v-else-if="error" class="d-flex justify-center my-6">
          <v-alert type="error" variant="tonal" density="comfortable">
            {{ error }}
          </v-alert>
        </div>

        <!-- Messages -->
        <template v-else>
          <div v-if="!messages.length" class="d-flex justify-center my-6">
            <v-alert type="info" variant="tonal" density="comfortable">
              No messages yet. Say hi! 👋
            </v-alert>
          </div>

          <div v-else class="d-flex flex-column ga-3">
            <div
              v-for="m in messages"
              :key="messageKey(m)"
              class="d-flex"
              :class="isMine(m) ? 'justify-start' : 'justify-end'"
            >
              <!-- YOU: left/green | OTHER: right/white -->
              <MessageBubble :message="m" :mine="isMine(m)" />
            </div>
          </div>
        </template>
      </v-container>
    </div>

    <!-- Composer -->
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
import MessageBubble from '@renderer/components/MessageBubble.vue'

const API_BASE = 'http://localhost:3900'

/** Stores & routing */
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const chat = useChatStore()
const { token, user: me } = storeToRefs(session)
const { connecting, connected, loading, error, messagesByRoom } = storeToRefs(chat)

/** Helpers */
const normalizeId = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

/** DM target from route */
const userIdParam = computed(() => normalizeId(route.params.userId))
const otherName = computed(() => String(route.query.name || `user #${userIdParam.value || ''}`))

/** DM room id: dm:min:max */
const room = computed(() => {
  const a = normalizeId(me.value?.id)
  const b = normalizeId(userIdParam.value)
  if (Number.isNaN(a) || Number.isNaN(b) || !a || !b) return ''
  return a < b ? `dm:${a}:${b}` : `dm:${b}:${a}`
})

/** Messages in current room */
const messages = computed<any[]>(() => (room.value ? (messagesByRoom.value[room.value] ?? []) : []))

/** Prefer chat.currentUserId; fallback to session.user.id while socket hello arrives */
const currentUserId = computed(() => {
  const fromChat = normalizeId(chat.currentUserId)
  if (!Number.isNaN(fromChat)) return fromChat
  return normalizeId(me.value?.id)
})

/** Mine vs Theirs (YOU = left/green, OTHER = right/white) */
const isMine = (m: any) => {
  return   normalizeId(m?.sender?.id) === currentUserId.value && !Number.isNaN(currentUserId.value)
}

/** UI state */
const draft = ref('')
const sending = ref(false)
const canSend = computed(() =>
  connected.value && draft.value.trim().length > 0 && !!room.value && !sending.value
)

/** Navigation */
function goHome() { router.push({ name: 'home' }) }
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

/** Scroll management */
const scrollArea = ref<HTMLElement | null>(null)
function scrollToBottom() {
  nextTick(() => {
    if (scrollArea.value) {
      scrollArea.value.scrollTop = scrollArea.value.scrollHeight
    }
  })
}

/** Data / socket flow */
async function ensureSocket() {
  // make sure store knows who I am (server also emits session:user)
  const myId = normalizeId(me.value?.id)
  if (!Number.isNaN(myId) && chat.currentUserId !== myId) {
    chat.setCurrentUserId(myId)
  }
  if (!connected.value && token.value) {
    await chat.connectSocket(token.value)
  }
}

async function loadHistory() {
  if (!room.value || !token.value) return
  await chat.fetchHistory(API_BASE, room.value, token.value)
  scrollToBottom()
}

async function joinRoom() {
  if (!room.value) return
  await chat.joinRoom(room.value)
}

/** Send (optimistic handled by store) */
async function handleSend() {
  if (!canSend.value) return
  const content = draft.value.trim()
  draft.value = ''
  sending.value = true
  try {
    await chat.sendMessage(room.value, content)
    scrollToBottom()
  } finally {
    sending.value = false
  }
}

/** Keys for v-for */
function messageKey(m: any) {
  return m.id ?? m._tempId ?? `${m.createdAt}-${m.sender?.id ?? 'x'}`
}

/** Watchers & lifecycle */
watch(messages, () => { scrollToBottom() })

watch(room, async (newRoom, oldRoom) => {
  if (newRoom && newRoom !== oldRoom) {
    await loadHistory()
    await joinRoom()
  }
})

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown)
  await ensureSocket()
  await loadHistory()
  await joinRoom()
  scrollToBottom()
})

function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') goBack() }

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  if (room.value) chat.leaveRoom(room.value)
})
</script>

<style scoped>
/* Page layout only (bubble styles live in MessageBubble.vue) */
.chat-root { height: 100%; display: grid; grid-template-rows: auto 1fr auto; }
.border-b { border-bottom: 1px solid rgba(0, 0, 0, 0.06); }
.border-t { border-top: 1px solid rgba(0, 0, 0, 0.06); }
.chat-scroll { overflow-y: auto; overscroll-behavior: contain; }
.composer { backdrop-filter: saturate(180%) blur(6px); }
</style>
