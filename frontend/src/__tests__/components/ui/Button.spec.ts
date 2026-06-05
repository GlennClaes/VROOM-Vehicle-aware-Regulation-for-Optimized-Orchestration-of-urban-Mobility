import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import Button from '@/components/ui/Button.vue'

describe('Button.vue', () => {
  it('renders with default slot content', () => {
    const wrapper = mount(Button, {
      slots: { default: 'Click me' }
    })
    expect(wrapper.text()).toBe('Click me')
    expect(wrapper.classes()).toContain('btn-primary')
  })

  it('emits click event when clicked', async () => {
    const wrapper = mount(Button)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })

  it('respects the disabled prop', () => {
    const wrapper = mount(Button, {
      props: { disabled: true }
    })
    expect(wrapper.attributes('disabled')).toBeDefined()
  })

  it('applies variant classes correctly', () => {
    const wrapper = mount(Button, {
      props: { variant: 'outline' }
    })
    expect(wrapper.classes()).toContain('btn-outline-secondary')
    
    const ghostWrapper = mount(Button, {
      props: { variant: 'ghost' }
    })
    expect(ghostWrapper.classes()).toContain('btn-light')
  })

  it('sets the correct button type', () => {
    const wrapper = mount(Button, {
      props: { type: 'submit' }
    })
    expect(wrapper.attributes('type')).toBe('submit')
  })
})
