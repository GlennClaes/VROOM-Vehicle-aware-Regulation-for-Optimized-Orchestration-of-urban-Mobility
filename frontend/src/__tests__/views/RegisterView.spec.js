import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import RegisterView from '@/views/RegisterView.vue'
import { useAuthStore } from '@/stores/AuthStore.js'

// 1. Voeg /register toe aan de routes zodat de router deze locatie herkent
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/register', name: 'register', component: RegisterView },
    { path: '/login', name: 'login', component: { template: '<div></div>' } },
    { path: '/dashboard', name: 'dashboard', component: { template: '<div></div>' } }
  ],
})

describe('RegisterView', () => {
  let auth

  beforeEach(async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    auth = useAuthStore()

    // Navigeer naar de juiste route voor de test
    router.push('/register')
    await router.isReady()

    // Mock de register functie van de store
    auth.register = vi.fn()
  })

  const mountOptions = {
    global: {
      plugins: [router],
      stubs: {
        Navigation: true, Lock: true, Mail: true,
        User: true, Eye: true, EyeOff: true, Footer: true
      }
    }
  }

  it('renders correctly', () => {
    const wrapper = mount(RegisterView, mountOptions)
    expect(wrapper.find('#name').exists()).toBe(true)
    // De href check werkt nu omdat de route '/login' bekend is bij de router
    expect(wrapper.find('a').attributes('href')).toBe('/login')
  })

  it('toggles password visibility', async () => {
    const wrapper = mount(RegisterView, mountOptions)
    const passwordInput = wrapper.find('#password')
    const toggleIcon = wrapper.find('span[style*="cursor: pointer"]')

    expect(passwordInput.attributes('type')).toBe('password')

    // Klik op het oogje (Regel 102 coverage)
    await toggleIcon.trigger('click')
    expect(passwordInput.attributes('type')).toBe('text')

    await toggleIcon.trigger('click')
    expect(passwordInput.attributes('type')).toBe('password')
  })

  it('calls register and shows confirmation message on success', async () => {
    auth.register.mockResolvedValue(true)
    const wrapper = mount(RegisterView, mountOptions)

    await wrapper.find('#name').setValue('Test Gebruiker')
    await wrapper.find('#email').setValue('test@gemeente.be')
    await wrapper.find('#password').setValue('wachtwoord123')

    await wrapper.find('form').trigger('submit.prevent')

    // Wacht op async updates
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(auth.register).toHaveBeenCalledWith({
      name: 'Test Gebruiker',
      email: 'test@gemeente.be',
      password: 'wachtwoord123'
    })

    expect(wrapper.text()).toContain('Account succesvol aangemaakt')
  })

  it('shows error message when auth store has an error', async () => {
    auth.error = 'Registratie mislukt!'
    const wrapper = mount(RegisterView, mountOptions)

    const alert = wrapper.find('.alert-danger')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toBe('Registratie mislukt!')
  })

  it('shows loading state on button', async () => {
    auth.loading = true
    const wrapper = mount(RegisterView, mountOptions)
    const button = wrapper.find('button[type="submit"]')
    expect(button.text()).toBe('Bezig met registreren...')
  })

  it('does not show confirmation when register returns false', async () => {
    auth.register.mockResolvedValue(false)
    const wrapper = mount(RegisterView, mountOptions)

    await wrapper.find('#name').setValue('Test Gebruiker')
    await wrapper.find('#email').setValue('test@gemeente.be')
    await wrapper.find('#password').setValue('wachtwoord123')

    await wrapper.find('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(wrapper.text()).not.toContain('Account succesvol aangemaakt')
    expect(wrapper.find('form').exists()).toBe(true)
  })
})
