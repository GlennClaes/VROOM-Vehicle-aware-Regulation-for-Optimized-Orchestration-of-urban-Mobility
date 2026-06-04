import { setActivePinia, createPinia } from 'pinia'
import { createApp } from 'vue'
import router from '@/router/index.js'
import { useAuthStore } from '@/stores/AuthStore.js'

describe('App Router', () => {
  beforeEach(() => {
    // 1. Maak een verse Pinia instantie voor elke test
    const app = createApp({})
    const pinia = createPinia()
    app.use(pinia)
    setActivePinia(pinia)
  })

  it('redirects authenticated user from /login to /dashboard', async () => {
    const auth = useAuthStore()
    auth.isAuthenticated = vi.fn(() => true)

    await router.push('/login')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/dashboard')
  })
})
