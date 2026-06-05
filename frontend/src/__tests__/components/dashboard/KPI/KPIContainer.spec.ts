import { mount, shallowMount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import KPIContainer from '@/components/dashboard/KPI/KPIContainer.vue'

const vi_bridge = vi.hoisted(() => {
  const makeRef = (val) => ({
    _val: val,
    get value() { return this._val },
    set value(v) { this._val = v },
    __v_isRef: true
  })
  return {
    sumoState: makeRef({ simulationStatus: 'off', stats: { kpis: {} } }),
    sumoActions: { exportData: vi.fn() },
    isStarting: makeRef(false),
    hasUserStarted: makeRef(false),
    kpiHistory: makeRef([])
  }
})

vi.mock('@/composables/useSumoBridge', () => vi_bridge)

describe('KPIContainer.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi_bridge.isStarting.value = false
    vi_bridge.hasUserStarted.value = false
    vi_bridge.kpiHistory.value = []
    vi_bridge.sumoState.value = { simulationStatus: 'off', stats: { kpis: {} } }
  })

  it('renders correctly', () => {
    const wrapper = shallowMount(KPIContainer, {
      props: { isRunning: false },
      global: {
        stubs: { KPIChart: true, KPIEmptyState: true, KPICard: true }
      }
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('shows empty state when not running', () => {
    const wrapper = mount(KPIContainer)
    expect(wrapper.findComponent({ name: 'KPIEmptyState' }).exists()).toBe(true)
  })

  it('switches between grid and trend view and back', async () => {
    vi_bridge.hasUserStarted.value = true
    vi_bridge.sumoState.value = { simulationStatus: 'running', stats: { kpis: { tnr: 1 } } }
    
    const wrapper = mount(KPIContainer, {
      global: { stubs: { KPIChart: true, KPIEmptyState: true, KPICard: true } }
    })
    
    const buttons = wrapper.findAll('.nav-link')
    await buttons[1].trigger('click') // Trend
    expect(wrapper.vm.viewMode).toBe('trend')
    
    await buttons[0].trigger('click') // Grid
    expect(wrapper.vm.viewMode).toBe('grid')
  })

  it('handles chart title for single vs multiple KPIs', async () => {
    vi_bridge.hasUserStarted.value = true
    vi_bridge.sumoState.value = { simulationStatus: 'running', stats: { kpis: { tnr: 1 } } }
    
    const wrapper = mount(KPIContainer, {
      global: { stubs: { KPIChart: true, KPIEmptyState: true, KPICard: true } }
    })
    
    await wrapper.findAll('.nav-link')[1].trigger('click')
    
    // Default is 3 KPIs
    expect(wrapper.vm.chartTitle).toBe('Vergelijkende Trend Analyse')
    
    // Select only 1
    wrapper.vm.selectedKpiKeys = ['tnr']
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.chartTitle).toContain('Trend: Total Negative Reward')
    
    // Fallback if key missing
    wrapper.vm.selectedKpiKeys = ['unknown']
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.chartTitle).toBe('Trend: KPI')
  })

  it('prevents deselecting the last KPI', async () => {
    vi_bridge.hasUserStarted.value = true
    vi_bridge.sumoState.value = { simulationStatus: 'running', stats: { kpis: { tnr: 1 } } }
    
    const wrapper = mount(KPIContainer, {
      global: { stubs: { KPIChart: true, KPIEmptyState: true, KPICard: true } }
    })
    
    wrapper.vm.selectedKpiKeys = ['tnr']
    await wrapper.vm.$nextTick()
    
    // Try to deselect 'tnr'
    wrapper.vm.toggleKpiSelection('tnr')
    expect(wrapper.vm.selectedKpiKeys).toEqual(['tnr'])
  })

  it('limits KPI selection to 4 and replaces oldest', async () => {
    vi_bridge.hasUserStarted.value = true
    vi_bridge.sumoState.value = { simulationStatus: 'running', stats: { kpis: { tnr: 1 } } }
    const wrapper = mount(KPIContainer, {
      global: { stubs: { KPIChart: true, KPIEmptyState: true, KPICard: true } }
    })
    
    wrapper.vm.selectedKpiKeys = ['a', 'b', 'c', 'd']
    wrapper.vm.toggleKpiSelection('e')
    
    expect(wrapper.vm.selectedKpiKeys).toEqual(['b', 'c', 'd', 'e'])
  })

  it('triggers export actions', async () => {
    vi_bridge.hasUserStarted.value = true
    vi_bridge.sumoState.value = { simulationStatus: 'running', stats: { kpis: { tnr: 1 } } }
    const wrapper = mount(KPIContainer)
    
    await wrapper.find('.dropdown-toggle').trigger('click')
    const items = wrapper.findAll('.dropdown-item')
    await items[0].trigger('click') // CSV
    expect(vi_bridge.sumoActions.exportData).toHaveBeenCalledWith('csv')
  })
})
