import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ModelComparison from '@/components/tabs/ModelComparison.vue'
import { simulationService } from '@/services/simulationService'

// Mock the simulation service
vi.mock('@/services/simulationService', () => ({
  simulationService: {
    getResults: vi.fn(),
    deleteResult: vi.fn()
  }
}))

// Create mock data
const createMockResult = (id, strategy, avg_speed, avg_wait_time, throughput, total_steps, total_vehicles, avg_queue = 0, data_points = null, date_time = '2026-05-18T10:00:00Z') => ({
  id,
  strategy,
  avg_speed,
  avg_wait_time,
  throughput,
  total_steps,
  total_vehicles,
  avg_queue,
  date_time,
  data_points: data_points ? JSON.stringify(data_points) : null
})

describe('ModelComparison.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('computes strategy averages correctly', async () => {
    // Setup mock data
    const mockResults = [
      createMockResult(1, 'Baseline', 30, 20, 100, 60, 10, 5, [{ time: 10, ttt: 500 }]),
      createMockResult(2, 'Baseline', 40, 10, 120, 60, 20, 3, [{ time: 10, ttt: 800 }]),
      createMockResult(3, 'AI Adaptive', 50, 5, 200, 60, 30, 1, [{ time: 10, ttt: 900 }])
    ]
    simulationService.getResults.mockResolvedValue(mockResults)

    const wrapper = mount(ModelComparison)
    
    // Wait for onMounted to fetch results and compute
    await new Promise(resolve => setTimeout(resolve, 50))
    await wrapper.vm.$nextTick()

    const averages = wrapper.vm.strategyAverages

    expect(averages.length).toBe(2)

    // Check Baseline
    const baselineAvg = averages.find(a => a.strategy === 'Baseline')
    expect(baselineAvg.count).toBe(2)
    expect(baselineAvg.avgSpeed).toBe(35) // (30 + 40) / 2
    expect(baselineAvg.avgDelay).toBe(15) // (20 + 10) / 2
    expect(baselineAvg.flowRate).toBe(110) // (100/(60/60) + 120/(60/60)) / 2
    expect(baselineAvg.avgTravelTime).toBe(45) // (500/10 + 800/20) / 2 = (50 + 40) / 2

    // Check AI Adaptive
    const aiAvg = averages.find(a => a.strategy === 'AI Adaptive')
    expect(aiAvg.count).toBe(1)
    expect(aiAvg.avgSpeed).toBe(50)
    expect(aiAvg.avgDelay).toBe(5)
    expect(aiAvg.flowRate).toBe(200)
    expect(aiAvg.avgTravelTime).toBe(30) // 900 / 30

    // Check best values
    expect(baselineAvg.isBestTravelTime).toBe(false)
    expect(aiAvg.isBestTravelTime).toBe(true) // 30 is lower than 45

    expect(baselineAvg.isBestSpeed).toBe(false)
    expect(aiAvg.isBestSpeed).toBe(true) // 50 is higher than 35

    expect(baselineAvg.isBestFlow).toBe(false)
    expect(aiAvg.isBestFlow).toBe(true) // 200 is higher than 110

    expect(baselineAvg.isBestDelay).toBe(false)
    expect(aiAvg.isBestDelay).toBe(true) // 5 is lower than 15
  })

  it('renders the average performance section when results exist', async () => {
    const mockResults = [
      createMockResult(1, 'Baseline', 30, 20, 100, 60, 10, 5)
    ]
    simulationService.getResults.mockResolvedValue(mockResults)

    const wrapper = mount(ModelComparison)
    await new Promise(resolve => setTimeout(resolve, 50))
    await wrapper.vm.$nextTick()

    // The section should exist
    expect(wrapper.find('.avg-performance-section').exists()).toBe(true)
    
    // There should be one strategy card
    expect(wrapper.findAll('.strategy-avg-card').length).toBe(1)
    
    // The strategy name should be rendered
    expect(wrapper.text()).toContain('Baseline')
  })

  it('hides the average performance section when no results exist', async () => {
    simulationService.getResults.mockResolvedValue([])

    const wrapper = mount(ModelComparison)
    await new Promise(resolve => setTimeout(resolve, 50))
    await wrapper.vm.$nextTick()

    // The section should not exist
    expect(wrapper.find('.avg-performance-section').exists()).toBe(false)
  })

  it('toggles selection of results up to a maximum of 3', async () => {
    // Suppress window.alert for this test
    const originalAlert = window.alert
    window.alert = vi.fn()

    const mockResults = [
      createMockResult(1, 'Baseline', 30, 20, 100, 60, 10, 5),
      createMockResult(2, 'Baseline', 40, 10, 120, 60, 20, 3),
      createMockResult(3, 'AI', 50, 5, 200, 60, 30, 1),
      createMockResult(4, 'AI', 60, 2, 220, 60, 40, 1)
    ]
    simulationService.getResults.mockResolvedValue(mockResults)

    const wrapper = mount(ModelComparison)
    await new Promise(resolve => setTimeout(resolve, 50))
    await wrapper.vm.$nextTick()

    const resultCards = wrapper.findAll('.list-group-item')
    expect(resultCards.length).toBe(4)

    // Select first 3
    await resultCards[0].trigger('click')
    await resultCards[1].trigger('click')
    await resultCards[2].trigger('click')

    expect(wrapper.vm.selectedIds).toEqual([1, 2, 3])

    // Try to select 4th
    await resultCards[3].trigger('click')
    
    // Should alert and not add
    expect(window.alert).toHaveBeenCalledWith('U kunt maximaal 3 simulaties tegelijk vergelijken.')
    expect(wrapper.vm.selectedIds).toEqual([1, 2, 3])

    // Deselect first
    await resultCards[0].trigger('click')
    expect(wrapper.vm.selectedIds).toEqual([2, 3])

    window.alert = originalAlert
  })

  it('deletes a result when confirmed', async () => {
    // Mock window.confirm to return true
    const originalConfirm = window.confirm
    window.confirm = vi.fn(() => true)

    const mockResults = [
      createMockResult(1, 'Baseline', 30, 20, 100, 60, 10, 5)
    ]
    simulationService.getResults.mockResolvedValue(mockResults)

    const wrapper = mount(ModelComparison)
    await new Promise(resolve => setTimeout(resolve, 50))
    await wrapper.vm.$nextTick()

    const deleteBtn = wrapper.find('.btn-link.text-danger')
    await deleteBtn.trigger('click')

    expect(window.confirm).toHaveBeenCalledWith('Weet u zeker dat u deze simulatie wilt verwijderen?')
    expect(simulationService.deleteResult).toHaveBeenCalledWith(1)
    expect(simulationService.getResults).toHaveBeenCalledTimes(2) // Once on mount, once after delete

    window.confirm = originalConfirm
  })

  it('exports to CSV properly', async () => {
    // Mock URL.createObjectURL and document manipulation
    const originalCreateObjectURL = global.URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:test')
    
    const originalCreateElement = document.createElement
    const mockClick = vi.fn()
    const mockSetAttribute = vi.fn()
    const mockElement = { 
      click: mockClick, 
      setAttribute: mockSetAttribute,
      style: {},
      download: ''
    }
    
    document.createElement = vi.fn((tag) => {
      if (tag === 'a') return mockElement
      return originalCreateElement.call(document, tag)
    })
    
    const mockAppendChild = vi.fn()
    const mockRemoveChild = vi.fn()
    const originalBodyAppend = document.body.appendChild
    const originalBodyRemove = document.body.removeChild
    
    document.body.appendChild = mockAppendChild
    document.body.removeChild = mockRemoveChild

    const mockResults = [
      createMockResult(1, 'Baseline', 30, 20, 100, 60, 10, 5, [{ time: 10, ttt: 500 }])
    ]
    simulationService.getResults.mockResolvedValue(mockResults)

    const wrapper = mount(ModelComparison)
    await new Promise(resolve => setTimeout(resolve, 50))
    await wrapper.vm.$nextTick()

    const exportBtn = wrapper.find('button[title="Exporteer naar CSV"]')
    await exportBtn.trigger('click')

    expect(global.URL.createObjectURL).toHaveBeenCalled()
    expect(mockSetAttribute).toHaveBeenCalledWith('href', 'blob:test')
    expect(mockSetAttribute).toHaveBeenCalledWith('download', expect.any(String))
    expect(mockClick).toHaveBeenCalled()
    expect(mockAppendChild).toHaveBeenCalledWith(mockElement)
    expect(mockRemoveChild).toHaveBeenCalledWith(mockElement)

    // Restore globals
    global.URL.createObjectURL = originalCreateObjectURL
    document.createElement = originalCreateElement
    document.body.appendChild = originalBodyAppend
    document.body.removeChild = originalBodyRemove
  })
})

