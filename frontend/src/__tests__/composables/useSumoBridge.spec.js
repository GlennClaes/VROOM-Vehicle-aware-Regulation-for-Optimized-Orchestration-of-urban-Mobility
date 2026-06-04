import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

global.fetch = vi.fn()

const mockSave = vi.fn()
const mockAutoTable = vi.fn()

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    text: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    line: vi.fn(),
    save: mockSave,
    internal: { getNumberOfPages: () => 1, pageSize: { getWidth: () => 200, getHeight: () => 300 } },
    setPage: vi.fn(),
    addPage: vi.fn()
  }))
}))

vi.mock('jspdf-autotable', () => ({ default: mockAutoTable }))

describe('useSumoBridge', () => {
  let sumoState, mapFrameRef, bindMapFrame, sumoActions, kpiHistory, aiDecisionHistory, simulationLogs, isStarting, hasUserStarted
  let initSumoBridge, destroySumoBridge, handleSumoMessage, handleStartSimulation, sumoActionNames, selectedScenario, selectedStrategy, selectedSamModel, selectedUpdateInterval, availableSamModels, clickedPoint, showScenarioError

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10000)
    // No resetModules here to keep coverage stable across the dynamic loop
    const mod = await import('../../composables/useSumoBridge.js')
    
    sumoState = mod.sumoState
    mapFrameRef = mod.mapFrameRef
    bindMapFrame = mod.bindMapFrame
    sumoActions = mod.sumoActions
    initSumoBridge = mod.initSumoBridge
    destroySumoBridge = mod.destroySumoBridge
    handleSumoMessage = mod.handleSumoMessage
    handleStartSimulation = mod.handleStartSimulation
    sumoActionNames = mod.sumoActionNames
    kpiHistory = mod.kpiHistory
    aiDecisionHistory = mod.aiDecisionHistory
    simulationLogs = mod.simulationLogs
    isStarting = mod.isStarting
    hasUserStarted = mod.hasUserStarted
    selectedScenario = mod.selectedScenario
    selectedStrategy = mod.selectedStrategy
    selectedSamModel = mod.selectedSamModel
    selectedUpdateInterval = mod.selectedUpdateInterval
    availableSamModels = mod.availableSamModels
    clickedPoint = mod.clickedPoint
    showScenarioError = mod.showScenarioError

    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
    kpiHistory.value = []
    aiDecisionHistory.value = []
    mod.clearLogs()
    mockSave.mockClear()
    mockAutoTable.mockClear()
  })

  afterEach(() => {
    destroySumoBridge()
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('covers the dynamic action loop (Lines 48-71)', () => {
    const postMessage = vi.fn()
    bindMapFrame({ contentWindow: { postMessage } })
    
    // Test startSimulation special case
    sumoActions.startSimulation()
    expect(isStarting.value).toBe(true)
    expect(hasUserStarted.value).toBe(true)

    // Test cancelSimulation special case (Lines 54-60)
    sumoActions.cancelSimulation()
    expect(isStarting.value).toBe(false)
    expect(clickedPoint.value).toBeNull()
    expect(kpiHistory.value.length).toBe(0)
    expect(aiDecisionHistory.value.length).toBe(0)
  })

  it('changeScenario covers preload branch (Lines 97-98)', async () => {
    const postMessage = vi.fn()
    bindMapFrame({ src: 'http://localhost:3000', contentWindow: { postMessage } })
    await sumoActions.changeScenario('test')
    vi.advanceTimersByTime(1001)
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ action: 'preload' }), '*')
  })

  it('changeStrategy covers persistence error (Line 158)', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Persistent Fail'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
    hasUserStarted.value = false
    await sumoActions.changeStrategy('sam')
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to persist strategy'), expect.any(Error))
  })

  it('changeSamModel covers persistence error (Line 208)', async () => {
    global.fetch.mockRejectedValueOnce(new Error('SAM Fail'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
    hasUserStarted.value = false
    await sumoActions.changeSamModel('my-model')
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to persist sam_model'), expect.any(Error))
  })

  it('exportData covers PDF error branches (Lines 281-283)', async () => {
    kpiHistory.value = [{ time: 10, stats: {} }]
    mockSave.mockImplementationOnce(() => { throw new Error('Disk Full') })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { })
    await sumoActions.exportData('pdf')
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Export mislukt'))
  })

  it('handleSumoMessage covers samModel and kpi branches (Lines 328, 333-353)', () => {
    kpiHistory.value = []
    vi.setSystemTime(20000)
    
    const fakeState = { 
      samModel: 'active-model',
      stats: { time: 10, kpis: { tnr: -1 } }
    }
    
    handleSumoMessage({ data: { type: 'sumo-state', state: fakeState } })
    expect(selectedSamModel.value).toBe('active-model')
    expect(kpiHistory.value.length).toBe(1)
    
    // Test slice(-300) branch
    kpiHistory.value = Array(300).fill({ time: 1 })
    vi.advanceTimersByTime(2000)
    handleSumoMessage({ data: { type: 'sumo-state', state: { stats: { time: 11, kpis: { tnr: -2 } } } } })
    expect(kpiHistory.value.length).toBe(300)
  })

  it('logs changed KPIs as a grouped filterable log entry', () => {
    selectedScenario.value = 'centrum'
    vi.setSystemTime(20000)

    handleSumoMessage({
      data: {
        type: 'sumo-state',
        state: {
          stats: {
            time: 10,
            kpis: {
              tnr: -1,
              tawt: 20,
              ewpc: 2.5
            }
          }
        }
      }
    })

    expect(simulationLogs.value).toHaveLength(1)
    expect(simulationLogs.value[0]).toMatchObject({
      action: 'kpi_update',
      detail: 'Bijgewerkt: TNR, TAWT, EWPC',
      kpis: {
        tnr: -1,
        tawt: 20,
        ewpc: 2.5,
        time: 10
      }
    })

    vi.advanceTimersByTime(1001)
    handleSumoMessage({
      data: {
        type: 'sumo-state',
        state: {
          stats: {
            time: 11,
            kpis: {
              tnr: -2,
              tawt: 20, // no change
              ewpc: 2.5 // no change
            }
          }
        }
      }
    })

    expect(simulationLogs.value).toHaveLength(2)
    expect(simulationLogs.value[1]).toMatchObject({
      action: 'kpi_update',
      detail: 'Bijgewerkt: TNR',
      kpis: {
        tnr: -2,
        time: 11
      }
    })
  })

  it('handleSumoMessage stores AI decisions by timestep', () => {
    handleSumoMessage({
      data: {
        type: 'sumo-state',
        state: {
          stats: {
            time: 20,
            aiDecisions: [
              {
                timestep: 20,
                time: 20,
                tls_id: 'junction-1',
                action: 3,
                previous_phase_index: 1,
                target_phase_index: 2,
                switched: true,
                queue_estimate: 8,
                waiting_time_estimate: 42
              }
            ]
          }
        }
      }
    })

    expect(aiDecisionHistory.value).toHaveLength(1)
    expect(aiDecisionHistory.value[0]).toMatchObject({
      timestep: 20,
      tlsId: 'junction-1',
      action: 3,
      switched: true
    })
  })

  it('handleStartSimulation covers timeout and resume branches (Lines 362, 384-386)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { })
    
    // Test resume branch
    isStarting.value = false
    hasUserStarted.value = true
    sumoState.value = { simulationStatus: 'paused' }
    const resumeSpy = vi.spyOn(sumoActions, 'resumeSimulation')
    handleStartSimulation()
    expect(resumeSpy).toHaveBeenCalled()
    
    // Test timeout branch
    isStarting.value = false // Reset
    hasUserStarted.value = false
    selectedScenario.value = 'test-scenario'
    sumoState.value = null
    
    handleStartSimulation() 
    expect(isStarting.value).toBe(true)
    
    vi.advanceTimersByTime(16000)
    expect(isStarting.value).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Simulation start timed out'))
    
    // Test missing scenario error state (Line 368)
    isStarting.value = false
    selectedScenario.value = ''
    handleStartSimulation()
    expect(showScenarioError.value).toBe(true)
  })
  it('changeUpdateInterval updates interval and sends POST request', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true })
    await sumoActions.changeUpdateInterval(5)
    expect(selectedUpdateInterval.value).toBe(5)
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/state'), expect.any(Object))
  })

  it('saveScenarioParameters saves preset', async () => {
    const mod = await import('../../composables/useSumoBridge.js')
    mod.selectedPresetId.value = 'preset-1'
    mod.currentPresets.value = [{ id: 'preset-1', update_interval: 1 }]
    global.fetch.mockResolvedValueOnce({ ok: true })
    const res = await sumoActions.saveScenarioParameters()
    expect(res).toBe(true)
    expect(mod.currentPresets.value[0].update_interval).toBe(selectedUpdateInterval.value)

    global.fetch.mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('Error') })
    const resFail = await sumoActions.saveScenarioParameters()
    expect(resFail).toBe(false)
  })

  it('createScenarioPreset creates a preset', async () => {
    selectedScenario.value = 'scenario-x'
    const mod = await import('../../composables/useSumoBridge.js')
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'new-p', name: 'New Preset' }) })
    const res = await sumoActions.createScenarioPreset('New Preset')
    expect(res).toBe(true)
    expect(mod.currentPresets.value.some(p => p.id === 'new-p')).toBe(true)

    global.fetch.mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('Error') })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const resFail = await sumoActions.createScenarioPreset('Fail Preset')
    expect(resFail).toBe(false)
    expect(alertSpy).toHaveBeenCalled()
  })

  it('deleteScenarioPreset deletes a preset', async () => {
    const mod = await import('../../composables/useSumoBridge.js')
    mod.currentPresets.value = [{ id: 'del-p' }]
    mod.selectedPresetId.value = 'del-p'
    global.fetch.mockResolvedValueOnce({ ok: true })
    const res = await sumoActions.deleteScenarioPreset('del-p')
    expect(res).toBe(true)
    expect(mod.currentPresets.value.length).toBe(0)
    expect(mod.selectedPresetId.value).toBe('')

    global.fetch.mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('Error') })
    const resFail = await sumoActions.deleteScenarioPreset('del-p')
    expect(resFail).toBe(false)
  })

  it('fetchPresets fetches presets', async () => {
    const mod = await import('../../composables/useSumoBridge.js')
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ id: 'fp-1' }]) })
    await sumoActions.fetchPresets('test-scen')
    expect(mod.currentPresets.value.length).toBe(1)
    
    await sumoActions.fetchPresets(null)
    expect(mod.currentPresets.value.length).toBe(0)
  })

  it('applyPreset applies preset', async () => {
    const mod = await import('../../composables/useSumoBridge.js')
    mod.currentPresets.value = [{ id: 'p-1', strategy: 'strat-1', update_interval: 10, sam_model: 'model-1' }]
    sumoActions.applyPreset('p-1')
    expect(mod.selectedPresetId.value).toBe('p-1')
    expect(selectedStrategy.value).toBe('strat-1')
    expect(selectedUpdateInterval.value).toBe(10)
    expect(selectedSamModel.value).toBe('model-1')
  })

  it('handleSumoMessage handles sumo-finished', async () => {
    isStarting.value = true
    hasUserStarted.value = true
    handleSumoMessage({ data: { type: 'sumo-finished' } })
    expect(hasUserStarted.value).toBe(false)
    expect(isStarting.value).toBe(false)
  })

  it('triggers selectedScenario watcher', async () => {
    const mod = await import('../../composables/useSumoBridge.js')
    hasUserStarted.value = false
    selectedScenario.value = 'new-scen'
    
    // Simulate resolving promises and timers
    for (let i = 0; i < 5; i++) {
      await Promise.resolve()
      vi.advanceTimersByTime(20)
    }
    
    expect(mod.selectedPresetId.value).toBe('')
  })
})
