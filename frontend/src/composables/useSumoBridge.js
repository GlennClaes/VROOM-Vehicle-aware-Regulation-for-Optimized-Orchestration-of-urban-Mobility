import { ref, shallowRef, computed, watch } from 'vue'
import { useNotifications } from '@/stores/NotificationStore'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import Chart from 'chart.js/auto'

// Use relative URL to leverage Vite proxy
const SUMO_API = `/map`
const MAIN_API = `/api`

const getAuthHeaders = () => {
  const sessionStr = localStorage.getItem('session')
  if (!sessionStr) return { 'Content-Type': 'application/json' }
  
  try {
    const session = JSON.parse(sessionStr)
    const token = session.access_token
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  } catch (e) {
    console.error('[FRONTEND] Failed to parse session for auth headers', e)
    return { 'Content-Type': 'application/json' }
  }
}

// Shared state between map and sidebar - shallowRef for performance!
export const sumoState = shallowRef(null)
export const mapFrameRef = ref(null)
export const isStarting = ref(false)
export const isReloading = ref(false)
export const hasUserStarted = ref(false)
export const isMapReady = ref(false)
export const showScenarioError = ref(false)

// Simulation log entries for the LogsViewer tab
export const simulationLogs = ref([])
const MAX_LOG_ENTRIES = 500
let _lastLoggedKpis = null

/**
 * Add a log entry to the simulation logs.
 * @param {'start'|'pause'|'resume'|'stop'|'kpi_update'|'scenario_changed'|'strategy_changed'|'speed_changed'|'interval_changed'} action - The action type
 * @param {Object} [extraData] - Optional extra data (kpis, etc.)
 */
export function addLog(action, extraData = {}) {
  const entry = {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    timestamp: new Date().toISOString(),
    scenario: selectedScenario.value || sumoState.value?.scenario || 'N/A',
    action,
    kpis: extraData.kpis || null,
    detail: extraData.detail || null,
    kpiKey: extraData.kpiKey || null,
    kpiLabel: extraData.kpiLabel || null,
    kpiAbbr: extraData.kpiAbbr || null
  }
  const updated = [...simulationLogs.value, entry]
  // Keep only the last MAX_LOG_ENTRIES entries (FIFO)
  simulationLogs.value = updated.length > MAX_LOG_ENTRIES
    ? updated.slice(updated.length - MAX_LOG_ENTRIES)
    : updated
}

export function clearLogs() {
  simulationLogs.value = []
  _lastLoggedKpis = null
  _lastKpiPushTime = 0
}

// Persistent selection state for the sidebar
export const selectedScenario = ref('')
export const availableScenarios = ref([])
export const selectedStrategy = ref('baseline')
export const selectedSamModel = ref('')
export const availableSamModels = ref([])
export const clickedPoint = ref(null)
export const selectedUpdateInterval = ref(1)
export const selectedPresetId = ref('')
export const currentPresets = ref([])

// Use shallowRef for the history to prevent Vue from deep-watching thousands of data points
// This is the #1 cause of tab-switching lag.
export const kpiHistory = shallowRef([])
let _lastKpiPushTime = 0
// throttle KPI history to max 1 push/sec

export const aiDecisionHistory = shallowRef([])
const MAX_AI_DECISIONS = 1000

export function bindMapFrame(el) {
  mapFrameRef.value = el
}

export const sumoActionNames = [
  'setSumo3D', 'startSimulation', 'pauseSimulation', 'resumeSimulation',
  'cancelSimulation', 'changeDelay', 'clickPoint',
  'followObjectPOV', 'unfollowObjectPOV', 'toggleRouteObjectHighlighted',
  'focusOnVehicleOfClass', 'focusOnTrafficLight', 'handleSearch',
  'deselectSearch', 'onClick', 'onUnfollow', 'onRemove', 'onUnhighlight',
  'forceResize', 'exportData', 'setMapVisible'
]

export const sumoActions = {}

