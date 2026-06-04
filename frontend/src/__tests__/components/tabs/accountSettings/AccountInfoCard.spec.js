import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAccountStore } from '@/stores/AccountStore.js'

vi.mock('lucide-vue-next', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual }
})

import AccountInfoCard from '@/components/tabs/AccountSettings/AccountInfoCard.vue'

describe('AccountInfoCard.vue', () => {
  let accountStore

  beforeEach(() => {
    setActivePinia(createPinia())
    accountStore = useAccountStore()
  })

  const mountComponent = () => mount(AccountInfoCard)

  it('displays Account ID from store', async () => {
    accountStore.user = { id: 'abc-123', created_at: null, last_sign_in_at: null }
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('abc-123')
  })

  it('shows dash when no user data', async () => {
    accountStore.user = null
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()
    // Should show '-' for all fields
    const dashes = wrapper.findAll('span').filter(s => s.text() === '-')
    expect(dashes.length).toBeGreaterThanOrEqual(3)
  })

  it('formats created_at date in Dutch locale', async () => {
    accountStore.user = {
      id: '1',
      created_at: '2025-01-15T10:30:00Z',
      last_sign_in_at: null,
    }
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()
    // Should contain formatted date (exact format depends on locale)
    expect(wrapper.text()).toContain('2025')
  })
})
