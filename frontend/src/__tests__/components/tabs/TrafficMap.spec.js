import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'

import * as SumoBridge from '@/composables/useSumoBridge'
import TrafficMap from '@/components/tabs/TrafficMap.vue'

describe('TrafficMap.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    SumoBridge.isStarting.value = false
    SumoBridge.isReloading.value = false
    SumoBridge.hasUserStarted.value = false
    SumoBridge.sumoState.value = null
    SumoBridge.selectedScenario.value = ''
    SumoBridge.availableScenarios.value = [{ kebabCase: 'test', displayName: 'Test Scen' }]

    vi.spyOn(SumoBridge, 'handleStartSimulation')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders correctly', () => {
    const wrapper = mount(TrafficMap, { props: { runId: 'run-1' } })
    expect(wrapper.find('iframe').exists()).toBe(true)
  })

  it('handles handleStartSimulation click', async () => {
    const wrapper = mount(TrafficMap, { props: { runId: 'run-1' } })
    const btn = wrapper.find('button.btn-success')
    await btn.trigger('click')
    expect(SumoBridge.handleStartSimulation).toHaveBeenCalled()
  })

  it('toggles native fullscreen state and handles errors', async () => {
    const wrapper = mount(TrafficMap, { props: { runId: 'run-1' } })
    const container = wrapper.vm.$refs.fullscreenContainer
    
    // Test success (already partially covered, but lets be sure about isFullscreen toggling)
    container.requestFullscreen = vi.fn().mockResolvedValue(undefined)
    wrapper.vm.toggleFullscreen()
    expect(container.requestFullscreen).toHaveBeenCalled()

    // Test error branch (Lines 128-130)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    container.requestFullscreen = vi.fn().mockRejectedValue(new Error('FS Fail'))
    wrapper.vm.isFullscreen = false
    await wrapper.vm.toggleFullscreen()
    await flushPromises()
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Fullscreen error'))
    
    // Test exit branch (Lines 132-136)
    wrapper.vm.isFullscreen = true
    document.exitFullscreen = vi.fn()
    wrapper.vm.toggleFullscreen()
    expect(document.exitFullscreen).toHaveBeenCalled()
  })

  it('handles handleFullscreenChange correctly', async () => {
    const wrapper = mount(TrafficMap)
    // Mock document.fullscreenElement
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => ({ id: 'traffic-map-root' })
    })
    
    document.dispatchEvent(new Event('fullscreenchange'))
    expect(wrapper.vm.isFullscreen).toBe(true)

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => null
    })
    document.dispatchEvent(new Event('fullscreenchange'))
    expect(wrapper.vm.isFullscreen).toBe(false)
  })

  it('handles handleEscape keydown', async () => {
    const wrapper = mount(TrafficMap)
    wrapper.vm.isFullscreen = true
    
    // Scenario: we think we are in FS, but document says no
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => null
    })

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.vm.isFullscreen).toBe(false)
  })

  it('showLoadingOverlay complex conditions', async () => {
    const wrapper = mount(TrafficMap)
    
    // Reloading -> show overlay
    SumoBridge.isReloading.value = true
    await nextTick()
    expect(wrapper.vm.showLoadingOverlay).toBe(true)
    SumoBridge.isReloading.value = false

    // Starting but no data -> show overlay (Lines 168-171)
    SumoBridge.isStarting.value = true
    wrapper.vm.mapInitialized = true
    SumoBridge.sumoState.value = { stats: { time: 0 } }
    await nextTick()
    expect(wrapper.vm.showLoadingOverlay).toBe(true)

    // Starting with data -> hide overlay
    SumoBridge.sumoState.value = { stats: { time: 10 } }
    await nextTick()
    expect(wrapper.vm.showLoadingOverlay).toBe(false)
  })

  it('activeScenarioDetails fallback (Lines 179-180)', async () => {
    const wrapper = mount(TrafficMap)
    SumoBridge.selectedScenario.value = 'unknown'
    await nextTick()
    expect(wrapper.vm.activeScenarioDetails.displayName).toBe('unknown')
    
    SumoBridge.selectedScenario.value = 'test'
    await nextTick()
    expect(wrapper.vm.activeScenarioDetails.displayName).toBe('Test Scen')
  })

  it('watches isReloading (Lines 183-187)', async () => {
    const wrapper = mount(TrafficMap)
    wrapper.vm.mapInitialized = true
    SumoBridge.isReloading.value = true
    await nextTick()
    expect(wrapper.vm.mapInitialized).toBe(false)
  })

  it('onMessage origin and data check (Lines 191-197)', async () => {
    const wrapper = mount(TrafficMap)
    
    // Wrong origin
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'http://malicious.com',
      data: 'map-ready'
    }))
    expect(wrapper.vm.mapInitialized).toBe(false)

    // Correct origin (3000)
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'http://localhost:3000',
      data: 'map-ready'
    }))
    expect(wrapper.vm.mapInitialized).toBe(true)
  })

  it('unmount cleanup (Lines 228-234)', () => {
    const wrapper = mount(TrafficMap)
    const spy = vi.spyOn(window, 'removeEventListener')
    const docSpy = vi.spyOn(document, 'removeEventListener')
    const clearSpy = vi.spyOn(global, 'clearTimeout')
    
    wrapper.unmount()
    
    expect(spy).toHaveBeenCalledWith('message', expect.any(Function))
    expect(docSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(docSpy).toHaveBeenCalledWith('fullscreenchange', expect.any(Function))
    expect(clearSpy).toHaveBeenCalled()
  })

  it('triggers fallback timer (Lines 221-224)', async () => {
    const wrapper = mount(TrafficMap)
    expect(wrapper.vm.mapInitialized).toBe(false)
    vi.advanceTimersByTime(10001)
    expect(wrapper.vm.mapInitialized).toBe(true)
  })

  it('shows save option and handles save result', async () => {
    SumoBridge.isStarting.value = true
    SumoBridge.hasUserStarted.value = true
    SumoBridge.kpiHistory.value = [
      { time: 10, aql: 5, ewpc: 10, avg_speed: 10, teleports: 2, throughput: 100, total_vehicles: 110 }
    ]
    const wrapper = mount(TrafficMap)
    
    // Simulate stopping
    SumoBridge.isStarting.value = false
    SumoBridge.hasUserStarted.value = false
    await nextTick()
    
    expect(wrapper.vm.hasFinished).toBe(true)

    // Call handleSaveResult
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    
    // Import the actual service to spy on it:
    const { simulationService } = await import('@/services/simulationService')
    const saveSpy = vi.spyOn(simulationService, 'saveResult').mockResolvedValue(undefined)
    
    await wrapper.vm.handleSaveResult()
    expect(saveSpy).toHaveBeenCalled()
    expect(wrapper.vm.hasFinished).toBe(false)
  })

  it('handles restart button click', async () => {
    SumoBridge.isStarting.value = true
    SumoBridge.hasUserStarted.value = true
    SumoBridge.kpiHistory.value = [{ time: 10 }]
    const wrapper = mount(TrafficMap)
    
    SumoBridge.isStarting.value = false
    SumoBridge.hasUserStarted.value = false
    await nextTick()
    
    const restartBtn = wrapper.find('button.btn-outline-secondary')
    expect(restartBtn.exists()).toBe(true)
    await restartBtn.trigger('click')
    expect(SumoBridge.handleStartSimulation).toHaveBeenCalled()
  })

  it('handleSaveResult handles empty history', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    SumoBridge.kpiHistory.value = []
    const wrapper = mount(TrafficMap)
    await wrapper.vm.handleSaveResult()
    expect(alertSpy).toHaveBeenCalledWith('Geen data om op te slaan.')
  })

  it('handleSaveResult handles error', async () => {
    SumoBridge.isStarting.value = false
    SumoBridge.hasUserStarted.value = false
    SumoBridge.kpiHistory.value = [{ time: 1 }]
    const wrapper = mount(TrafficMap)
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    
    const { simulationService } = await import('@/services/simulationService')
    const saveSpy = vi.spyOn(simulationService, 'saveResult').mockRejectedValue(new Error('Save failed'))
    
    await wrapper.vm.handleSaveResult()
    expect(saveSpy).toHaveBeenCalled()
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Fout bij het opslaan: Save failed'))
  })
})
