import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import KeyboardHelp from '../../../components/sumo/KeyboardHelp.vue'

describe('KeyboardHelp.vue', () => {
  it('renders the Help button', () => {
    const wrapper = mount(KeyboardHelp)
    expect(wrapper.find('button').text()).toBe('Help')
  })

  it('dialog is hidden by default', () => {
    const wrapper = mount(KeyboardHelp)
    expect(wrapper.find('.dialog-backdrop').exists()).toBe(false)
  })

  it('opens dialog when Help button is clicked', async () => {
    const wrapper = mount(KeyboardHelp)
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('.dialog-backdrop').exists()).toBe(true)
  })

  it('Help button is disabled when dialog is open', async () => {
    const wrapper = mount(KeyboardHelp)
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('button[disabled]').exists()).toBe(true)
  })

  it('closes dialog when OK button is clicked', async () => {
    const wrapper = mount(KeyboardHelp)
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('.dialog-backdrop').exists()).toBe(true)
    await wrapper.find('.btn-primary').trigger('click')
    expect(wrapper.find('.dialog-backdrop').exists()).toBe(false)
  })

  it('closes dialog when backdrop is clicked', async () => {
    const wrapper = mount(KeyboardHelp)
    await wrapper.find('button').trigger('click')
    await wrapper.find('.dialog-backdrop').trigger('click')
    expect(wrapper.find('.dialog-backdrop').exists()).toBe(false)
  })

  it('shows keyboard controls in the dialog', async () => {
    const wrapper = mount(KeyboardHelp)
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('.dialog').text()).toContain('Keyboard Controls')
  })

  it('shows mouse controls in the dialog', async () => {
    const wrapper = mount(KeyboardHelp)
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('.dialog').text()).toContain('Mouse Controls')
  })
})