/**
 * Show a notification when a simulation ends (manually or naturally)
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 */
function showSimulationEndNotification(title, message) {
  const { addNotification } = useNotifications()
  
  addNotification({
    type: 'success',
    title: title,
    message: message,
    duration: 10000,
    actions: [
      { 
        label: 'Bekijk KPI Dashboard', 
        class: 'btn-primary',
        onClick: () => {
          window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'KPI' }))
        }
      },
      { 
        label: 'Bekijk Logs', 
        class: 'btn-outline-secondary',
        onClick: () => {
          window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'logs' }))
        }
      },
      {
        label: 'Exporteer PDF',
        class: 'btn-outline-info',
        onClick: () => {
          if (sumoActions.exportData) {
            sumoActions.exportData('pdf')
          }
        }
      }
    ]
  })
}

// Default postMessage actions
for (const actionName of sumoActionNames) {
  sumoActions[actionName] = (...args) => {
    if (actionName === 'startSimulation') {
      isStarting.value = true
      hasUserStarted.value = true
      addLog('start')
    }
    if (actionName === 'pauseSimulation') {
      addLog('pause')
    }
    if (actionName === 'resumeSimulation') {
      addLog('resume')
    }
    if (actionName === 'changeDelay') {
      const delayMs = args[0]
      const speedLabel = delayMs < 60 ? 'Fast' : delayMs > 240 ? 'Slow' : '1x'
      addLog('speed_changed', { detail: speedLabel })
    }
    if (actionName === 'cancelSimulation') {
      const wasRunning = hasUserStarted.value;
      isStarting.value = false
      isReloading.value = false
      hasUserStarted.value = false
      clickedPoint.value = null
      addLog('stop')

      if (wasRunning) {
        showSimulationEndNotification('Simulatie Gestopt', 'De simulatie is handmatig gestopt door de gebruiker.')
      }
    }
    if (mapFrameRef.value && mapFrameRef.value.contentWindow) {
      mapFrameRef.value.contentWindow.postMessage({
        type: 'sumo-action',
        action: actionName,
        payload: args
      }, '*')
    } else {
      console.warn(`[FRONTEND] Action ${actionName} failed: mapFrameRef is null`)
    }
  }
}

// changeScenario: POST to the Python server to switch scenario, then reload iframe
sumoActions.changeScenario = async (scenarioKebabCase, status = 'off') => {
  isReloading.value = true
  try {
    console.log(`[FRONTEND] Switching scenario to: ${scenarioKebabCase} with status: ${status}`)
    await fetch(`${SUMO_API}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: scenarioKebabCase,
        strategy: selectedStrategy.value,
        sam_model: selectedSamModel.value,
        delay_length_ms: 16,
        simulation_status: status,
        update_interval: selectedUpdateInterval.value
      })
    })
  } catch (e) {
    console.error('[FRONTEND] Failed to switch scenario via /state', e)
  }
  sumoActions.hardReload()

  // After reload, the iframe will connect and we can trigger a preload
  setTimeout(() => {
    if (mapFrameRef.value && mapFrameRef.value.contentWindow && typeof mapFrameRef.value.contentWindow.postMessage === 'function') {
      mapFrameRef.value.contentWindow.postMessage({
        type: 'sumo-action',
        action: 'preload',
        payload: [scenarioKebabCase]
      }, '*')
    }
  }, 1000)
}

// changeStrategy: switch the active strategy, resetting the simulation if running
sumoActions.changeStrategy = async (newStrategy) => {
  const previousStrategy = selectedStrategy.value
  selectedStrategy.value = newStrategy
  console.log(`[FRONTEND] Strategy changed: ${previousStrategy} -> ${newStrategy}`)
  addLog('strategy_changed', { detail: `${previousStrategy} → ${newStrategy}` })

  if (hasUserStarted.value && sumoState.value && sumoState.value.simulationStatus !== 'off') {
    isStarting.value = false
    isReloading.value = false
    hasUserStarted.value = false
    clickedPoint.value = null

    try {
      await fetch(`${SUMO_API}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: sumoState.value.scenario || selectedScenario.value,
          strategy: newStrategy,
          sam_model: selectedSamModel.value,
          delay_length_ms: sumoState.value.delayMs || 30,
          simulation_status: 'off',
          update_interval: selectedUpdateInterval.value
        })
      })
    } catch (e) {
      console.error('[FRONTEND] Failed to update strategy via /state', e)
    }

    if (mapFrameRef.value && mapFrameRef.value.contentWindow) {
      mapFrameRef.value.contentWindow.postMessage({
        type: 'sumo-action',
        action: 'cancelSimulation',
        payload: []
      }, '*')
    }
  } else {
    try {
      await fetch(`${SUMO_API}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: selectedScenario.value,
          strategy: newStrategy,
          sam_model: selectedSamModel.value,
          delay_length_ms: 16,
          simulation_status: 'off',
          update_interval: selectedUpdateInterval.value
        })
      })
    } catch (e) {
      console.error('[FRONTEND] Failed to persist strategy via /state', e)
    }
  }
}

// hardReload: force refresh the iframe
sumoActions.hardReload = () => {
  if (mapFrameRef.value) {
    mapFrameRef.value.src = mapFrameRef.value.src
  }
}

const hostname = window.location.hostname || 'localhost'

/**
 * AI Model Management (From File 1)
 */
sumoActions.fetchModels = async () => {
  try {
    const resp = await fetch(`/api/rl/models`)
    if (resp.ok) {
      const models = await resp.json()
      availableSamModels.value = models
      if (!selectedSamModel.value && models.length > 0) {
        selectedSamModel.value = models[0].name
      }
    }
  } catch (e) {
    console.error('[FRONTEND] Failed to fetch models', e)
  }
}

sumoActions.changeSamModel = async (modelName) => {
  selectedSamModel.value = modelName
  console.log(`[FRONTEND] SAM Model changed to: ${modelName}`)

  if (!hasUserStarted.value) {
    try {
      await fetch(`${SUMO_API}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: selectedScenario.value,
          strategy: selectedStrategy.value,
          sam_model: modelName,
          delay_length_ms: 30,
          simulation_status: 'off'
        })
      })
    } catch (e) {
      console.error('[FRONTEND] Failed to persist sam_model via /state', e)
    }
  } else {
    // Reset simulation if model changes while running
    sumoActions.changeStrategy(selectedStrategy.value)
  }
}

