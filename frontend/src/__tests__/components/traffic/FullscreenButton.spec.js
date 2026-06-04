import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FullscreenButton from '@/components/traffic/FullscreenButton.vue'
import { Maximize, Minimize } from 'lucide-vue-next'

describe('FullscreenButton.vue', () => {
  it('renders maximum icon when not fullscreen', () => {
    const wrapper = mount(FullscreenButton, {
      props: {
        isFullscreen: false
      }
    })

    expect(wrapper.findComponent(Maximize).exists()).toBe(true)
    expect(wrapper.findComponent(Minimize).exists()).toBe(false)
    expect(wrapper.text()).toContain('Volledig scherm')
  })

  it('renders minimize icon when fullscreen', () => {
    const wrapper = mount(FullscreenButton, {
      props: {
        isFullscreen: true
      }
    })

    expect(wrapper.findComponent(Maximize).exists()).toBe(false)
    expect(wrapper.findComponent(Minimize).exists()).toBe(true)
    expect(wrapper.text()).toContain('Minimaliseren')
  })

  it('emits toggle event on click', async () => {
    const wrapper = mount(FullscreenButton)

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted()).toHaveProperty('toggle')
    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })

  it('has correct title attribute', () => {
    const wrapper = mount(FullscreenButton)

    expect(wrapper.find('button').attributes('title')).toBe('Volledig scherm')
  })
})
