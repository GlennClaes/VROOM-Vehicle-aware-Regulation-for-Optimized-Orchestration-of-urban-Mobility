// src/__tests__/views.spec.js
import { mount } from '@vue/test-utils'
import Home from '../views/Home.vue'
import About from '../views/About.vue'
import { describe, it, expect } from 'vitest'

describe('Views', () => {
  it('renders Home', () => {
    const wrapper = mount(Home)
    expect(wrapper.text()).toContain('Home')
  })

  it('renders About', () => {
    const wrapper = mount(About)
    expect(wrapper.text()).toContain('About')
  })
})