/**
 * Full KPI definitions — single source of truth for exports.
 * Matches the kpiList in KPIContainer.vue.
 */
export const EXPORT_KPI_DEFS = [
  { key: 'tnr',                label: 'Total Negative Reward',  abbr: 'TNR',  unit: '',    decimals: 2, description: 'Cumulatieve negatieve beloning' },
  { key: 'tawt',               label: 'Accum. Wait Time',       abbr: 'TAWT', unit: 's',   decimals: 0, description: 'Totale wachttijd alle voertuigen' },
  { key: 'ewpc',               label: 'Avg Wait per Car',       abbr: 'EWPC', unit: 's',   decimals: 1, description: 'Gemiddelde wachttijd per voertuig' },
  { key: 'aql',                label: 'Avg Queue Length',        abbr: 'AQL',  unit: 'veh', decimals: 2, description: 'Gem. wachtrijlengte per rijstrook' },
  { key: 'avg_speed',          label: 'Gemiddelde Snelheid',     abbr: 'AvgV', unit: 'm/s', decimals: 1, description: 'Gem. snelheid alle voertuigen' },
  { key: 'avg_waiting_time',   label: 'Gem. Wachttijd',         abbr: 'AWT',  unit: 's',   decimals: 1, description: 'Huidige gem. wachttijd' },
  { key: 'vehicle_count',      label: 'Aantal Voertuigen',      abbr: 'Count',unit: 'veh', decimals: 0, description: 'Actieve voertuigen in simulatie' },
  { key: 'throughput',         label: 'Doorvoer',                abbr: 'TP',   unit: 'veh', decimals: 0, description: 'Voertuigen die simulatie verlieten' },
  { key: 'intersection_delay', label: 'Kruispuntvertraging',     abbr: 'DLY',  unit: 's',   decimals: 1, description: 'Tijdverlies bij verkeerslichten' },
  { key: 'pressure',           label: 'Druk',                    abbr: 'PRS',  unit: '',    decimals: 0, description: 'In vs. Uit balans bij kruispunten' },
  { key: 'ttt',                label: 'Totale Reistijd',         abbr: 'TTT',  unit: 's',   decimals: 0, description: 'Som van alle reistijden' },
  { key: 'nql',                label: 'Genorm. Wachtrij',        abbr: 'NQL',  unit: '',    decimals: 4, description: 'Genormaliseerde wachtrijlengte' },
  { key: 'fairness',           label: 'Eerlijkheidsindex',       abbr: 'JFI',  unit: '',    decimals: 3, description: "Jain's Fairness Index (0-1)" },
  { key: 'tp_delay_ratio',     label: 'TP/Delay Ratio',          abbr: 'RAT',  unit: '',    decimals: 4, description: 'Doorvoer vs. Vertraging ratio' },
]

