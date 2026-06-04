<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { FileText, Trash2, Search, Clock, Play, Pause, Square, BarChart3, MapPin, GitBranch, Gauge, Timer, Download } from 'lucide-vue-next'
import { simulationLogs, clearLogs, sumoState, hasUserStarted, selectedScenario, EXPORT_KPI_DEFS } from '@/composables/useSumoBridge'

defineProps({
  runId: {
    type: String,
    default: null
  }
})

const searchQuery = ref('')
const activeFilter = ref('all')
const selectedTimeRange = ref('all')
const selectedScenarioFilter = ref('all')
const selectedKpiFilter = ref('all')
const showExportMenu = ref(false)
const exportDropdownRef = ref(null)

function toggleExportMenu() {
  showExportMenu.value = !showExportMenu.value
}

function closeExportMenu(e) {
  if (exportDropdownRef.value && !exportDropdownRef.value.contains(e.target)) {
    showExportMenu.value = false
  }
}

onMounted(() => document.addEventListener('click', closeExportMenu))
onUnmounted(() => document.removeEventListener('click', closeExportMenu))

const filterOptions = [
  { id: 'all',              label: 'Alles' },
  { id: 'start',            label: 'Start' },
  { id: 'pause',            label: 'Pauze' },
  { id: 'resume',           label: 'Hervat' },
  { id: 'stop',             label: 'Stop' },
  { id: 'scenario_changed', label: 'Scenario' },
  { id: 'strategy_changed', label: 'Strategie' },
  { id: 'speed_changed',    label: 'Snelheid' },
  { id: 'interval_changed', label: 'Interval' },
  { id: 'kpi_update',       label: 'KPI Update' }
]

const timeRangeOptions = [
  { id: 'all', label: 'Alle tijden', milliseconds: null },
  { id: '5m',  label: 'Laatste 5 min', milliseconds: 5 * 60 * 1000 },
  { id: '15m', label: 'Laatste 15 min', milliseconds: 15 * 60 * 1000 },
  { id: '1h',  label: 'Laatste uur', milliseconds: 60 * 60 * 1000 }
]

const kpiFilterOptions = computed(() => [
  { key: 'all',     label: 'Alle acties (Geen filter)', abbr: 'Alles' },
  { key: 'any_kpi', label: 'Alle KPI Updates',         abbr: 'KPI' },
  ...EXPORT_KPI_DEFS
])

const actionMeta = {
  start:            { label: 'Simulatie gestart',     badge: 'badge-start',    icon: Play },
  pause:            { label: 'Simulatie gepauzeerd',   badge: 'badge-pause',    icon: Pause },
  resume:           { label: 'Simulatie hervat',       badge: 'badge-resume',   icon: Play },
  stop:             { label: 'Simulatie gestopt',      badge: 'badge-stop',     icon: Square },
  scenario_changed: { label: 'Scenario gewijzigd',     badge: 'badge-scenario', icon: MapPin },
  strategy_changed: { label: 'Strategie gewijzigd',    badge: 'badge-strategy', icon: GitBranch },
  speed_changed:    { label: 'Snelheid gewijzigd',     badge: 'badge-speed',    icon: Gauge },
  interval_changed: { label: 'Interval gewijzigd',     badge: 'badge-interval', icon: Timer },
  kpi_update:       { label: 'KPI Update',             badge: 'badge-kpi',      icon: BarChart3 }
}

const isSimRunning = computed(() => {
  const status = sumoState.value?.simulationStatus
  return hasUserStarted.value && ['running', 'paused', 'loading'].includes(status)
})

const scenarioOptions = computed(() => {
  const scenarios = simulationLogs.value
    .map(log => log.scenario)
    .filter(scenario => scenario && scenario !== 'N/A')

  if (selectedScenario.value && selectedScenario.value !== 'N/A') {
    scenarios.push(selectedScenario.value)
  }

  return [...new Set(scenarios)].sort((a, b) => a.localeCompare(b, 'nl-BE'))
})

