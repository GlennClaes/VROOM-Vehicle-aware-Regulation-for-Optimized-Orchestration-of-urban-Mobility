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
    selectedSamModel: ref(''),
    availableSamModels: ref([]),
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
      fetchModels: vi.fn(),
      changeSamModel: vi.fn(),
      hardReload: vi.fn(),
    },
  }
})

vi.mock('lucide-vue-next', () => ({
  BrainCircuit: { template: '<span class="brain-circuit" />' },
  Timer: { template: '<span class="timer" />' },
  Lock: { template: '<span class="lock" />' },
}))

import StrategyCard from '@/components/dashboard/DashboardSidebarLeft/StrategyCard.vue'

describe('StrategyCard.vue', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/composables/useSumoBridge')
    mod.selectedStrategy.value = 'baseline'
    mod.hasUserStarted.value = false
  })

  it('renders strategy card with title', () => {
    const wrapper = mount(StrategyCard)
    expect(wrapper.text()).toContain('Strategie')
  })

  it('renders both Baseline and SAM buttons', () => {
    const wrapper = mount(StrategyCard)
    expect(wrapper.text()).toContain('Baseline')
    expect(wrapper.text()).toContain('SAM Model')
  })

  it('defaults to baseline strategy selected', async () => {
    const wrapper = mount(StrategyCard)
    await nextTick()
    const baselineBtn = wrapper.find('#strategy-btn-baseline')
    expect(baselineBtn.classes()).toContain('strategy-btn-active')
  })

  it('shows SAM as active when selectedStrategy is sam', async () => {
    const { selectedStrategy } = await import('@/composables/useSumoBridge')
    selectedStrategy.value = 'sam'
    const wrapper = mount(StrategyCard)
    await nextTick()
    const samBtn = wrapper.find('#strategy-btn-sam')
    expect(samBtn.classes()).toContain('strategy-btn-active')
  })

  it('calls changeStrategy when clicking a different strategy button', async () => {
    const { sumoActions } = await import('@/composables/useSumoBridge')
    const wrapper = mount(StrategyCard)
    await nextTick()
    await wrapper.find('#strategy-btn-sam').trigger('click')
    expect(sumoActions.changeStrategy).toHaveBeenCalledWith('sam')
  })

  it('disables buttons when simulation is running', async () => {
    const { hasUserStarted } = await import('@/composables/useSumoBridge')
    hasUserStarted.value = true
    const wrapper = mount(StrategyCard)
    await nextTick()
    const baselineBtn = wrapper.find('#strategy-btn-baseline')
    const samBtn = wrapper.find('#strategy-btn-sam')
    expect(baselineBtn.attributes('disabled')).toBeDefined()
    expect(samBtn.attributes('disabled')).toBeDefined()
  })

  it('shows lock message when simulation is running', async () => {
    const { hasUserStarted } = await import('@/composables/useSumoBridge')
    hasUserStarted.value = true
    const wrapper = mount(StrategyCard)
    await nextTick()
    expect(wrapper.text()).toContain('Stop de simulatie om van strategie te wisselen')
  })

  it('does not show lock message when simulation is not running', async () => {
    const wrapper = mount(StrategyCard)
    await nextTick()
    expect(wrapper.text()).not.toContain('Stop de simulatie om van strategie te wisselen')
  })

  it('shows correct indicator for baseline strategy', async () => {
    const wrapper = mount(StrategyCard)
    await nextTick()
    expect(wrapper.text()).toContain('Vaste tijdsintervallen voor verkeerslichten')
  })

  it('shows correct indicator for SAM strategy', async () => {
    const { selectedStrategy } = await import('@/composables/useSumoBridge')
    selectedStrategy.value = 'sam'
    const wrapper = mount(StrategyCard)
    await nextTick()
    expect(wrapper.text()).toContain('AI-model optimaliseert verkeerslichten')
  })

  it('does not call changeStrategy when clicking disabled button', async () => {
    const { hasUserStarted, sumoActions } = await import('@/composables/useSumoBridge')
    hasUserStarted.value = true
    sumoActions.changeStrategy.mockClear()
    const wrapper = mount(StrategyCard)
    await nextTick()
    await wrapper.find('#strategy-btn-sam').trigger('click')
    expect(sumoActions.changeStrategy).not.toHaveBeenCalled()
  })

  it('shows model dropdown when SAM strategy is selected', async () => {
    const { selectedStrategy, availableSamModels } = await import('@/composables/useSumoBridge')
    selectedStrategy.value = 'sam'
    availableSamModels.value = [{ name: 'model1', size_kb: 100, path: 'p1' }]
    
    const wrapper = mount(StrategyCard)
    await nextTick()
    
    expect(wrapper.find('select').exists()).toBe(true)
    expect(wrapper.text()).toContain('model1 (100 KB)')
  })

  it('shows "no models found" when availableSamModels is empty', async () => {
    const { selectedStrategy, availableSamModels } = await import('@/composables/useSumoBridge')
    selectedStrategy.value = 'sam'
    availableSamModels.value = []
    
    const wrapper = mount(StrategyCard)
    await nextTick()
    
    expect(wrapper.text()).toContain('Geen modellen gevonden')
  })

  it('calls changeSamModel when selecting a model', async () => {
    const { selectedStrategy, availableSamModels, sumoActions } = await import('@/composables/useSumoBridge')
    selectedStrategy.value = 'sam'
    availableSamModels.value = [{ name: 'model1', size_kb: 100, path: 'p1' }]
    
    const wrapper = mount(StrategyCard)
    await nextTick()
    
    const select = wrapper.find('select')
    await select.setValue('model1')
    await select.trigger('change')
    
    expect(sumoActions.changeSamModel).toHaveBeenCalledWith('model1')
  })

  it('shows last modified date when model has modified property', async () => {
    const { selectedStrategy, availableSamModels, selectedSamModel } = await import('@/composables/useSumoBridge')
    selectedStrategy.value = 'sam'
    const modifiedDate = new Date('2023-01-01').toISOString()
    availableSamModels.value = [{ name: 'm1', size_kb: 10, path: 'p1', modified: modifiedDate }]
    selectedSamModel.value = 'm1'
    
    const wrapper = mount(StrategyCard)
    await nextTick()
    
    expect(wrapper.text()).toContain('Laatst gewijzigd')
  })
})
