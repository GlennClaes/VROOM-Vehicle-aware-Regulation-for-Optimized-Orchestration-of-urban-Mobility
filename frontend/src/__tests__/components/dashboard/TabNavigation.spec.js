import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import TabsNav from '@/components/dashboard/TabNavigation.vue'

import { markRaw } from 'vue'

const DummyIcon = markRaw({
  template: '<svg class="icon"></svg>'
})

const tabs = [
  { id: 'home', label: 'Home', icon: DummyIcon },
  { id: 'profile', label: 'Profile', icon: DummyIcon },
  { id: 'settings', label: 'Settings', icon: DummyIcon }
]

describe('TabsNav.vue', () => {

  it('renders component', () => {
    const wrapper = mount(TabsNav, {
      props: { tabs, activeTab: 'home' }
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('renders correct number of tabs', () => {
    const wrapper = mount(TabsNav, {
      props: { tabs, activeTab: 'home' }
    })

    const buttons = wrapper.findAll('.tab-item')
    expect(buttons.length).toBe(3)
  })

  it('renders tab labels', () => {
    const wrapper = mount(TabsNav, {
      props: { tabs, activeTab: 'home' }
    })

    const text = wrapper.text()
    expect(text).toContain('Home')
    expect(text).toContain('Profile')
    expect(text).toContain('Settings')
  })

  it('renders icons for each tab', () => {
    const wrapper = mount(TabsNav, {
      props: { tabs, activeTab: 'home' }
    })

    const icons = wrapper.findAll('.icon')
    expect(icons.length).toBe(3)
  })

  it('applies active class to active tab', () => {
    const wrapper = mount(TabsNav, {
      props: { tabs, activeTab: 'profile' }
    })

    const buttons = wrapper.findAll('.tab-item')

    expect(buttons[1].classes()).toContain('active')
  })

  it('does not apply active class to inactive tabs', () => {
    const wrapper = mount(TabsNav, {
      props: { tabs, activeTab: 'profile' }
    })

    const buttons = wrapper.findAll('.tab-item')

    expect(buttons[0].classes()).not.toContain('active')
    expect(buttons[2].classes()).not.toContain('active')
  })

  it('emits update:activeTab when clicked', async () => {
    const wrapper = mount(TabsNav, {
      props: { tabs, activeTab: 'home' }
    })

    const buttons = wrapper.findAll('.tab-item')

    await buttons[1].trigger('click')

    expect(wrapper.emitted()).toHaveProperty('update:activeTab')
  })

  it('emits correct tab id when clicked', async () => {
    const wrapper = mount(TabsNav, {
      props: { tabs, activeTab: 'home' }
    })

    const buttons = wrapper.findAll('.tab-item')

    await buttons[2].trigger('click')

    const emitted = wrapper.emitted('update:activeTab')
    expect(emitted[0]).toEqual(['settings'])
  })

  it('emits event multiple times on multiple clicks', async () => {
    const wrapper = mount(TabsNav, {
      props: { tabs, activeTab: 'home' }
    })

    const buttons = wrapper.findAll('.tab-item')

    await buttons[1].trigger('click')
    await buttons[2].trigger('click')

    const emitted = wrapper.emitted('update:activeTab')

    expect(emitted.length).toBe(2)
  })

  it('updates active class when prop changes', async () => {
    const wrapper = mount(TabsNav, {
      props: { tabs, activeTab: 'home' }
    })

    await wrapper.setProps({ activeTab: 'settings' })

    const buttons = wrapper.findAll('.tab-item')

    expect(buttons[2].classes()).toContain('active')
  })

  it('renders nothing when tabs array empty', () => {
    const wrapper = mount(TabsNav, {
      props: { tabs: [], activeTab: '' }
    })

    const buttons = wrapper.findAll('.tab-item')
    expect(buttons.length).toBe(0)
  })

})
