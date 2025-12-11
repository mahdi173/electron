
import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
import { useSessionStore } from '@renderer/store/session'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/login' },
  { path: '/login', name: 'login', component: () => import('@renderer/views/Login.vue') },
  { path: '/register', name: 'register', component: () => import('@renderer/views/Register.vue') },
  { path: '/home', name: 'home', component: () => import('@renderer/views/Home.vue') },
  { path: '/chat/:userId', name: 'chat', component:  () => import('@renderer/views/Chat.vue'), props: true },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to) => {
  const session = useSessionStore()
  const isAuthed = !!session.token && !!session.user
  // Protect home/chat; allow login
  if (!isAuthed && to.name !== 'login') {
    return { name: 'login', replace: true }
  }
})

export default router