function logKpiChanges(kpis, time) {
  const changedDefs = EXPORT_KPI_DEFS.filter(def => {
    const nextValue = kpis[def.key]
    if (nextValue === undefined) return false
    return !_lastLoggedKpis || _lastLoggedKpis[def.key] !== nextValue
  })

  if (changedDefs.length > 0) {
    const changedKpis = {}
    changedDefs.forEach(def => {
      changedKpis[def.key] = kpis[def.key]
    })

    addLog('kpi_update', {
      detail: `Bijgewerkt: ${changedDefs.map(d => d.abbr).join(', ')}`,
      kpis: {
        ...changedKpis,
        time
      }
    })
  }

  _lastLoggedKpis = { ...kpis }
}

/** Format a single KPI value according to its definition */
function _fmtKpi(val, def) {
  const v = val ?? 0
  return def.decimals === 0 ? String(Math.round(v)) : Number(v).toFixed(def.decimals)
}

/**
 * Export KPI history as CSV or PDF
 */
sumoActions.exportData = async (format) => {
  if (kpiHistory.value.length === 0) {
    alert('Geen data om te exporteren. Start de simulatie eerst.')
    return
  }

  const scenario = selectedScenario.value || 'simulation'
  const filename = `traffic_kpis_${scenario}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}`

  try {
    if (format === 'csv') {
      // Build CSV header: Time + all 14 KPI columns with units
      const headers = ['Time (s)', ...EXPORT_KPI_DEFS.map(d => d.unit ? `${d.abbr} (${d.unit})` : d.abbr)]

      const rows = kpiHistory.value.map(k => [
        k.time,
        ...EXPORT_KPI_DEFS.map(d => _fmtKpi(k[d.key], d))
      ])

      const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${filename}.csv`
      link.click()
    } else if (format === 'pdf') {
      const doc = new jsPDF()
      const scenario = selectedScenario.value || 'Standaard'
      const strategy = selectedStrategy.value || 'N/A'
      const latest = kpiHistory.value[kpiHistory.value.length - 1]

      // --- Helper: Footer ---
      const addFooter = (doc, pageNum) => {
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text(`PXL Pedals - Verkeersprestaties Rapport | Pagina ${pageNum}`, 105, 285, { align: 'center' })
      }

      // --- Page 1: Management Summary ---
      // Background accent
      doc.setFillColor(245, 247, 250)
      doc.rect(0, 0, 210, 50, 'F')
      
      doc.setFontSize(22)
      doc.setTextColor(44, 62, 80)
      doc.text('Verkeersprestaties Analyse Rapport', 14, 25)
      
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(`Gegenereerd op: ${new Date().toLocaleString()} | Project: PXL Pedals`, 14, 35)

      // Summary Box
      doc.setDrawColor(200)
      doc.setFillColor(255)
      doc.roundedRect(14, 55, 182, 40, 3, 3, 'FD')
      
      doc.setFontSize(12)
      doc.setTextColor(44, 62, 80)
      doc.setFont(undefined, 'bold')
      doc.text('Samenvatting van de Simulatie', 20, 65)
      
      doc.setFontSize(10)
      doc.setFont(undefined, 'normal')
      doc.text(`• Scenario: ${scenario}`, 20, 75)
      doc.text(`• Toegepaste Strategie: ${strategy.toUpperCase()}`, 20, 82)
      doc.text(`• Totale Doorvoer: ${latest.throughput} voertuigen`, 100, 75)
      doc.text(`• Gemiddelde Wachttijd: ${latest.avg_waiting_time.toFixed(1)} s`, 100, 82)
      doc.text(`• Eerlijkheidsindex (JFI): ${latest.fairness.toFixed(3)}`, 20, 89)

      // Detailed KPI Categorization Table
      const kpiCategories = [
        { name: 'Efficiëntie & Doorstroming', keys: ['avg_speed', 'throughput', 'tp_delay_ratio', 'pressure'] },
        { name: 'Wachttijden & Vertraging', keys: ['avg_waiting_time', 'tawt', 'ewpc', 'intersection_delay'] },
        { name: 'Wachtrijbeheer', keys: ['aql', 'nql'] },
        { name: 'Systeem & AI Performance', keys: ['vehicle_count', 'ttt', 'fairness', 'tnr'] }
      ]

      let currentY = 105
      kpiCategories.forEach((cat, idx) => {
        doc.setFontSize(11)
        doc.setFont(undefined, 'bold')
        doc.setTextColor(52, 152, 219)
        doc.text(cat.name, 14, currentY)
        
        autoTable(doc, {
          startY: currentY + 2,
          head: [['Indicator', 'Waarde', 'Beschrijving']],
          body: EXPORT_KPI_DEFS.filter(d => cat.keys.includes(d.key)).map(d => {
            const formatted = _fmtKpi(latest[d.key], d)
            const valueStr = d.unit ? `${formatted} ${d.unit}` : formatted
            return [d.label, valueStr, d.description]
          }),
          theme: 'striped',
          headStyles: { fillColor: [52, 152, 219], fontSize: 9 },
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 }, 2: { cellWidth: 90 } },
          margin: { left: 14, right: 14 }
        })
        currentY = doc.lastAutoTable.finalY + 10
      })

      addFooter(doc, 1)

      // --- Page 2: Visual Analysis ---
      doc.addPage()
      doc.setFontSize(16)
      doc.setTextColor(44, 62, 80)
      doc.text('Visuele Trend Analyse', 14, 22)
      doc.setDrawColor(52, 152, 219)
      doc.line(14, 25, 60, 25)

      // Create Chart Canvas
      const chartCanvas = document.createElement('canvas')
      chartCanvas.width = 800
      chartCanvas.height = 450
      chartCanvas.style.visibility = 'hidden'
      document.body.appendChild(chartCanvas)

      const chartInstance = new Chart(chartCanvas, {
        type: 'line',
        data: {
          labels: kpiHistory.value.map(k => Math.round(k.time)),
          datasets: [
            {
              label: 'Gem. Wachttijd (s)',
              data: kpiHistory.value.map(k => k.avg_waiting_time),
              borderColor: '#e74c3c',
              backgroundColor: 'rgba(231, 76, 60, 0.1)',
              yAxisID: 'y',
              fill: true,
              tension: 0.4,
              borderWidth: 2,
              pointRadius: 0
            },
            {
              label: 'Voertuig Druk',
              data: kpiHistory.value.map(k => k.vehicle_count),
              borderColor: '#3498db',
              backgroundColor: 'rgba(52, 152, 219, 0.1)',
              yAxisID: 'y1',
              fill: true,
              tension: 0.4,
              borderWidth: 2,
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: false,
          animation: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 20, font: { size: 10 } } }
          },
          scales: {
            x: { title: { display: true, text: 'Simulatietijd (s)', font: { size: 10 } } },
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Wachttijd (s)', font: { size: 10 } } },
            y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Voertuigen', font: { size: 10 } } }
          }
        }
      })

      const chartImg = chartCanvas.toDataURL('image/png')
      doc.addImage(chartImg, 'PNG', 14, 35, 182, 100)
      
      // Cleanup chart
      chartInstance.destroy()
      document.body.removeChild(chartCanvas)

      addFooter(doc, 2)

      // --- Page 3: Full Historical Log ---
      doc.addPage()
      doc.setFontSize(14)
      doc.text('Historisch Datapunt Log', 14, 22)
      
      const samplingRate = Math.max(1, Math.floor(kpiHistory.value.length / 25))
      const sampledData = kpiHistory.value.filter((_, i) => i % samplingRate === 0)

      autoTable(doc, {
        startY: 30,
        head: [['Tijd (s)', ...EXPORT_KPI_DEFS.map(d => d.abbr)]],
        body: sampledData.map(k => [
          Math.floor(k.time),
          ...EXPORT_KPI_DEFS.map(d => _fmtKpi(k[d.key], d))
        ]),
        headStyles: { fillColor: [44, 62, 80], fontSize: 7 },
        styles: { fontSize: 6, cellPadding: 1.5 },
        margin: { left: 10, right: 10 }
      })

      addFooter(doc, 3)
      doc.save(`${filename}.pdf`)
    }
  } catch (err) {
    console.error("Export failed:", err)
    alert("Export mislukt: " + err.message)
  }
}

sumoActions.changeUpdateInterval = async (newInterval) => {
  selectedUpdateInterval.value = newInterval
  addLog('interval_changed', { detail: `${newInterval}s` })
  try {
    await fetch(`${SUMO_API}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: selectedScenario.value || sumoState.value?.scenario,
        strategy: selectedStrategy.value,
        delay_length_ms: sumoState.value?.delayMs || 30,
        simulation_status: sumoState.value?.simulationStatus || 'off',
        update_interval: newInterval,
        sam_model: selectedSamModel.value
      })
    })
  } catch (e) {
    console.error('[FRONTEND] Failed to persist update interval via /state', e)
  }
}

