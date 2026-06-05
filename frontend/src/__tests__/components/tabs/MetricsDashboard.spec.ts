import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import MetricsDashboard from '@/components/tabs/MetricsDashboard.vue'

describe('MetricsDashboard.vue', () => {
  it('renders correctly as a wrapper', () => {
    const wrapper = mount(MetricsDashboard, {
      props: {
        isRunning: true,
        runId: 'SIM-123'
      },
      global: {
        stubs: {
          KPIContainer: true
        }
      }
    })
    expect(wrapper.find('.metrics-dashboard-wrapper').exists()).toBe(true)
    expect(wrapper.vm.isRunning).toBe(true)
    expect(wrapper.vm.runId).toBe('SIM-123')
  })
})
