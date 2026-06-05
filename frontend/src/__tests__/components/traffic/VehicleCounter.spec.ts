import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick } from 'vue'

// Mock useSumoBridge
vi.mock('@/composables/useSumoBridge', async () => {
  const { ref } = await import('vue')
  const sumoState = ref(null)
  return {
    sumoState
  }
})

import VehicleCounter from '@/components/traffic/VehicleCounter.vue'
import { sumoState } from '@/composables/useSumoBridge'

describe('VehicleCounter.vue', () => {
  it('displays 0 when no vehicle counts are available', async () => {
    sumoState.value = { stats: { vehicleCounts: {} } }
    const wrapper = mount(VehicleCounter)
    await nextTick()
    expect(wrapper.text()).toContain('0')
  })

  it('correctly sums multiple vehicle classes', async () => {
    sumoState.value = {
      stats: {
        vehicleCounts: {
          passenger: 10,
          bus: 5,
          truck: 2
        }
      }
    }
    const wrapper = mount(VehicleCounter)
    await nextTick()

    // Total should be 17
    expect(wrapper.get('.fw-bold').text()).toBe('17')
  })

  it('handles null stats gracefully', async () => {
    sumoState.value = null
    const wrapper = mount(VehicleCounter)
    await nextTick()
    expect(wrapper.text()).toContain('0')
  })

  it('handles missing vehicleCounts gracefully', async () => {
    sumoState.value = { stats: {} }
    const wrapper = mount(VehicleCounter)
    await nextTick()
    expect(wrapper.text()).toContain('0')
  })
})