sumoActions.saveScenarioParameters = async () => {
  if (!selectedPresetId.value) return false
  
  try {
    const resp = await fetch(`${MAIN_API}/presets/${selectedPresetId.value}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        update_interval: selectedUpdateInterval.value,
        strategy: selectedStrategy.value,
        sam_model: selectedSamModel.value
      })
    })
    
    if (resp.ok) {
      console.log(`[FRONTEND] Successfully saved preset ${selectedPresetId.value}`)
      // Update in-memory state
      const pIndex = currentPresets.value.findIndex(p => p.id === selectedPresetId.value)
      if (pIndex !== -1) {
        currentPresets.value[pIndex] = {
          ...currentPresets.value[pIndex],
          update_interval: selectedUpdateInterval.value,
          strategy: selectedStrategy.value,
          sam_model: selectedSamModel.value
        }
      }
      return true
    } else {
      const errorText = await resp.text()
      throw new Error(errorText)
    }
  } catch (e) {
    console.error('[FRONTEND] Failed to save preset', e)
    return false
  }
}

sumoActions.createScenarioPreset = async (name) => {
  const scenario = selectedScenario.value
  if (!scenario) return

  try {
    const resp = await fetch(`${MAIN_API}/presets`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        name,
        scenario,
        update_interval: selectedUpdateInterval.value,
        strategy: selectedStrategy.value,
        sam_model: selectedSamModel.value
      })
    })
    
    if (resp.ok) {
      const newPreset = await resp.json()
      console.log(`[FRONTEND] Successfully created preset: ${newPreset.name}`)
      currentPresets.value.push(newPreset)
      selectedPresetId.value = newPreset.id
      return true
    } else {
      const errorText = await resp.text()
      throw new Error(errorText)
    }
  } catch (e) {
    console.error('[FRONTEND] Failed to create preset', e)
    alert('Fout bij aanmaken preset: ' + e.message)
    return false
  }
}

sumoActions.deleteScenarioPreset = async (presetId) => {
  try {
    const resp = await fetch(`${MAIN_API}/presets/${presetId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })
    
    if (resp.ok) {
      console.log(`[FRONTEND] Successfully deleted preset ${presetId}`)
      currentPresets.value = currentPresets.value.filter(p => p.id !== presetId)
      if (selectedPresetId.value === presetId) {
        selectedPresetId.value = ''
      }
      return true
    } else {
      const errorText = await resp.text()
      throw new Error(errorText)
    }
  } catch (e) {
    console.error('[FRONTEND] Failed to delete preset', e)
    return false
  }
}