const filteredLogs = computed(() => {
  let logs = [...simulationLogs.value].reverse() // newest first

  if (activeFilter.value !== 'all') {
    logs = logs.filter(log => log.action === activeFilter.value)
  }

  if (selectedTimeRange.value !== 'all') {
    const selectedRange = timeRangeOptions.find(option => option.id === selectedTimeRange.value)
    if (selectedRange?.milliseconds) {
      const cutoff = Date.now() - selectedRange.milliseconds
      logs = logs.filter(log => new Date(log.timestamp).getTime() >= cutoff)
    }
  }

  if (selectedScenarioFilter.value !== 'all') {
    logs = logs.filter(log => log.scenario === selectedScenarioFilter.value)
  }

  if (selectedKpiFilter.value === 'any_kpi') {
    logs = logs.filter(log => log.action === 'kpi_update' || (log.kpis && Object.keys(log.kpis).length > 0))
  } else if (selectedKpiFilter.value !== 'all') {
    logs = logs.filter(log => log.kpis && log.kpis[selectedKpiFilter.value] !== undefined)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    logs = logs.filter(log =>
      (actionMeta[log.action]?.label || log.action).toLowerCase().includes(q) ||
      (log.scenario || '').toLowerCase().includes(q) ||
      (log.detail || '').toLowerCase().includes(q) ||
      formatKpiSummary(log.kpis).toLowerCase().includes(q)
    )
  }

  return logs
})

