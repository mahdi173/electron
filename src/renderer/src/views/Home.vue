
<template>
  <!-- Top App Bar -->
  <v-app-bar flat color="surface">
    <v-app-bar-title>
      <span class="text-h6 font-weight-semibold">Chats</span>
    </v-app-bar-title>

    <v-spacer />

    <!-- Session user + menu -->
    <div class="d-flex align-center">
      <v-btn
        v-if="me"
        variant="text"
        class="mr-1"
        @click="menuOpen = true"
      >
        <v-avatar color="primary" size="28" class="mr-2 text-white">
          {{ initials(me.displayName || me.email) }}
        </v-avatar>
        <span class="text-body-2">{{ me.displayName || me.email }}</span>
        <v-icon class="ml-1" icon="mdi-menu-down" />
      </v-btn>

      <v-btn
        v-else
        variant="text"
        prepend-icon="mdi-logout"
        @click="confirmLogout = true"
      >
        Logout
      </v-btn>

      <v-menu v-model="menuOpen" location="bottom end">
        <v-sheet class="pa-2" rounded="lg" elevation="2" width="240">
          <div class="d-flex align-center mb-2">
            <v-avatar color="primary" size="32" class="mr-2 text-white">
              {{ initials(me?.displayName || me?.email || '') }}
            </v-avatar>
            <div class="d-flex flex-column">
              <span class="text-body-2">{{ me?.displayName || me?.email }}</span>
              <span class="text-caption text-medium-emphasis">{{ me?.email }}</span>
            </div>
          </div>
          <v-divider class="my-2" />
          <v-btn
            color="error"
            variant="tonal"
            block
            prepend-icon="mdi-logout"
            @click="confirmLogout = true"
          >
            Logout
          </v-btn>
        </v-sheet>
      </v-menu>

      <v-dialog v-model="confirmLogout" max-width="380">
        <v-card>
          <v-card-title class="text-h6">Log out?</v-card-title>
          <v-card-text>You will be signed out from this device. Continue?</v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="confirmLogout = false">Cancel</v-btn>
            <v-btn color="error" variant="flat" @click="logout">Logout</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </v-app-bar>

  <!-- Content under App Bar -->
  <v-container class="fill-height pt-4" fluid>
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <!-- ✅ Your search preserved -->
        <v-text-field
          v-model="searchText"
          variant="outlined"
          density="comfortable"
          prepend-inner-icon="mdi-magnify"
          label="Search users"
          @input="onSearchInput"
          clearable
        />

        <div class="my-4" v-if="loading">
          <div class="d-flex align-center">
            <v-progress-circular color="primary" indeterminate size="24" class="mr-2" />
            <span>Loading users…</span>
          </div>
        </div>

        <v-alert
          v-else-if="error"
          type="error"
          variant="tonal"
          class="mb-4"
          density="comfortable"
        >
          {{ error }}
        </v-alert>

        <v-list v-else lines="two" density="comfortable" class="rounded-lg elevation-1">
          <template v-if="users.length">
            <v-list-item
              v-for="u in users"
              :key="u.id"
              :title="u.display_name"
              :subtitle="u.email"
              @click="openChat(u)"
              link
            >
              <template #prepend>
                <v-avatar color="primary" variant="flat" size="40" class="text-white">
                  {{ initials(u.display_name) }}
                </v-avatar>
              </template>
              <template #append>
                <v-btn icon="mdi-chevron-right" variant="text" color="default" @click.stop="openChat(u)" />
              </template>
            </v-list-item>
          </template>

          <template v-else>
            <v-list-item>
              <v-list-item-title>No users found</v-list-item-title>
              <v-list-item-subtitle>Try a different search.</v-list-item-subtitle>
            </v-list-item>
          </template>
        </v-list>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useSessionStore } from '@renderer/store/session'
import { useChatStore } from '@renderer/store/chat' // optional if you want to leave rooms on logout

type User = {
  id: number
  email: string
  display_name: string
  birth_date?: string
  created_at?: string
}

const API_BASE = 'http://localhost:3900'

const router = useRouter()
const session = useSessionStore()
const chat = useChatStore()

const { user: me } = storeToRefs(session)

const users = ref<User[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const searchText = ref('')

const menuOpen = ref(false)
const confirmLogout = ref(false)

// Debounce
let debounceTimer: number | null = null
const onSearchInput = () => {
  if (debounceTimer) window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(fetchUsers, 250)
}

const initials = (name: string) =>
  String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('')

// Fetch users (only if authenticated)
async function fetchUsers() {
  if (!session.token || !session.user) return
  loading.value = true
  error.value = null
  try {
    const q = encodeURIComponent(searchText.value.trim())
    const res = await fetch(`${API_BASE}/api/users${q ? `?q=${q}` : ''}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Failed: ${res.status} ${res.statusText}`)
    const data = (await res.json()) as User[]
    users.value = Array.isArray(data) ? data : []
  } catch (e: any) {
    console.error(e)
    error.value = e?.message ?? 'Failed to load users'
  } finally {
    loading.value = false
  }
}

function openChat(u: User) {
  router.push({
    name: 'chat',
    params: { userId: String(u.id) },
    query: { name: u.display_name },
  })
}

function logout() {
  confirmLogout.value = false
  // Optional: leave default room / disconnect
  try { chat.leaveRoom?.('general') } catch {}
  // Clear session and go to login
  session.clear()
  router.replace({ name: 'login' })
}

onMounted(fetchUsers)
</script>