sumoActions.fetchPresets = async (scenario) => {
  if (!scenario) {
    currentPresets.value = []
    return
  }
  
  try {
    const resp = await fetch(`${MAIN_API}/presets?scenario=${scenario}`, {
      headers: getAuthHeaders()
    })
    if (resp.ok) {
      currentPresets.value = await resp.json()
      console.log(`[FRONTEND] Loaded ${currentPresets.value.length} presets for ${scenario}`)
    }
  } catch (e) {
    console.error('[FRONTEND] Failed to fetch presets', e)
  }
}

sumoActions.applyPreset = (presetId) => {
  const preset = currentPresets.value.find(p => p.id === presetId)
  if (!preset) return
  
  console.log(`[useSumoBridge] Applying preset: ${preset.name}`, preset)
  selectedPresetId.value = presetId
  
  if (preset.strategy) {
    selectedStrategy.value = preset.strategy
  }
  if (preset.update_interval !== undefined) {
    selectedUpdateInterval.value = preset.update_interval
  }
  if (preset.sam_model) {
    selectedSamModel.value = preset.sam_model
  }
}


let _bridgeInitialized = false
export function handleSumoMessage(event) {
  if (event.data?.type === 'sumo-state') {
    sumoState.value = event.data.state

    // AUTO-SYNC visibility on first connection
    if (!_bridgeInitialized && sumoActions.setMapVisible) {
      _bridgeInitialized = true
      // We don't have direct access to activeTab here, but we can broadcast a global event or check window state
      // A better way is to trigger a re-sync from DashboardView, but for now we'll force 'true'
      // to ensure it loads, and let the DashboardView watcher handle subsequent changes.
      sumoActions.setMapVisible(true)
    }
    if (['running', 'paused'].includes(sumoState.value?.simulationStatus)) {
      isStarting.value = false
    }

    // AUTO-STOP detection: if the backend says 'off' but we thought we were running, sync it.
    if (sumoState.value?.simulationStatus === 'off' && hasUserStarted.value && !isStarting.value && !isReloading.value) {
      console.log("[useSumoBridge] Backend simulation ended automatically. Syncing state.")
      hasUserStarted.value = false
    }

    clickedPoint.value = event.data.state.clickedPoint || null

    // Capture model from state (From File 1 logic)
    if (event.data.state.samModel !== undefined) {
      selectedSamModel.value = event.data.state.samModel || ''
    }

    // Accumulate KPI history — throttled to 1s to prevent UI lag
    if (event.data.state.stats?.kpis && event.data.state.stats.time > 0) {
      const now = Date.now()
      if (now - _lastKpiPushTime >= 1000) {
        _lastKpiPushTime = now

        // Ensure kpiHistory is initialized
        if (!Array.isArray(kpiHistory.value)) kpiHistory.value = [];

        // If this is a very early point (time < 2), it might be a restart, so clear history
        if (event.data.state.stats.time < 2 && kpiHistory.value.length > 5) {
          kpiHistory.value = [];
        }

        const newHistory = [
          ...kpiHistory.value,
          {
            time: event.data.state.stats.time,
            ...event.data.state.stats.kpis
          }
        ].slice(-300)

        kpiHistory.value = newHistory

        logKpiChanges(event.data.state.stats.kpis, event.data.state.stats.time)
      }
    }

    const decisions = event.data.state.stats?.aiDecisions || event.data.state.stats?.ai_decisions || []
    if (Array.isArray(decisions) && decisions.length > 0) {
      const existingIds = new Set(aiDecisionHistory.value.map(decision => decision.id))
      const normalized = decisions.map((decision, index) => {
        const timestep = Number(decision.timestep ?? event.data.state.stats?.time ?? 0)
        const tlsId = decision.tls_id || decision.tlsId || `tls-${index}`
        return {
          id: `${timestep}-${tlsId}-${decision.action ?? 'x'}`,
          timestep,
          time: Number(decision.time ?? event.data.state.stats?.time ?? timestep),
          tlsId,
          action: decision.action,
          aiPhaseIndex: decision.ai_phase_index ?? decision.aiPhaseIndex ?? null,
          previousPhaseIndex: decision.previous_phase_index ?? decision.previousPhaseIndex ?? null,
          targetPhaseIndex: decision.target_phase_index ?? decision.targetPhaseIndex ?? null,
          currentSumoPhase: decision.current_sumo_phase ?? decision.currentSumoPhase ?? null,
          targetSumoPhase: decision.target_sumo_phase ?? decision.targetSumoPhase ?? null,
          switched: Boolean(decision.switched),
          yellowTransition: Boolean(decision.yellow_transition ?? decision.yellowTransition),
          status: decision.status || 'beslist',
          queueEstimate: Number(decision.queue_estimate ?? decision.queueEstimate ?? 0),
          vehicleEstimate: Number(decision.vehicle_estimate ?? decision.vehicleEstimate ?? 0),
          waitingTimeEstimate: Number(decision.waiting_time_estimate ?? decision.waitingTimeEstimate ?? 0),
          model: decision.model || '',
          strategy: decision.strategy || selectedStrategy.value,
          fallback: Boolean(decision.fallback),
          error: decision.error || null
        }
      }).filter(decision => !existingIds.has(decision.id))

      if (normalized.length > 0) {
        aiDecisionHistory.value = [
          ...aiDecisionHistory.value,
          ...normalized
        ].slice(-MAX_AI_DECISIONS)
      }
    }
  } else if (event.data?.type === 'sumo-finished') {
    showSimulationEndNotification(
      'Simulatie Voltooid', 
      `De simulatie van het scenario "${selectedScenario.value}" is succesvol afgerond.`
    )

    // Reset simulation state
    hasUserStarted.value = false
    isStarting.value = false
    addLog('stop', { detail: 'Simulatie voltooid' })
  }
}