function formatTime(isoString) {
  const d = new Date(isoString)
  return d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatKpiSummary(kpis) {
  if (!kpis) return '—'
  
  const kpiKeys = Object.keys(kpis).filter(k => k !== 'time')
  if (kpiKeys.length === 0) return '—'
  
  const isAllFilter = selectedKpiFilter.value === 'all' || selectedKpiFilter.value === 'any_kpi'
  const defs = isAllFilter
    ? EXPORT_KPI_DEFS
    : EXPORT_KPI_DEFS.filter(def => def.key === selectedKpiFilter.value)

  const parts = defs
    .filter(def => kpis[def.key] !== undefined)
    .map(def => `<span class="kpi-item"><span class="kpi-abbr">${def.abbr}:</span> ${formatKpiValue(kpis[def.key], def)}</span>`)

  return parts.length > 0 ? parts.join(' ') : '—'
}

function formatKpiValue(value, def) {
  const formatted = def.decimals === 0
    ? String(Math.round(Number(value)))
    : Number(value).toFixed(def.decimals)

  return def.unit ? `${formatted}${def.unit}` : formatted
}

function handleClearLogs() {
  clearLogs()
}

/**
 * Export the currently filtered logs as a CSV file.
 * Each KPI gets its own column for easy analysis in spreadsheet software.
 */
function exportLogsCSV() {
  showExportMenu.value = false
  const logs = filteredLogs.value
  if (logs.length === 0) return

  // Build header row
  const kpiHeaders = EXPORT_KPI_DEFS.map(d => d.unit ? `${d.abbr} (${d.unit})` : d.abbr)
  const headers = ['Timestamp', 'Actie', 'Actie Type', 'Scenario', 'Detail', ...kpiHeaders]

  // Escape a CSV field (wrap in quotes if it contains commas, quotes, or newlines)
  const esc = (val) => {
    if (val == null) return ''
    const s = String(val)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }

  const rows = logs.map(log => {
    const kpiValues = EXPORT_KPI_DEFS.map(d => {
      if (!log.kpis || log.kpis[d.key] === undefined) return ''
      return d.decimals === 0
        ? String(Math.round(Number(log.kpis[d.key])))
        : Number(log.kpis[d.key]).toFixed(d.decimals)
    })
    return [
      esc(log.timestamp),
      esc(actionMeta[log.action]?.label || log.action),
      esc(log.action),
      esc(log.scenario),
      esc(log.detail),
      ...kpiValues
    ].join(',')
  })

  const csvContent = [headers.join(','), ...rows].join('\n')
  downloadBlob(csvContent, 'text/csv;charset=utf-8;', 'simulatie_logs', 'csv')
}

/**
 * Export the currently filtered logs as a JSON file.
 * Includes metadata about active filters and full log data.
 */
function exportLogsJSON() {
  showExportMenu.value = false
  const logs = filteredLogs.value
  if (logs.length === 0) return

  const payload = {
    export_datum: new Date().toISOString(),
    actie_filter: activeFilter.value,
    scenario_filter: selectedScenarioFilter.value,
    kpi_filter: selectedKpiFilter.value,
    tijdsbereik_filter: selectedTimeRange.value,
    zoekopdracht: searchQuery.value || null,
    aantal_logs: logs.length,
    logs: logs.map(log => ({
      timestamp: log.timestamp,
      actie: actionMeta[log.action]?.label || log.action,
      actie_type: log.action,
      scenario: log.scenario,
      detail: log.detail,
      kpis: log.kpis || null
    }))
  }

  const jsonContent = JSON.stringify(payload, null, 2)
  downloadBlob(jsonContent, 'application/json;charset=utf-8;', 'simulatie_logs', 'json')
}

/** Create a Blob and trigger a download */
function downloadBlob(content, mimeType, baseName, extension) {
  const scenario = selectedScenarioFilter.value !== 'all' ? selectedScenarioFilter.value : 'alle'
  const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')
  const filename = `${baseName}_${scenario}_${dateStr}.${extension}`

  const blob = new Blob([content], { type: mimeType })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
</script>

<template>
  <div class="logs-viewer card border-0 shadow-sm overflow-hidden animate-fade-in">
    <div class="card-body p-0 d-flex flex-column h-100">

      <!-- Header -->
      <div class="logs-header d-flex justify-content-between align-items-center px-4 py-3 border-bottom">
        <div class="d-flex align-items-center gap-3">
          <div class="logs-icon-circle">
            <FileText :size="20" />
          </div>
          <div>
            <h5 class="fw-bold mb-0">Simulatie Logs</h5>
            <span class="text-muted smallest">Acties en simulatiegegevens</span>
          </div>
          <span v-if="isSimRunning" class="badge bg-success-soft text-success d-flex align-items-center gap-1 pulse">
            <span class="dot"></span> LIVE
          </span>
        </div>
        <div class="d-flex align-items-center gap-2">
          <div class="export-dropdown" ref="exportDropdownRef">
            <button
              class="btn btn-export d-flex align-items-center gap-2"
              @click="toggleExportMenu"
              :disabled="filteredLogs.length === 0"
              title="Download logs als CSV of JSON"
            >
              <Download :size="16" /> Export
              <span class="dropdown-caret">▾</span>
            </button>
            <transition name="dropdown-fade">
              <div v-if="showExportMenu" class="export-dropdown-menu">
                <button class="export-dropdown-item" @click="exportLogsCSV">
                  <span class="export-format-badge csv">CSV</span>
                  <span class="export-item-text">
                    <span class="export-item-title">Comma Separated Values</span>
                    <span class="export-item-desc">Geschikt voor Excel, Numbers, SPSS</span>
                  </span>
                </button>
                <button class="export-dropdown-item" @click="exportLogsJSON">
                  <span class="export-format-badge json">JSON</span>
                  <span class="export-item-text">
                    <span class="export-item-title">JavaScript Object Notation</span>
                    <span class="export-item-desc">Geschikt voor Python, R, scripts</span>
                  </span>
                </button>
              </div>
            </transition>
          </div>
          <button
            class="btn btn-clear-logs d-flex align-items-center gap-2"
            @click="handleClearLogs"
            :disabled="simulationLogs.length === 0"
            title="Wis alle logs"
          >
            <Trash2 :size="16" /> Wis Logs
          </button>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar d-flex flex-wrap align-items-center gap-3 px-4 py-3 border-bottom">
        <div class="search-wrapper">
          <Search :size="16" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            class="form-control form-control-sm search-input"
            placeholder="Zoek op actie, scenario of KPI..."
          />
        </div>
        <div class="select-wrapper">
          <Clock :size="16" class="select-icon" />
          <select
            v-model="selectedTimeRange"
            class="form-select form-select-sm filter-select"
            aria-label="Filter op tijd"
          >
            <option v-for="option in timeRangeOptions" :key="option.id" :value="option.id">
              {{ option.label }}
            </option>
          </select>
        </div>
        <div class="select-wrapper">
          <MapPin :size="16" class="select-icon" />
          <select
            v-model="selectedScenarioFilter"
            class="form-select form-select-sm filter-select"
            aria-label="Filter op scenario"
          >
            <option value="all">Alle scenario's</option>
            <option v-for="scenario in scenarioOptions" :key="scenario" :value="scenario">
              {{ scenario }}
            </option>
          </select>
        </div>
        <div class="select-wrapper select-wrapper-wide">
          <BarChart3 :size="16" class="select-icon" />
          <select
            v-model="selectedKpiFilter"
            class="form-select form-select-sm filter-select"
            aria-label="Filter op KPI"
          >
            <option v-for="kpi in kpiFilterOptions" :key="kpi.key" :value="kpi.key">
              {{ kpi.abbr }} - {{ kpi.label }}
            </option>
          </select>
        </div>
        <div class="filter-pills d-flex gap-1 flex-wrap">
          <button
            v-for="opt in filterOptions"
            :key="opt.id"
            class="filter-pill"
            :class="{ active: activeFilter === opt.id }"
            @click="activeFilter = opt.id"
          >
            {{ opt.label }}
          </button>
        </div>
        <span class="ms-auto text-muted smallest">{{ filteredLogs.length }} logregels</span>
      </div>

      <!-- Empty state -->
      <div v-if="filteredLogs.length === 0" class="empty-state d-flex flex-column align-items-center justify-content-center flex-grow-1 py-5">
        <div class="empty-icon-circle mb-4">
          <FileText :size="40" />
        </div>
        <h6 class="fw-bold text-muted mb-2">Geen logs beschikbaar</h6>
        <p class="text-muted small text-center" style="max-width: 320px;">
          Start een simulatie om acties en KPI-gegevens te zien verschijnen in het logboek.
        </p>
      </div>

      <!-- Log table -->
      <div v-else class="logs-table-wrapper flex-grow-1">
        <table class="table table-hover mb-0 logs-table">
          <thead>
            <tr>
              <th class="col-timestamp">
                <Clock :size="14" class="me-1" /> Timestamp
              </th>
              <th class="col-action">Actie</th>
              <th class="col-scenario">Scenario</th>
              <th class="col-kpi">KPI</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in filteredLogs" :key="log.id" class="log-row">
              <td class="col-timestamp">
                <code class="timestamp-code">{{ formatTime(log.timestamp) }}</code>
              </td>
              <td class="col-action">
                <span class="action-badge" :class="actionMeta[log.action]?.badge || ''">
                  <component :is="actionMeta[log.action]?.icon || FileText" :size="12" class="me-1" />
                  {{ actionMeta[log.action]?.label || log.action }}
                </span>
                <span v-if="log.detail" class="detail-tag ms-2">{{ log.detail }}</span>
              </td>
              <td class="col-scenario">
                <span class="scenario-tag">{{ log.scenario }}</span>
              </td>
              <td class="col-kpi">
                <div class="kpi-summary-container" v-html="formatKpiSummary(log.kpis)"></div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* Export Dropdown */
.export-dropdown {
  position: relative;
}

.btn-export {
  background: rgba(99, 102, 241, 0.08);
  color: #6366f1;
  border: 1px solid rgba(99, 102, 241, 0.2);
  font-weight: 600;
  font-size: 0.82rem;
  padding: 6px 14px;
  border-radius: 10px;
  transition: all 0.2s;
}

.btn-export:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.15);
  color: #4f46e5;
  border-color: rgba(99, 102, 241, 0.35);
}

