import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import DashboardSidebarLeft from '@/components/dashboard/DashboardSidebarLeft.vue'

const { mockClickedPoint } = vi.hoisted(() => {
  const { ref } = require('vue')
  return {
    mockClickedPoint: ref(null)
  }
})

vi.mock('@/composables/useSumoBridge', () => {
  const { ref } = require('vue')
  return {
    sumoState: ref(null),
    isStarting: ref(false),
    isReloading: ref(false),
    hasUserStarted: ref(false),
    clickedPoint: mockClickedPoint,
    selectedScenario: ref(''),
    availableScenarios: ref([]),
    selectedStrategy: ref('baseline'),
    availableSamModels: ref([]),
    selectedUpdateInterval: ref(1),
    sumoActions: {
      startSimulation: vi.fn(),
      pauseSimulation: vi.fn(),
      resumeSimulation: vi.fn(),
      cancelSimulation: vi.fn(),
      changeDelay: vi.fn(),
      changeScenario: vi.fn(),
      hardReload: vi.fn(),
      fetchModels: vi.fn(),
    }
  }
})

// Mock child components
vi.mock('@/components/dashboard/DashboardSidebarLeft/ScenarioCard.vue', () => ({
  default: { template: '<div class="scenario-card-mock" />' },
}))
vi.mock('@/components/dashboard/DashboardSidebarLeft/ControlsCard.vue', () => ({
  default: { template: '<div class="controls-card-mock" />' },
}))
vi.mock('@/components/dashboard/DashboardSidebarLeft/LocationDetailsCard.vue', () => ({
  default: { 
    template: '<div v-if="clickedPoint" class="location-details-card-mock" />',
    setup() {
      return { clickedPoint: mockClickedPoint }
    }
  },
}))
vi.mock('@/components/dashboard/DashboardSidebarLeft/StrategyCard.vue', () => ({
  default: { template: '<div class="strategy-card-mock" />' },
}))
vi.mock('@/components/dashboard/DashboardSidebarLeft/IntervalCard.vue', () => ({
  default: { template: '<div class="interval-card-mock" />' },
}))

describe('DashboardSidebarLeft.vue', () => {
  beforeEach(() => {
    // Reset de waarde voor elke test
    mockClickedPoint.value = null
    vi.clearAllMocks()
  })

  it('renders ScenarioCard, ControlsCard and StrategyCard by default', () => {
    const wrapper = mount(DashboardSidebarLeft)
    expect(wrapper.find('.scenario-card-mock').exists()).toBe(true)
    expect(wrapper.find('.controls-card-mock').exists()).toBe(true)
    expect(wrapper.find('.strategy-card-mock').exists()).toBe(true)
  })

  it('renders LocationDetailsCard when clickedPoint is set', async () => {
    // Update de mock waarde
    mockClickedPoint.value = { lat: 51.2194, lng: 4.4025 }
    
    const wrapper = mount(DashboardSidebarLeft)
    await nextTick()
    
    expect(wrapper.find('.location-details-card-mock').exists()).toBe(true)
  })

  it('does not render LocationDetailsCard when clickedPoint is null', async () => {
    mockClickedPoint.value = null
    
    const wrapper = mount(DashboardSidebarLeft)
    await nextTick()
    
    expect(wrapper.find('.location-details-card-mock').exists()).toBe(false)
  })
})
