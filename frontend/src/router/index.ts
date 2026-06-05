import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '@/views/LoginView.vue'
import DashboardView from '@/views/DashboardView.vue'
import { useAuthStore } from '@/stores/AuthStore'
import RegisterView from '@/views/RegisterView.vue'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: LoginView, meta: { requiresGuest: true } },
  { path: '/register', component: RegisterView, meta: { requiresGuest: true } },
  { path: '/dashboard', component: DashboardView, meta: { requiresAuth: true } },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated()) {
    return '/login'
  } else if (to.meta.requiresGuest && auth.isAuthenticated()) {
    return '/dashboard'
  }
  return true
})

export default router
