import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAccountStore } from '@/stores/AccountStore'

// Mock axios
vi.mock('axios', () => ({
  default: {
    put: vi.fn(),
    get: vi.fn(),
  }
}))
import axios from 'axios'

vi.mock('lucide-vue-next', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual }
})

import PasswordCard from '@/components/tabs/AccountSettings/PasswordCard.vue'

describe('PasswordCard.vue', () => {
  let accountStore

  beforeEach(() => {
    setActivePinia(createPinia())
    accountStore = useAccountStore()

    accountStore.user = { username: 'John Doe', email: 'john@email.com' }
    accountStore.changePassword = vi.fn().mockResolvedValue(true)
  })

  const mountComponent = () => mount(PasswordCard)

  it('renders password change form with all fields', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('#currentPassword').exists()).toBe(true)
    expect(wrapper.find('#newPassword').exists()).toBe(true)
    expect(wrapper.find('#confirmPassword').exists()).toBe(true)
  })

  it('shows error when new password is less than 6 characters', async () => {
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()

    await wrapper.find('#currentPassword').setValue('oldpass')
    await wrapper.find('#newPassword').setValue('short')
    await wrapper.find('#confirmPassword').setValue('short')

    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.vm.passwordError).toBe('Wachtwoord moet minimaal 6 tekens bevatten.')
  })

  it('shows error when passwords do not match', async () => {
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()

    await wrapper.find('#currentPassword').setValue('oldpass')
    await wrapper.find('#newPassword').setValue('newpassword1')
    await wrapper.find('#confirmPassword').setValue('newpassword2')

    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.vm.passwordError).toBe('Wachtwoorden komen niet overeen.')
  })

  it('calls API and shows success on valid password change', async () => {
    const mockSession = { access_token: 'test-token' }
    localStorage.setItem('session', JSON.stringify(mockSession))

    axios.put.mockResolvedValue({
      data: { access_token: 'new-token', message: 'Profiel succesvol bijgewerkt' }
    })

    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()

    await wrapper.find('#currentPassword').setValue('oldpass123')
    await wrapper.find('#newPassword').setValue('newpass123')
    await wrapper.find('#confirmPassword').setValue('newpass123')

    await wrapper.find('form').trigger('submit.prevent')

    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(accountStore.changePassword).toHaveBeenCalledWith(
      'oldpass123',
      'newpass123'
    )

    expect(wrapper.vm.passwordSuccess).toBe('✅ Wachtwoord succesvol gewijzigd!')
    expect(wrapper.vm.currentPassword).toBe('')
    expect(wrapper.vm.newPassword).toBe('')
    expect(wrapper.vm.confirmPassword).toBe('')

    localStorage.removeItem('session')
  })

  it('toggles password visibility with eye icon', async () => {
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('#currentPassword').attributes('type')).toBe('password')

    const eyeButtons = wrapper.findAll('button[type="button"]')
    await eyeButtons[0].trigger('click')

    expect(wrapper.find('#currentPassword').attributes('type')).toBe('text')
  })
})