export function handleStartSimulation() {
  if (isStarting.value) return

  if (hasUserStarted.value && sumoState.value?.simulationStatus === 'paused') {
    sumoActions.resumeSimulation()
    return
  }

  if (!selectedScenario.value) {
    showScenarioError.value = true
    // Reset after 2 seconds to allow the animation to be triggered again
    setTimeout(() => {
      showScenarioError.value = false
    }, 2000)
    return
  }

  // Clear stale state to keep loading overlay up until new run data arrives
  _lastLoggedKpis = null
  _lastKpiPushTime = 0
  kpiHistory.value = []
  sumoState.value = null
  aiDecisionHistory.value = []
  kpiHistory.value = [] // RESET KPI history only on NEW start
  hasUserStarted.value = true
  isStarting.value = true

  addLog('start')

  // START EARLY: Tell the backend to spawn the worker IMMEDIATELY while iframe loads.
  // The simulator's auto-start logic will take it from here.
  sumoActions.changeScenario(selectedScenario.value, 'running')

  // SAFETY TIMEOUT: If nothing happens after 15 seconds, reset the loading state
  // to prevent getting 'stuck' forever.
  setTimeout(() => {
    if (isStarting.value && (!sumoState.value || !sumoState.value.stats)) {
      console.warn('[FRONTEND] Simulation start timed out after 15s. Resetting state.')
      isStarting.value = false
    }
  }, 15000)
}

