import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import App from '@/App.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: { template: '<div/>' } },
  ],
})

describe('App', () => {
  it('renders router-view', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [router],
        stubs: ['router-view'] // stub om parse en render errors te voorkomen
      },
    })

    await router.isReady()

    expect(wrapper.findComponent({ name: 'router-view' }).exists()).toBe(true)
  })
})
