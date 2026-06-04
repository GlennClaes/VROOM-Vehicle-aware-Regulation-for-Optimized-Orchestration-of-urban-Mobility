import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

// 1. Mock MUST be async and at the top to avoid hoisting issues with 'vue'
vi.mock('@/composables/useSumoBridge', async () => {
  const { ref } = await import('vue')
  return {
    sumoState: ref(null),
    isStarting: ref(false),
    hasUserStarted: ref(false),
    selectedScenario: ref(''),
    selectedUpdateInterval: ref(1),
    availableScenarios: ref([]),
    showScenarioError: ref(false),
    sumoActions: {
      startSimulation: vi.fn(),
      pauseSimulation: vi.fn(),
      resumeSimulation: vi.fn(),
      cancelSimulation: vi.fn(),
      changeDelay: vi.fn(),
      changeScenario: vi.fn(),
      hardReload: vi.fn(),
    },
    handleStartSimulation: vi.fn(),
  }
})

vi.mock('lucide-vue-next', () => ({
  Settings: { template: '<span class="settings-icon" />' },
  AlertCircle: { template: '<span class="alert-circle-icon" />' },
}))

// Import component AFTER mock registration
import ControlsCard from '@/components/dashboard/DashboardSidebarLeft/ControlsCard.vue'

const makeState = (overrides = {}) => ({
  scenario: 'scenario-a',
  simulationStatus: 'off',
  stats: { vehicleCounts: {} },
  delayMs: 150,
  ...overrides,
})