export function initSumoBridge() {
  window.addEventListener('message', handleSumoMessage)
  // Fetch models immediately so they are ready in the dropdown
  sumoActions.fetchModels()
}

export function destroySumoBridge() {
  window.removeEventListener('message', handleSumoMessage)
}

watch(selectedScenario, (newScenario, oldScenario) => {
  if (newScenario && newScenario !== oldScenario) {
    // Reset preset when scenario changes
    selectedPresetId.value = ''
    
    // Only log if it's an actual user selection before starting. 
    if (!hasUserStarted.value) {
      addLog('scenario_changed', { detail: newScenario })
      
      // Fetch user-specific presets for this scenario
      sumoActions.fetchPresets(newScenario).then(() => {
        if (currentPresets.value.length > 0) {
          sumoActions.applyPreset(currentPresets.value[0].id)
        }
      })
    }
  }
})

watch(availableScenarios, (newList) => {
  if (newList.length > 0 && selectedScenario.value && !hasUserStarted.value && !selectedPresetId.value) {
    const scenario = newList.find(s => s.kebabCase === selectedScenario.value)
    if (scenario && scenario.presets && scenario.presets.length > 0) {
      console.log(`[useSumoBridge] availableScenarios loaded. Applying default preset for ${selectedScenario.value}`)
      sumoActions.applyPreset(scenario.presets[0].id)
    }
  }
}, { immediate: true })



