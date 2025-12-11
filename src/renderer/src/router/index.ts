
import { createRouter, createWebHashHistory } from 'vue-router';

const Login = () => import('@renderer/views/Login.vue');
const Register = () => import('@renderer/views/Register.vue');
const Chat = () => import('@renderer/views/Home.vue');

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', name: 'login', component: Login },
    { path: '/register', name: 'register', component: Register },
    { path: '/home', name: 'home', component: Chat },
  ],
});

export default router;