.btn-export:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dropdown-caret {
  font-size: 0.7rem;
  opacity: 0.6;
  margin-left: 2px;
}

.export-dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 100;
  min-width: 280px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.export-dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  width: 100%;
}

.export-dropdown-item:hover {
  background: #f8fafc;
}

.export-format-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.export-format-badge.csv {
  background: linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%);
  color: #16a34a;
}

.export-format-badge.json {
  background: linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%);
  color: #6366f1;
}

.export-item-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.export-item-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: #1e293b;
}

.export-item-desc {
  font-size: 0.7rem;
  color: #94a3b8;
}

/* Dropdown transition */
.dropdown-fade-enter-active {
  transition: all 0.2s ease-out;
}
.dropdown-fade-leave-active {
  transition: all 0.15s ease-in;
}
.dropdown-fade-enter-from {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

.logs-viewer {
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  height: 100%;
}

/* Header */
.logs-header {
  position: relative;
  z-index: 10;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
}

.logs-icon-circle {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-clear-logs {
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.15);
  font-weight: 600;
  font-size: 0.82rem;
  padding: 6px 14px;
  border-radius: 10px;
  transition: all 0.2s;
}

.btn-clear-logs:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
  border-color: rgba(239, 68, 68, 0.3);
}

.btn-clear-logs:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Filter bar */
.filter-bar {
  flex-shrink: 0;
  background: white;
}

