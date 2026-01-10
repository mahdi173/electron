
<template>
  <v-sheet class="sidebar-root" color="surface">
    <!-- Header -->
    <div class="d-flex align-center px-3 py-2 border-b">
      <span class="text-subtitle-1 font-weight-medium">Direct messages</span>
      <v-spacer />
      <slot name="actions" />
    </div>

    <!-- Search -->
    <div class="px-3 py-2">
      <v-text-field
        v-model="q"
        density="comfortable"
        variant="outlined"
        placeholder="Search users"
        prepend-inner-icon="mdi-magnify"
        clearable
        hide-details
      />
    </div>

    <v-divider />

    <!-- List -->
    <v-list nav density="comfortable">
      <template v-if="loading">
        <v-skeleton-loader type="list-item" class="mx-2" v-for="i in 6" :key="i"/>
      </template>

      <template v-else>
        <v-list-item
          v-for="u in filtered"
          :key="u.id"
          :to="{
            name: 'chat',
            params: { userId: u.id },
            query: { name: u.name }
          }"
          :active="u.id === activeUserId"
          rounded="lg"
        >
          <template #prepend>
            <v-avatar size="36">
              <v-icon icon="mdi-account-circle" />
            </v-avatar>
          </template>

          <v-list-item-title class="text-truncate">
            {{ u.name }}
          </v-list-item-title>

          <v-list-item-subtitle class="text-truncate">
            <span :class="u.online ? 'text-success' : 'text-medium-emphasis'">
              {{ u.online ? 'Online' : 'Offline' }}
            </span>
          </v-list-item-subtitle>

          <template #append>
            <v-badge
              v-if="unreadCount(u.id) > 0"
              color="primary"
              :content="unreadCount(u.id)"
              inline
              bordered
            />
          </template>
        </v-list-item>
      </template>
    </v-list>
  </v-sheet>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface Peer {
  id: number
  name: string
  avatarUrl?: string
  online?: boolean
}

const props = defineProps<{
  peers: { id: number; name: string; lastPreview?: string; lastAt?: string }[]
  activeUserId?: number
  loading?: boolean
  unreadByRoom?: Record<string, number>
  meId?: number
}>()

const q = ref('')

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase()
  console.log(props.peers)
  if (!needle) return props.peers
  return props.peers.filter(u =>
    [u.name, String(u.id)].some(s => s?.toLowerCase().includes(needle))
  )
})

/** Room key helper consistent with Chat.vue (dm:min:max) */
function dmRoomFor(otherId: number) {
  const a = Number(props.meId)
  const b = Number(otherId)
  if (!a || !b || Number.isNaN(a) || Number.isNaN(b)) return ''
  return a < b ? `dm:${a}:${b}` : `dm:${b}:${a}`
}

function unreadCount(otherId: number) {
  if (!props.unreadByRoom) return 0
  const room = dmRoomFor(otherId)
  return room ? (props.unreadByRoom[room] ?? 0) : 0
}
</script>

<style scoped>
.sidebar-root {
  height: 100%;
  display: grid;
  grid-template-rows: auto auto 1fr;
  min-width: 260px;
}
.border-b { border-bottom: 1px solid rgba(0,0,0,0.06); }
</style>
