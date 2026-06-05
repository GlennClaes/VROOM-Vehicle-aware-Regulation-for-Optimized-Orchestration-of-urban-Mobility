import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, shallowRef } from 'vue'

// vi.mock factory is hoisted — must not reference outer const/let variables.
// Instead, we declare refs inline and re-export them.
vi.mock('@/composables/useSumoBridge', () => {
  const { ref, shallowRef } = require('vue')
  return {
    simulationLogs: ref([]),
    clearLogs: vi.fn(),
    sumoState: shallowRef(null),
    hasUserStarted: ref(false),
    selectedScenario: ref(''),
    EXPORT_KPI_DEFS: [
      { key: 'tnr', label: 'Total Negative Reward', abbr: 'TNR', unit: '', decimals: 2 },
      { key: 'tawt', label: 'Accum. Wait Time', abbr: 'TAWT', unit: 's', decimals: 0 },
      { key: 'ewpc', label: 'Avg Wait per Car', abbr: 'EWPC', unit: 's', decimals: 1 },
      { key: 'aql', label: 'Avg Queue Length', abbr: 'AQL', unit: 'veh', decimals: 2 },
      { key: 'throughput', label: 'Doorvoer', abbr: 'TP', unit: 'veh', decimals: 0 }
    ]
  }
})

import LogsViewer from '@/components/tabs/LogsViewer.vue'
import { simulationLogs, clearLogs, sumoState, hasUserStarted, selectedScenario } from '@/composables/useSumoBridge'

const stubs = {
  FileText: true,
  Trash2: true,
  Search: true,
  Clock: true,
  Play: true,
  Pause: true,
  Square: true,
  BarChart3: true,
  MapPin: true,
  GitBranch: true,
  Gauge: true,
  Timer: true
}

function createLog(action, scenario = 'test-scenario', kpis = null, timestamp = new Date().toISOString()) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp,
    scenario,
    action,
    kpis
  }
}