describe('ControlsCard.vue', () => {
  beforeEach(async () => {
    const { sumoState, isStarting, hasUserStarted, selectedScenario, sumoActions, handleStartSimulation } = await import('@/composables/useSumoBridge')
    sumoState.value = null
    isStarting.value = false
    hasUserStarted.value = false
    selectedScenario.value = ''
    handleStartSimulation.mockClear()
    vi.clearAllMocks()
  })

  it('shows Start button when simulation is off', async () => {
    const { nextTick } = await import('vue')
    const { sumoState } = await import('@/composables/useSumoBridge')
    sumoState.value = makeState({ simulationStatus: 'off' })
    const wrapper = mount(ControlsCard)
    await nextTick()
    expect(wrapper.text()).toContain('Start Simulatie')
  })

  it('Start button is not disabled when no scenario selected', async () => {
    const { nextTick } = await import('vue')
    const { selectedScenario } = await import('@/composables/useSumoBridge')
    selectedScenario.value = ''
    const wrapper = mount(ControlsCard)
    await nextTick()
    const startBtn = wrapper.find('button.btn-success')
    expect(startBtn.element.disabled).toBe(false)
    expect(wrapper.text()).not.toContain('Kies eerst een scenario om te kunnen starten.')
  })

  it('shows Pauzeer button when simulation is running', async () => {
    const { nextTick } = await import('vue')
    const { sumoState, hasUserStarted } = await import('@/composables/useSumoBridge')
    sumoState.value = makeState({ simulationStatus: 'running' })
    hasUserStarted.value = true
    const wrapper = mount(ControlsCard)
    await nextTick()
    expect(wrapper.find('button.btn-warning').exists()).toBe(true)
  })

  it('shows Stop button when simulation is not off', async () => {
    const { nextTick } = await import('vue')
    const { sumoState, hasUserStarted } = await import('@/composables/useSumoBridge')
    sumoState.value = makeState({ simulationStatus: 'running' })
    hasUserStarted.value = true
    const wrapper = mount(ControlsCard)
    await nextTick()
    expect(wrapper.find('button.btn-outline-danger').exists()).toBe(true)
  })

  it('does not show Stop button when simulation is off', async () => {
    const { nextTick } = await import('vue')
    const { sumoState } = await import('@/composables/useSumoBridge')
    sumoState.value = makeState({ simulationStatus: 'off' })
    const wrapper = mount(ControlsCard)
    await nextTick()
    expect(wrapper.find('button.btn-outline-danger').exists()).toBe(false)
  })

  it('shows speed label Fast when slider is high', async () => {
    const { nextTick } = await import('vue')
    const { sumoState } = await import('@/composables/useSumoBridge')
    sumoState.value = makeState({ delayMs: 10 })
    const wrapper = mount(ControlsCard)
    await nextTick()
    const slider = wrapper.find('input[type="range"]')
    await slider.setValue(90)
    await slider.trigger('input')
    expect(wrapper.text()).toContain('Fast')
  })

  it('shows speed label Slow when slider is low', async () => {
    const { nextTick } = await import('vue')
    const { sumoState } = await import('@/composables/useSumoBridge')
    sumoState.value = makeState({ delayMs: 290 })
    const wrapper = mount(ControlsCard)
    await nextTick()
    const slider = wrapper.find('input[type="range"]')
    await slider.setValue(5)
    await slider.trigger('input')
    expect(wrapper.text()).toContain('Slow')
  })

  it('shows 1x label when slider is mid-range', async () => {
    const { nextTick } = await import('vue')
    const { sumoState } = await import('@/composables/useSumoBridge')
    sumoState.value = makeState({ delayMs: 150 })
    const wrapper = mount(ControlsCard)
    await nextTick()
    expect(wrapper.text()).toContain('1x')
  })

  it('calls startSimulation when Start button is clicked', async () => {
    const { nextTick } = await import('vue')
    const { sumoState, sumoActions, selectedScenario, handleStartSimulation } = await import('@/composables/useSumoBridge')
    sumoState.value = makeState({ simulationStatus: 'off' })
    selectedScenario.value = 'scenario-a'
    const wrapper = mount(ControlsCard)
    await nextTick()

    const startBtn = wrapper.get('button.btn-success')
    await startBtn.trigger('click')
    expect(handleStartSimulation).toHaveBeenCalled()
  })

  it('calls pauseSimulation when Pauzeer button is clicked', async () => {
    const { nextTick } = await import('vue')
    const { sumoState, sumoActions, hasUserStarted } = await import('@/composables/useSumoBridge')
    sumoState.value = makeState({ simulationStatus: 'running' })
    hasUserStarted.value = true
    const wrapper = mount(ControlsCard)
    await nextTick()

    const pauseBtn = wrapper.get('button.btn-warning')
    await pauseBtn.trigger('click')
    expect(sumoActions.pauseSimulation).toHaveBeenCalled()
  })

  it('calls cancelSimulation when Stop button is clicked', async () => {
    const { nextTick } = await import('vue')
    const { sumoState, sumoActions, hasUserStarted } = await import('@/composables/useSumoBridge')
    sumoState.value = makeState({ simulationStatus: 'running' })
    hasUserStarted.value = true
    const wrapper = mount(ControlsCard)
    await nextTick()

    const stopBtn = wrapper.get('button.btn-outline-danger')
    await stopBtn.trigger('click')
    expect(sumoActions.cancelSimulation).toHaveBeenCalled()
  })

  it('calls changeDelay when slider is moved', async () => {
    const { nextTick } = await import('vue')
    const { sumoState, sumoActions } = await import('@/composables/useSumoBridge')
    sumoState.value = makeState({ delayMs: 150 })
    const wrapper = mount(ControlsCard)
    await nextTick()

    const slider = wrapper.find('input[type="range"]')
    await slider.setValue(80)
    await slider.trigger('input')
    expect(sumoActions.changeDelay).toHaveBeenCalled()
  })

  it('shows Loading button when isStarting is true', async () => {
    const { isStarting } = await import('@/composables/useSumoBridge')
    isStarting.value = true
    const wrapper = mount(ControlsCard)
    expect(wrapper.text()).toContain('Laden...')
  })

  it('shows System Prepare button when simulation is loading', async () => {
    const { sumoState, hasUserStarted } = await import('@/composables/useSumoBridge')
    sumoState.value = { simulationStatus: 'loading' }
    hasUserStarted.value = true
    const wrapper = mount(ControlsCard)
    expect(wrapper.text()).toContain('Systeem voorbereiden...')
  })

  it('shows Resume button when simulation is paused', async () => {
    const { sumoState, hasUserStarted } = await import('@/composables/useSumoBridge')
    sumoState.value = { simulationStatus: 'paused' }
    hasUserStarted.value = true
    const wrapper = mount(ControlsCard)
    expect(wrapper.text()).toContain('Hervat Simulatie')
  })

  it('updates slider when sumoState delay changes', async () => {
    const { sumoState } = await import('@/composables/useSumoBridge')
    sumoState.value = { delayMs: 150 }
    const wrapper = mount(ControlsCard)
    const { nextTick } = await import('vue')
    await nextTick()
    
    // Change value
    sumoState.value = { delayMs: 300 } // Should result in 0
    await nextTick()
    await nextTick()
    
    expect(wrapper.find('input[type="range"]').element.value).toBe('0')
  })
})
