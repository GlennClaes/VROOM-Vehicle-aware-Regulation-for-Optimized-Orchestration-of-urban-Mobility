import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import AccountSettings from '@/components/tabs/AccountSettings.vue'
import ProfileCard from '@/components/tabs/AccountSettings/ProfileCard.vue'
import PasswordCard from '@/components/tabs/AccountSettings/PasswordCard.vue'
import AccountInfoCard from '@/components/tabs/AccountSettings/AccountInfoCard.vue'

// Mock sub-components
vi.mock('@/components/tabs/AccountSettings/ProfileCard.vue', () => ({
  default: { template: '<div id="profile-card-mock" />' }
}))
vi.mock('@/components/tabs/AccountSettings/PasswordCard.vue', () => ({
  default: { template: '<div id="password-card-mock" />' }
}))
vi.mock('@/components/tabs/AccountSettings/AccountInfoCard.vue', () => ({
  default: { template: '<div id="account-info-card-mock" />' }
}))

describe('AccountSettings.vue', () => {
  it('renders all three account cards', () => {
    const wrapper = mount(AccountSettings)
    expect(wrapper.findComponent(ProfileCard).exists()).toBe(true)
    expect(wrapper.findComponent(PasswordCard).exists()).toBe(true)
    expect(wrapper.findComponent(AccountInfoCard).exists()).toBe(true)
  })

  it('emits profile-updated when ProfileCard emits it', async () => {
    const wrapper = mount(AccountSettings)
    const profileCard = wrapper.findComponent(ProfileCard)
    
    const updateData = { name: 'New Name', email: 'new@email.com' }
    await profileCard.vm.$emit('profile-updated', updateData)
    
    expect(wrapper.emitted('profile-updated')).toBeTruthy()
    expect(wrapper.emitted('profile-updated')[0]).toEqual([updateData])
  })
})