describe('LogsViewer.vue', () => {
  beforeEach(() => {
    simulationLogs.value = []
    sumoState.value = null
    hasUserStarted.value = false
    clearLogs.mockClear()
  })

  it('shows empty state when there are no logs', () => {
    const wrapper = mount(LogsViewer, { global: { stubs } })
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.find('.logs-table').exists()).toBe(false)
    expect(wrapper.text()).toContain('Geen logs beschikbaar')
  })

  it('renders log rows when logs are available', () => {
    simulationLogs.value = [
      createLog('start', 'hasselt-centrum'),
      createLog('kpi_update', 'hasselt-centrum', { tnr: -1.5, tawt: 120, ewpc: 3.2, aql: 1.5 })
    ]
    const wrapper = mount(LogsViewer, { global: { stubs } })
    expect(wrapper.find('.empty-state').exists()).toBe(false)
    expect(wrapper.find('.logs-table').exists()).toBe(true)
    const rows = wrapper.findAll('.log-row')
    expect(rows.length).toBe(2)
  })

  it('displays timestamp, scenario and KPI for each log entry', () => {
    simulationLogs.value = [
      createLog('kpi_update', 'ring-oost', { tnr: -2.34, tawt: 450, ewpc: 5.1, aql: 2.75 })
    ]
    const wrapper = mount(LogsViewer, { global: { stubs } })
    const row = wrapper.find('.log-row')
    expect(row.exists()).toBe(true)
    // Timestamp column
    expect(row.find('.timestamp-code').exists()).toBe(true)
    // Scenario column
    expect(row.find('.scenario-tag').text()).toBe('ring-oost')
    // KPI column
    const kpiText = row.find('.kpi-summary-container').text()
    expect(kpiText).toContain('TNR')
    expect(kpiText).toContain('TAWT')
    expect(kpiText).toContain('EWPC')
    expect(kpiText).toContain('AQL')
  })

  it('filters logs by action type', async () => {
    simulationLogs.value = [
      createLog('start', 'centrum'),
      createLog('kpi_update', 'centrum', { tnr: -1 }),
      createLog('kpi_update', 'centrum', { tnr: -2 }),
      createLog('stop', 'centrum')
    ]
    const wrapper = mount(LogsViewer, { global: { stubs } })
    // Initially shows all 4
    expect(wrapper.findAll('.log-row').length).toBe(4)

    // Click on "Start" filter pill
    const pills = wrapper.findAll('.filter-pill')
    const startPill = pills.find(p => p.text() === 'Start')
    await startPill.trigger('click')

    expect(wrapper.findAll('.log-row').length).toBe(1)
    expect(wrapper.find('.action-badge').text()).toContain('gestart')
  })

  it('filters logs by scenario', async () => {
    simulationLogs.value = [
      createLog('start', 'centrum'),
      createLog('start', 'ring-oost'),
      createLog('kpi_update', 'centrum', { tnr: -1 })
    ]
    const wrapper = mount(LogsViewer, { global: { stubs } })

    const scenarioSelect = wrapper.find('select[aria-label="Filter op scenario"]')
    await scenarioSelect.setValue('ring-oost')

    const rows = wrapper.findAll('.log-row')
    expect(rows.length).toBe(1)
    expect(rows[0].find('.scenario-tag').text()).toBe('ring-oost')
  })

  it('filters logs by recent time window', async () => {
    simulationLogs.value = [
      createLog('start', 'centrum', null, new Date(Date.now() - 10 * 60 * 1000).toISOString()),
      createLog('stop', 'centrum', null, new Date().toISOString())
    ]
    const wrapper = mount(LogsViewer, { global: { stubs } })

    const timeSelect = wrapper.find('select[aria-label="Filter op tijd"]')
    await timeSelect.setValue('5m')

    const rows = wrapper.findAll('.log-row')
    expect(rows.length).toBe(1)
    expect(rows[0].find('.action-badge').text()).toContain('gestopt')
  })

  it('filters logs by any available KPI', async () => {
    simulationLogs.value = [
      createLog('kpi_update', 'centrum', { tnr: -1, tawt: 30 }),
      createLog('kpi_update', 'centrum', { throughput: 12 }),
      createLog('start', 'centrum')
    ]
    const wrapper = mount(LogsViewer, { global: { stubs } })

    const kpiSelect = wrapper.find('select[aria-label="Filter op KPI"]')
    await kpiSelect.setValue('throughput')

    const rows = wrapper.findAll('.log-row')
    expect(rows.length).toBe(1)
    expect(rows[0].find('.kpi-summary-container').text()).toContain('TP')
    expect(rows[0].find('.kpi-summary-container').text()).toContain('12veh')
  })

  it('clears logs when "Wis Logs" button is clicked', async () => {
    simulationLogs.value = [createLog('start', 'test')]
    const wrapper = mount(LogsViewer, { global: { stubs } })
    expect(wrapper.find('.logs-table').exists()).toBe(true)

    const clearBtn = wrapper.find('.btn-clear-logs')
    await clearBtn.trigger('click')

    expect(clearLogs).toHaveBeenCalledOnce()
  })

  it('disables "Wis Logs" button when no logs exist', () => {
    simulationLogs.value = []
    const wrapper = mount(LogsViewer, { global: { stubs } })
    const clearBtn = wrapper.find('.btn-clear-logs')
    expect(clearBtn.attributes('disabled')).toBeDefined()
  })

  it('shows LIVE badge when simulation is running', () => {
    sumoState.value = { simulationStatus: 'running' }
    hasUserStarted.value = true
    const wrapper = mount(LogsViewer, { global: { stubs } })
    expect(wrapper.find('.bg-success-soft').exists()).toBe(true)
    expect(wrapper.text()).toContain('LIVE')
  })

  it('does not show LIVE badge when simulation is not running', () => {
    sumoState.value = null
    hasUserStarted.value = false
    const wrapper = mount(LogsViewer, { global: { stubs } })
    expect(wrapper.find('.bg-success-soft').exists()).toBe(false)
  })

  it('adds selectedScenario to scenarioOptions', () => {
    selectedScenario.value = 'extra-scenario'
    const wrapper = mount(LogsViewer, { global: { stubs } })
    const options = wrapper.findAll('option')
    expect(options.some(opt => opt.text().includes('extra-scenario'))).toBe(true)
  })

  it('filters logs by any_kpi', async () => {
    simulationLogs.value = [
      createLog('kpi_update', 'centrum', { tnr: -1 }),
      createLog('other_action', 'centrum', { some_kpi: 1 }),
      createLog('start', 'centrum', null)
    ]
    const wrapper = mount(LogsViewer, { global: { stubs } })
    const kpiSelect = wrapper.find('select[aria-label="Filter op KPI"]')
    await kpiSelect.setValue('any_kpi')

    const rows = wrapper.findAll('.log-row')
    expect(rows.length).toBe(2)
  })

  it('filters logs by search query', async () => {
    const customLog = createLog('custom_action', 'test', null)
    customLog.detail = 'FindThisDetail'

    simulationLogs.value = [
      createLog('start', 'centrum', null), // label: "Simulatie gestart"
      createLog('pause', 'ring', null),
      customLog,
      createLog('stop', 'other', { tnr: 10 }) // formatKpiSummary will have "TNR"
    ]

    const wrapper = mount(LogsViewer, { global: { stubs } })
    
    // search by action label
    await wrapper.find('input.search-input').setValue('gestart')
    expect(wrapper.findAll('.log-row').length).toBe(1)

    // search by log.action fallback
    await wrapper.find('input.search-input').setValue('custom_action')
    expect(wrapper.findAll('.log-row').length).toBe(1)

    // search by detail
    await wrapper.find('input.search-input').setValue('findthisdetail')
    expect(wrapper.findAll('.log-row').length).toBe(1)
    
    // search by formatted KPI (e.g. TNR)
    await wrapper.find('input.search-input').setValue('tnr')
    expect(wrapper.findAll('.log-row').length).toBe(1)
  })
})
