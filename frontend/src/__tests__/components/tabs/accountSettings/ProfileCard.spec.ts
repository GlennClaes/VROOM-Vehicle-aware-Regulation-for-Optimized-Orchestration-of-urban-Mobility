import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAccountStore } from '@/stores/AccountStore'

vi.mock('lucide-vue-next', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual }
})

import ProfileCard from '@/components/tabs/AccountSettings/ProfileCard.vue'

describe('ProfileCard.vue', () => {
  let accountStore

  beforeEach(() => {
    setActivePinia(createPinia())
    accountStore = useAccountStore()

    accountStore.user = { username: 'John Doe', email: 'john@email.com' }
    accountStore.updateUser = vi.fn().mockResolvedValue(true)
    accountStore.fetchUser = vi.fn().mockResolvedValue(true)
  })

  const mountComponent = () => mount(ProfileCard)

  it('renders name and email fields from store', async () => {
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const nameInput = wrapper.find('#name')
    const emailInput = wrapper.find('#email')

    expect(nameInput.element.value).toBe('John Doe')
    expect(emailInput.element.value).toBe('john@email.com')
  })

  it('updates v-model when typing', async () => {
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()

    const nameInput = wrapper.find('#name')
    await nameInput.setValue('New Name')

    expect(wrapper.vm.profileName).toBe('New Name')
  })

  it('calls store.updateUser when submitting form', async () => {
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()

    await wrapper.find('#name').setValue('New Name')
    await wrapper.find('#email').setValue('new@email.com')
    await wrapper.find('form').trigger('submit.prevent')

    expect(accountStore.updateUser).toHaveBeenCalledWith({
      username: 'New Name',
      email: 'new@email.com'
    })
  })

  it('emits profile-updated event after success and shows success message', async () => {
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()

    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.emitted('profile-updated')).toBeTruthy()
    expect(wrapper.emitted('profile-updated')[0][0]).toEqual({
      name: 'John Doe',
      email: 'john@email.com'
    })
    expect(wrapper.vm.successMessage).toBe('✅ Profiel succesvol bijgewerkt!')
    expect(wrapper.find('.alert-success').exists()).toBe(true)
  })

  it('renders error message when store.error is set', async () => {
    accountStore.error = 'Er is een fout opgetreden'
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const errorAlert = wrapper.find('.alert-danger')
    expect(errorAlert.exists()).toBe(true)
    expect(errorAlert.text()).toBe('Er is een fout opgetreden')
  })

  it('shows loading state on submit button', async () => {
    accountStore.loading = true
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()

    const button = wrapper.find('button[type="submit"]')
    expect(button.element.disabled).toBe(true)
    expect(button.text()).toContain('Bezig met opslaan...')
  })

  it('defaults to empty string when user is null', async () => {
    accountStore.user = null
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const nameInput = wrapper.find('#name')
    const emailInput = wrapper.find('#email')
    expect(nameInput.element.value).toBe('')
    expect(emailInput.element.value).toBe('')
  })

  it('does not emit profile-updated when updateUser fails', async () => {
    accountStore.updateUser = vi.fn().mockResolvedValue(false)
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()

    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.emitted('profile-updated')).toBeFalsy()
    expect(wrapper.vm.successMessage).toBe('')
  })
})
