
import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/login' },
  { path: '/login', name: 'login', component: () => import('@renderer/views/Login.vue') },
  { path: '/register', name: 'register', component: () => import('@renderer/views/Register.vue') },
  { path: '/home', name: 'home', component: () => import('@renderer/views/Home.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