.search-wrapper {
  position: relative;
  min-width: 220px;
}

.select-wrapper {
  position: relative;
  min-width: 160px;
}

.select-wrapper-wide {
  min-width: 210px;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  pointer-events: none;
}

.select-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  pointer-events: none;
  z-index: 2;
}

.search-input {
  padding-left: 34px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  font-size: 0.82rem;
  transition: all 0.2s;
}

.filter-select {
  padding-left: 34px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background-color: #f8fafc;
  color: #334155;
  font-size: 0.82rem;
  font-weight: 500;
  min-height: 31px;
  transition: all 0.2s;
}

.search-input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  background: white;
}

.filter-select:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  background-color: white;
}

.filter-pill {
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s;
}

.filter-pill:hover {
  background: #f1f5f9;
  color: #334155;
}

.filter-pill.active {
  background: #6366f1;
  color: white;
  border-color: #6366f1;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

/* Empty state */
.empty-state {
  min-height: 400px;
}

.empty-icon-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%);
  color: #6366f1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Table */
.logs-table-wrapper {
  overflow-y: auto;
  max-height: calc(100vh - 340px);
}

.logs-table-wrapper::-webkit-scrollbar {
  width: 6px;
}

.logs-table-wrapper::-webkit-scrollbar-track {
  background: transparent;
}

.logs-table-wrapper::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 20px;
}

.logs-table-wrapper::-webkit-scrollbar-thumb:hover {
  background-color: #94a3b8;
}

.logs-table {
  font-size: 0.82rem;
}

.logs-table thead th {
  background: #f8fafc;
  border-bottom: 2px solid #e2e8f0;
  color: #64748b;
  font-weight: 700;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 10px 16px;
  position: sticky;
  top: 0;
  z-index: 2;
}

.log-row {
  transition: background 0.15s;
}

.log-row td {
  padding: 10px 16px;
  vertical-align: middle;
  border-bottom: 1px solid #f1f5f9;
}

.log-row:hover td {
  background: #f8fafc;
}

.col-timestamp { width: 130px; }
.col-action    { width: 200px; }
.col-scenario  { width: 160px; }
.col-kpi       { min-width: 200px; }

/* Timestamp */
.timestamp-code {
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.78rem;
  background: #f1f5f9;
  padding: 3px 8px;
  border-radius: 6px;
  color: #475569;
}

/* Action badges */
.action-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 8px;
  white-space: nowrap;
}

.badge-start {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.badge-pause {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.badge-resume {
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
}

.badge-stop {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.badge-kpi {
  background: rgba(99, 102, 241, 0.1);
  color: #4f46e5;
}

.badge-scenario {
  background: rgba(20, 184, 166, 0.1);
  color: #0d9488;
}

.badge-strategy {
  background: rgba(139, 92, 246, 0.1);
  color: #7c3aed;
}

.badge-speed {
  background: rgba(249, 115, 22, 0.1);
  color: #ea580c;
}

.badge-interval {
  background: rgba(14, 165, 233, 0.1);
  color: #0284c7;
}

.detail-tag {
  display: inline-block;
  font-size: 0.72rem;
  background: #f1f5f9;
  color: #475569;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}

/* Scenario tag */
.scenario-tag {
  display: inline-block;
  background: #f1f5f9;
  color: #334155;
  font-size: 0.78rem;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 6px;
}

/* KPI summary */
.kpi-summary-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 0.75rem;
  color: #64748b;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
}

:deep(.kpi-item) {
  background: white;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  white-space: nowrap;
}

:deep(.kpi-abbr) {
  font-weight: 700;
  color: #475569;
}

/* Shared styles */
.smallest {
  font-size: 0.72rem;
}

.bg-success-soft {
  background-color: #dcfce7;
  color: #166534;
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.72rem;
}

.dot {
  width: 7px;
  height: 7px;
  background-color: #22c55e;
  border-radius: 50%;
  display: inline-block;
}

.pulse {
  animation: pulse-anim 2s infinite;
}

@keyframes pulse-anim {
  0%   { transform: scale(1);    opacity: 1; }
  50%  { transform: scale(1.05); opacity: 0.8; }
  100% { transform: scale(1);    opacity: 1; }
}

.animate-fade-in {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
