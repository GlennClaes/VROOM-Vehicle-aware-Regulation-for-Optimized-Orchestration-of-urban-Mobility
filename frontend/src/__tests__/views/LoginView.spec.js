import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import axios from 'axios'
import LoginView from '@/views/LoginView.vue'

vi.mock('axios')

// 1. Voeg '/' toe aan de routes zodat de router de startpagina herkent
const routes = [
  { path: '/', component: LoginView },
  { path: '/register', name: 'register', component: { template: '<div />' } },
  { path: '/dashboard', name: 'dashboard', component: { template: '<div />' } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

describe('LoginView', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // 2. Navigeer expliciet naar '/' voor elke test
    router.push('/')
    await router.isReady()
  })

  it('renders register link correctly', async () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [router, createPinia()] },
    })

    const link = wrapper.findComponent({ name: 'RouterLink' })
    expect(link.exists()).toBe(true)
    expect(link.props('to')).toBe('/register')
    expect(link.text()).toContain('Registreer hier')
  })

  it('logs in successfully and redirects', async () => {
    // POST /login
    axios.post.mockResolvedValueOnce({
      data: { access_token: 'abc123', token_type: 'bearer' }
    })

    // GET /me
    axios.get.mockResolvedValueOnce({
      data: { id: 1, name: 'Test User', email: 'test@test.be' }
    })

    const pushSpy = vi.spyOn(router, 'push')

    const wrapper = mount(LoginView, { global: { plugins: [router, createPinia()] } })

    await wrapper.find('input#email').setValue('test@test.be')
    await wrapper.find('input#password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')

    // Wacht op alle async acties
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(pushSpy).toHaveBeenCalledWith('/dashboard')
  })

  it('shows error message on failed login', async () => {
    axios.post.mockRejectedValue({ response: { status: 400 } })

    const wrapper = mount(LoginView, {
      global: { plugins: [router, createPinia()] },
    })

    await wrapper.find('input#email').setValue('test@test.be')
    await wrapper.find('input#password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')

    await wrapper.vm.$nextTick()

    // Wacht tot de loading state in de component/store klaar is
    await new Promise(resolve => {
      const check = () => {
        if (!wrapper.vm.loading) resolve()
        else setTimeout(check, 10)
      }
      check()
    })

    const errorDiv = wrapper.find('div.alert-danger')
    expect(errorDiv.exists()).toBe(true)
    expect(errorDiv.text()).toBe('E-mailadres of wachtwoord is incorrect.')
  })

  it('toggles password visibility', async () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [router, createPinia()] },
    })

    const passwordInput = wrapper.find('input#password')
    expect(passwordInput.attributes('type')).toBe('password')

    await wrapper.find('span.position-absolute.end-0').trigger('click')
    expect(passwordInput.attributes('type')).toBe('text')

    await wrapper.find('span.position-absolute.end-0').trigger('click')
    expect(passwordInput.attributes('type')).toBe('password')
  })
})
