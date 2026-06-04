import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'

vi.mock('@/composables/useSumoBridge', () => {
  const { ref } = require('vue')
  return {
    sumoState: ref(null),
    isStarting: ref(false),
    hasUserStarted: ref(false),
    selectedScenario: ref(''),
    selectedStrategy: ref('baseline'),
    selectedUpdateInterval: ref(1),
    availableScenarios: ref([]),
    sumoActions: {
      startSimulation: vi.fn(),
      pauseSimulation: vi.fn(),
      resumeSimulation: vi.fn(),
      cancelSimulation: vi.fn(),
      changeDelay: vi.fn(),
      changeScenario: vi.fn(),
      changeStrategy: vi.fn(),
      changeUpdateInterval: vi.fn(),
      hardReload: vi.fn(),
    },
  }
})

vi.mock('lucide-vue-next', () => ({
  Clock: { template: '<span class="clock" />' },
  Lock: { template: '<span class="lock" />' },
}))

import IntervalCard from '@/components/dashboard/DashboardSidebarLeft/IntervalCard.vue'

describe('IntervalCard.vue', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/composables/useSumoBridge')
    mod.selectedUpdateInterval.value = 1
    mod.hasUserStarted.value = false
  })

  it('renders interval card with title', () => {
    const wrapper = mount(IntervalCard)
    expect(wrapper.text()).toContain('Update Interval')
  })

  it('renders all options in the select', () => {
    const wrapper = mount(IntervalCard)
    const options = wrapper.findAll('option')
    expect(options.length).toBe(4)
    expect(options[0].element.value).toBe('1')
    expect(options[1].element.value).toBe('2')
    expect(options[2].element.value).toBe('5')
    expect(options[3].element.value).toBe('10')
  })

  it('defaults to selectedUpdateInterval', async () => {
    const { selectedUpdateInterval } = await import('@/composables/useSumoBridge')
    selectedUpdateInterval.value = 5
    const wrapper = mount(IntervalCard)
    await nextTick()
    const select = wrapper.find('select')
    expect(select.element.value).toBe('5')
  })

  it('calls changeUpdateInterval when changing the select option', async () => {
    const { sumoActions } = await import('@/composables/useSumoBridge')
    const wrapper = mount(IntervalCard)
    await nextTick()

    const select = wrapper.find('select')
    await select.setValue('10')

    expect(sumoActions.changeUpdateInterval).toHaveBeenCalledWith(10)
  })

  it('disables the select dropdown when simulation has been started', async () => {
    const { hasUserStarted } = await import('@/composables/useSumoBridge')
    hasUserStarted.value = true
    const wrapper = mount(IntervalCard)
    await nextTick()

    const select = wrapper.find('select')
    expect(select.attributes('disabled')).toBeDefined()
  })

  it('shows lock message when simulation has been started', async () => {
    const { hasUserStarted } = await import('@/composables/useSumoBridge')
    hasUserStarted.value = true
    const wrapper = mount(IntervalCard)
    await nextTick()

    expect(wrapper.text()).toContain('Stop de simulatie om het interval te wijzigen')
  })

  it('does not show lock message when simulation is not running', async () => {
    const wrapper = mount(IntervalCard)
    await nextTick()

    expect(wrapper.text()).not.toContain('Stop de simulatie om het interval te wijzigen')
  })

  it('does not call changeUpdateInterval if select is changed while simulation is running', async () => {
    // In actual usage, the dropdown is disabled, but if event triggers...
    const { hasUserStarted, sumoActions } = await import('@/composables/useSumoBridge')
    hasUserStarted.value = true
    const wrapper = mount(IntervalCard)
    await nextTick()

    // forcefully triggering updateInterval component method via change
    wrapper.vm.updateInterval()
    expect(sumoActions.changeUpdateInterval).not.toHaveBeenCalled()
  })

  it('shows custom interval option when value is not in standard list', async () => {
    const { selectedUpdateInterval } = await import('@/composables/useSumoBridge')
    selectedUpdateInterval.value = 15
    const wrapper = mount(IntervalCard)
    await nextTick()

    const options = wrapper.findAll('option')
    const customOption = options.find(o => o.text().includes('Aangepast'))
    expect(customOption).toBeTruthy()
    expect(customOption.element.value).toBe('15')
  })
})
