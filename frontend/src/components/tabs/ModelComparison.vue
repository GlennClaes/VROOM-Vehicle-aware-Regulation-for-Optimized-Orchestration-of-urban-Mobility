<script setup>
import { ref, onMounted, computed } from 'vue'
import { Trash2, TrendingDown, Clock, MapPin, Database, BarChart2, Activity, Check, Download, Trophy } from 'lucide-vue-next'
import { simulationService } from '@/services/simulationService'
import SimulationImporter from './SimulationImporter.vue'

const results = ref([])
const selectedIds = ref([])
const loading = ref(false)

const fetchResults = async () => {
  loading.value = true
  try {
    results.value = await simulationService.getResults()
  } catch (err) {
    console.error('Failed to fetch simulation results:', err)
  } finally {
    loading.value = false
  }
}

const deleteResult = async (id) => {
  if (!confirm('Weet u zeker dat u deze simulatie wilt verwijderen?')) return
  try {
    await simulationService.deleteResult(id)
    await fetchResults()
  } catch (err) {
    alert('Verwijderen mislukt.')
  }
}

const toggleSelection = (id) => {
  const index = selectedIds.value.indexOf(id)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    if (selectedIds.value.length >= 3) {
      alert('U kunt maximaal 3 simulaties tegelijk vergelijken.')
      return
    }
    selectedIds.value.push(id)
  }
}

const comparedResults = computed(() => {
  return results.value.filter(r => selectedIds.value.includes(r.id))
})

/**
 * Parse the last ttt (Total Travel Time) from a simulation's data_points JSON.
 * Returns the last ttt value or null if not parseable.
 */
function getLastTtt(res) {
  if (!res.data_points) return null
  try {
    const points = typeof res.data_points === 'string' ? JSON.parse(res.data_points) : res.data_points
    if (Array.isArray(points) && points.length > 0) {
      const last = points[points.length - 1]
      return last.ttt ?? null
    }
  } catch (e) { /* ignore parse errors */ }
  return null
}

/**
 * Group all simulation results by strategy and compute average KPIs per group.
 * Returns an array of { strategy, count, avgTravelTime, avgSpeed, flowRate, avgDelay }
 */
const strategyAverages = computed(() => {
  if (results.value.length === 0) return []

  const groups = {}
  for (const res of results.value) {
    const key = res.strategy
    if (!groups[key]) {
      groups[key] = { strategy: key, items: [] }
    }
    groups[key].items.push(res)
  }

  const averages = Object.values(groups).map(group => {
    const items = group.items
    const count = items.length

    // Gemiddelde reistijd: ttt / total_vehicles per simulatie, dan gemiddelde
    let travelTimeSum = 0
    let travelTimeCount = 0
    for (const res of items) {
      const ttt = getLastTtt(res)
      if (ttt !== null && res.total_vehicles > 0) {
        travelTimeSum += ttt / res.total_vehicles
        travelTimeCount++
      }
    }
    const avgTravelTime = travelTimeCount > 0 ? travelTimeSum / travelTimeCount : null

    // Gemiddelde snelheid
    const avgSpeed = items.reduce((sum, r) => sum + (r.avg_speed || 0), 0) / count

    // Doorstroming (voertuigen/minuut)
    const flowRate = items.reduce((sum, r) => {
      const minutes = (r.total_steps || 1) / 60
      return sum + (r.throughput / minutes)
    }, 0) / count

    // Gemiddelde vertraging
    const avgDelay = items.reduce((sum, r) => sum + (r.avg_wait_time || 0), 0) / count

    return {
      strategy: group.strategy,
      count,
      avgTravelTime,
      avgSpeed,
      flowRate,
      avgDelay
    }
  })

  // Determine best values (lowest travel time, highest speed, highest flow, lowest delay)
  if (averages.length > 1) {
    const travelTimes = averages.filter(a => a.avgTravelTime !== null).map(a => a.avgTravelTime)
    const speeds = averages.map(a => a.avgSpeed)
    const flows = averages.map(a => a.flowRate)
    const delays = averages.map(a => a.avgDelay)

    const bestTravelTime = travelTimes.length > 0 ? Math.min(...travelTimes) : null
    const bestSpeed = Math.max(...speeds)
    const bestFlow = Math.max(...flows)
    const bestDelay = Math.min(...delays)

    for (const avg of averages) {
      avg.isBestTravelTime = avg.avgTravelTime !== null && avg.avgTravelTime === bestTravelTime
      avg.isBestSpeed = avg.avgSpeed === bestSpeed
      avg.isBestFlow = avg.flowRate === bestFlow
      avg.isBestDelay = avg.avgDelay === bestDelay
    }
  }

  return averages
})

/**
 * Helper to find the maximum value of a specific KPI across all strategies
 * for calculating the progress bar widths.
 */
function getMaxKpi(kpiKey) {
  if (strategyAverages.value.length === 0) return 1
  const max = Math.max(...strategyAverages.value.map(a => a[kpiKey] || 0))
  return max > 0 ? max : 1
}

onMounted(fetchResults)

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const exportToCsv = (res) => {
  let parsedPoints = []
  let isDetailed = false
  
  if (res.data_points) {
    try {
      parsedPoints = typeof res.data_points === 'string' ? JSON.parse(res.data_points) : res.data_points
      if (Array.isArray(parsedPoints) && parsedPoints.length > 0) {
        isDetailed = true
      }
    } catch (e) {
      console.error('Failed to parse data_points, falling back to summary export:', e)
    }
  }

  let csvContent = ''
  
  const formatValue = (val, decimals = 2) => {
    if (val === undefined || val === null) return '0'
    return typeof val === 'number' ? val.toFixed(decimals) : String(val)
  }

  const kpiDefs = [
    { key: 'tnr', label: 'Total Negative Reward', abbr: 'TNR', unit: '', decimals: 2 },
    { key: 'tawt', label: 'Accum. Wait Time', abbr: 'TAWT', unit: 's', decimals: 0 },
    { key: 'ewpc', label: 'Avg Wait per Car', abbr: 'EWPC', unit: 's', decimals: 1 },
    { key: 'aql', label: 'Avg Queue Length', abbr: 'AQL', unit: 'veh', decimals: 2 },
    { key: 'avg_speed', label: 'Gemiddelde Snelheid', abbr: 'AvgV', unit: 'm/s', decimals: 1 },
    { key: 'avg_waiting_time', label: 'Gem. Wachttijd', abbr: 'AWT', unit: 's', decimals: 1 },
    { key: 'vehicle_count', label: 'Aantal Voertuigen', abbr: 'Count', unit: 'veh', decimals: 0 },
    { key: 'throughput', label: 'Doorvoer', abbr: 'TP', unit: 'veh', decimals: 0 },
    { key: 'intersection_delay', label: 'Kruispuntvertraging', abbr: 'DLY', unit: 's', decimals: 1 },
    { key: 'pressure', label: 'Druk', abbr: 'PRS', unit: '', decimals: 0 },
    { key: 'ttt', label: 'Totale Reistijd', abbr: 'TTT', unit: 's', decimals: 0 },
    { key: 'nql', label: 'Genorm. Wachtrij', abbr: 'NQL', unit: '', decimals: 4 },
    { key: 'fairness', label: 'Eerlijkheidsindex', abbr: 'JFI', unit: '', decimals: 3 },
    { key: 'tp_delay_ratio', label: 'TP/Delay Ratio', abbr: 'RAT', unit: '', decimals: 4 }
  ]

  if (isDetailed) {
    const headers = [
      'Time (Tijd)',
      ...kpiDefs.map(d => {
        const abbrPart = d.abbr ? ` (${d.abbr})` : ''
        const unitPart = d.unit ? ` (${d.unit})` : ''
        return `${d.label}${abbrPart}${unitPart}`
      })
    ]
    const rows = parsedPoints.map((point) => {
      const timeVal = point.time ?? point.step ?? 0
      return [
        timeVal,
        ...kpiDefs.map(d => {
          let val = point[d.key]
          if (val === undefined) {
            if (d.key === 'ewpc') val = point.avg_waiting_time ?? point.avg_wait_time
            else if (d.key === 'aql') val = point.avg_queue
          }
          return formatValue(val, d.decimals)
        })
      ]
    })
    
    csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
  } else {
    const headers = ['KPI', 'Waarde', 'Eenheid']
    const rows = [
      ['Scenario', res.scenario || 'Standaard Scenario', ''],
      ['Strategie', res.strategy, ''],
      ['Model Naam', res.model_name || 'N/A', ''],
      ['Netwerk', res.network || 'Hasselt XL', ''],
      ['Datum/Tijd', res.date_time, ''],
      ['Duur', res.total_steps, 's'],
      ['Gemiddelde Wachtrij', formatValue(res.avg_queue, 2), 'veh'],
      ['Gemiddelde Snelheid', formatValue(res.avg_speed, 1), 'km/h'],
      ['Gemiddelde Wachttijd', formatValue(res.avg_wait_time, 1), 's'],
      ['Teleports', res.teleports, ''],
      ['Doorvoer (Throughput)', res.throughput, 'veh'],
      ['Totaal Aantal Voertuigen', res.total_vehicles, 'veh']
    ]
    csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
  }

  const cleanString = (str) => str ? str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_+|_+$)/g, '') : ''
  const scenarioStr = cleanString(res.scenario || 'standaard')
  const strategyStr = cleanString(res.strategy || 'onbekend')
  const dateStr = new Date(res.date_time || Date.now()).toISOString().slice(0, 10)
  const filename = `traffic_simulation_${scenarioStr}_${strategyStr}_${dateStr}.csv`

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

</script>

<template>
  <div class="comparison-container p-3 d-flex flex-column overflow-hidden">
    <div class="row g-3 flex-grow-1 overflow-hidden h-100 flex-nowrap">
      <!-- Result List -->
      <div class="col-12 col-xl-5 d-flex flex-column h-100 overflow-hidden">
        <!-- Importeer CSV Card -->
        <SimulationImporter @imported="fetchResults" class="flex-shrink-0 mb-3" />

        <div class="card border-0 shadow-sm flex-grow-1 d-flex flex-column overflow-hidden">
          <div class="card-header bg-white border-bottom p-3 d-flex justify-content-between align-items-center flex-shrink-0">
            <h6 class="mb-0 fw-bold d-flex align-items-center gap-2">
              <Database size="18" class="text-primary" />
              Opgeslagen Simulaties
            </h6>
            <span class="badge bg-primary rounded-pill">{{ results.length }}</span>
          </div>
          <div class="card-body p-0 flex-grow-1 d-flex flex-column overflow-hidden">
            <div v-if="loading" class="p-5 text-center flex-grow-1 d-flex align-items-center justify-content-center">
              <div class="spinner-border text-primary" role="status"></div>
            </div>
            <div v-else-if="results.length === 0" class="p-5 text-center text-muted flex-grow-1 d-flex flex-column align-items-center justify-content-center">
              <BarChart2 size="48" class="mb-3 opacity-25" />
              <p class="mb-0">Geen opgeslagen simulaties gevonden.<br>Voer een simulatie uit en klik op "Opslaan".</p>
            </div>
            <div v-else class="list-group list-group-flush scroll-container flex-grow-1" style="overflow-y: auto !important; overflow-x: hidden !important;">
              <div 
                v-for="res in results" 
                :key="res.id"
                class="list-group-item list-group-item-action p-3 border-start-4 transition-all result-card"
                :class="{ 
                  'active-selection': selectedIds.includes(res.id),
                  'border-primary': res.strategy.includes('AI'),
                  'border-success': res.strategy.includes('Baseline')
                }"
                @click="toggleSelection(res.id)"
              >
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <div class="d-flex align-items-center gap-2">
                    <div v-if="selectedIds.includes(res.id)" class="selection-check">
                      <Check size="14" stroke-width="3" />
                    </div>
                    <div>
                      <div class="badge mb-1" :class="res.strategy.includes('AI') ? 'bg-primary-subtle text-primary' : 'bg-success-subtle text-success'">
                        {{ res.strategy }}
                      </div>
                      <h6 class="mb-0 fw-bold text-dark">{{ res.scenario || 'Standaard Scenario' }}</h6>
                      <div class="d-flex gap-2 align-items-center mt-1" style="font-size: 0.8rem;">
                        <span class="text-muted fw-bold">{{ res.network || 'Hasselt XL' }}</span>
                        <span v-if="res.model_name && res.model_name !== 'N/A'" class="text-muted opacity-50">•</span>
                        <span v-if="res.model_name && res.model_name !== 'N/A'" class="text-info">{{ res.model_name }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    <button @click.stop="exportToCsv(res)" class="btn btn-link text-primary p-0 opacity-50 hover-opacity-100" title="Exporteer naar CSV">
                      <Download size="16" />
                    </button>
                    <button @click.stop="deleteResult(res.id)" class="btn btn-link text-danger p-0 opacity-50 hover-opacity-100">
                      <Trash2 size="16" />
                    </button>
                  </div>
                </div>
                <div class="d-flex gap-3 text-muted small">
                  <span class="d-flex align-items-center gap-1"><Clock size="12" /> {{ formatDate(res.date_time) }}</span>
                  <div class="d-flex align-items-center gap-1 text-muted">
                    <Activity :size="14" />
                    <span>{{ res.total_steps }} sec</span>
                  </div>
                </div>
                
                <div class="mt-3 grid-stats">
                  <div class="stat-item">
                    <div class="stat-label">Avg Queue</div>
                    <div class="stat-value text-dark">{{ res.avg_queue.toFixed(2) }} <small>veh</small></div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-label">Wait Time</div>
                    <div class="stat-value text-dark">{{ res.avg_wait_time.toFixed(0) }} <small>s</small></div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-label">Snelheid</div>
                    <div class="stat-value text-primary">{{ (res.avg_speed || 0).toFixed(1) }} <small>km/h</small></div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-label text-success fw-bold">Flow (Avg)</div>
                    <div class="stat-value text-success">
                      {{ (res.throughput / (res.total_steps || 1) * 60).toFixed(1) }}
                      <small>v/m</small>
                    </div>
                    <div class="text-muted" style="font-size: 0.65rem;">
                      {{ res.total_vehicles ? ((res.throughput / res.total_vehicles) * 100).toFixed(1) + '% voltooid' : '' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Comparison View -->
      <div class="col-12 col-xl-7 d-flex flex-column h-100 overflow-hidden">
        <div class="card border-0 shadow-sm h-100 bg-light-subtle d-flex flex-column overflow-hidden">
          <div class="card-header bg-white border-bottom p-3 flex-shrink-0">
            <h6 class="mb-0 fw-bold d-flex align-items-center gap-2">
              <TrendingDown size="18" class="text-success" />
              Vergelijkings Analyse
            </h6>
          </div>
          <div class="card-body scroll-container flex-grow-1" style="overflow-y: auto !important; overflow-x: hidden !important;">

            <!-- ═══════════════════════════════════════════════════════════ -->
            <!-- GEMIDDELDE MODELPRESTATIES — always visible when results exist -->
            <!-- ═══════════════════════════════════════════════════════════ -->
            <div v-if="strategyAverages.length > 0" class="avg-performance-section mb-4">
              <div class="section-header d-flex align-items-center gap-2 mb-3">
                <div class="section-icon-wrapper">
                  <Trophy size="16" />
                </div>
                <div>
                  <h6 class="mb-0 fw-bold">Gemiddelde Modelprestaties</h6>
                  <span class="text-muted" style="font-size: 0.75rem;">Geaggregeerd over alle opgeslagen simulaties per strategie</span>
                </div>
              </div>

              <!-- Strategy Average Cards -->
              <div class="strategy-avg-grid">
                <div 
                  v-for="avg in strategyAverages" 
                  :key="'avg-' + avg.strategy" 
                  class="strategy-avg-card"
                >
                  <div class="strategy-avg-header">
                    <div class="d-flex align-items-center gap-2">
                      <div class="strategy-dot" :class="avg.strategy.includes('AI') ? 'dot-ai' : 'dot-baseline'"></div>
                      <span class="fw-bold text-dark">{{ avg.strategy }}</span>
                    </div>
                    <span class="badge bg-light text-muted border">{{ avg.count }} sim{{ avg.count !== 1 ? 's' : '' }}</span>
                  </div>

                  <div class="kpi-grid-4">
                    <!-- Gemiddelde Reistijd -->
                    <div class="kpi-metric-card">
                      <div class="kpi-metric-label">
                        <Clock size="12" class="text-muted" />
                        Gem. Reistijd
                      </div>
                      <div class="kpi-metric-value" :class="{ 'best-value': avg.isBestTravelTime }">
                        <span v-if="avg.avgTravelTime !== null">{{ avg.avgTravelTime.toFixed(1) }}</span>
                        <span v-else class="text-muted">N/A</span>
                        <small v-if="avg.avgTravelTime !== null" class="kpi-unit">s/veh</small>
                        <Trophy v-if="avg.isBestTravelTime" size="12" class="trophy-icon" />
                      </div>
                      <div class="kpi-bar-track">
                        <div 
                          class="kpi-bar-fill bar-travel-time" 
                          :style="{ width: avg.avgTravelTime !== null ? Math.min(avg.avgTravelTime / getMaxKpi('avgTravelTime') * 100, 100) + '%' : '0%' }"
                        ></div>
                      </div>
                    </div>

                    <!-- Gemiddelde Snelheid -->
                    <div class="kpi-metric-card">
                      <div class="kpi-metric-label">
                        <Activity size="12" class="text-muted" />
                        Gem. Snelheid
                      </div>
                      <div class="kpi-metric-value" :class="{ 'best-value': avg.isBestSpeed }">
                        {{ avg.avgSpeed.toFixed(1) }}
                        <small class="kpi-unit">km/h</small>
                        <Trophy v-if="avg.isBestSpeed" size="12" class="trophy-icon" />
                      </div>
                      <div class="kpi-bar-track">
                        <div 
                          class="kpi-bar-fill bar-speed" 
                          :style="{ width: Math.min(avg.avgSpeed / getMaxKpi('avgSpeed') * 100, 100) + '%' }"
                        ></div>
                      </div>
                    </div>

                    <!-- Doorstroming -->
                    <div class="kpi-metric-card">
                      <div class="kpi-metric-label">
                        <TrendingDown size="12" class="text-muted" />
                        Doorstroming
                      </div>
                      <div class="kpi-metric-value" :class="{ 'best-value': avg.isBestFlow }">
                        {{ avg.flowRate.toFixed(1) }}
                        <small class="kpi-unit">veh/min</small>
                        <Trophy v-if="avg.isBestFlow" size="12" class="trophy-icon" />
                      </div>
                      <div class="kpi-bar-track">
                        <div 
                          class="kpi-bar-fill bar-flow" 
                          :style="{ width: Math.min(avg.flowRate / getMaxKpi('flowRate') * 100, 100) + '%' }"
                        ></div>
                      </div>
                    </div>

                    <!-- Gemiddelde Vertraging -->
                    <div class="kpi-metric-card">
                      <div class="kpi-metric-label">
                        <Clock size="12" class="text-muted" />
                        Gem. Vertraging
                      </div>
                      <div class="kpi-metric-value" :class="{ 'best-value': avg.isBestDelay }">
                        {{ avg.avgDelay.toFixed(1) }}
                        <small class="kpi-unit">s</small>
                        <Trophy v-if="avg.isBestDelay" size="12" class="trophy-icon" />
                      </div>
                      <div class="kpi-bar-track">
                        <div 
                          class="kpi-bar-fill bar-delay" 
                          :style="{ width: Math.min(avg.avgDelay / getMaxKpi('avgDelay') * 100, 100) + '%' }"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <!-- ═══════════════════════════════════════════════════════════ -->

            <div v-if="selectedIds.length === 0 && strategyAverages.length === 0" class="h-100 d-flex flex-column align-items-center justify-content-center text-center p-5">
              <BarChart2 size="64" class="text-muted mb-4 opacity-25" />
              <h5 class="text-muted">Selecteer simulaties</h5>
              <p class="text-muted small">Selecteer maximaal 3 simulaties uit de lijst om de prestaties te vergelijken.</p>
            </div>

            <!-- Individual Comparison (when items selected) -->
            <div v-if="selectedIds.length > 0">
              <div v-if="strategyAverages.length > 0" class="section-header d-flex align-items-center gap-2 mb-3">
                <div class="section-icon-wrapper section-icon-compare">
                  <BarChart2 size="16" />
                </div>
                <div>
                  <h6 class="mb-0 fw-bold">Individuele Vergelijking</h6>
                  <span class="text-muted" style="font-size: 0.75rem;">{{ selectedIds.length }} simulatie{{ selectedIds.length !== 1 ? 's' : '' }} geselecteerd</span>
                </div>
              </div>

              <!-- KPI Comparison Cards -->
              <div class="row g-3 mb-4">
                <div class="col-md-4">
                  <div class="card border-0 shadow-sm p-3 bg-white">
                    <label class="text-muted small fw-bold mb-2">Gemiddelde Wachtrij (Lager is beter)</label>
                    <div class="comparison-bars">
                      <div v-for="res in comparedResults" :key="'q-'+res.id" class="mb-3">
                        <div class="d-flex justify-content-between mb-1 small text-truncate">
                          <span>{{ res.strategy }}</span>
                          <span class="fw-bold">{{ res.avg_queue.toFixed(2) }} veh</span>
                        </div>
                        <div class="progress" style="height: 12px;">
                          <div 
                            class="progress-bar transition-all" 
                            :class="res.strategy.includes('AI') ? 'bg-primary' : 'bg-success'"
                            :style="{ width: Math.min(res.avg_queue / 10 * 100, 100) + '%' }"
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="card border-0 shadow-sm p-3 bg-white">
                    <label class="text-muted small fw-bold mb-2">Gemiddelde Snelheid (Hoger is beter)</label>
                    <div class="comparison-bars">
                      <div v-for="res in comparedResults" :key="'s-'+res.id" class="mb-3">
                        <div class="d-flex justify-content-between mb-1 small text-truncate">
                          <span>{{ res.strategy }}</span>
                          <span class="fw-bold text-primary">{{ (res.avg_speed || 0).toFixed(1) }} km/h</span>
                        </div>
                        <div class="progress" style="height: 12px;">
                          <div 
                            class="progress-bar transition-all bg-primary" 
                            :style="{ width: Math.min((res.avg_speed || 0) / 50 * 100, 100) + '%' }"
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="card border-0 shadow-sm p-3 bg-white">
                    <label class="text-muted small fw-bold mb-2">Gemiddelde Wachttijd (Lager is beter)</label>
                    <div class="comparison-bars">
                      <div v-for="res in comparedResults" :key="'w-'+res.id" class="mb-3">
                        <div class="d-flex justify-content-between mb-1 small text-truncate">
                          <span>{{ res.strategy }}</span>
                          <span class="fw-bold text-danger">{{ (res.avg_wait_time || 0).toFixed(0) }} s</span>
                        </div>
                        <div class="progress" style="height: 12px;">
                          <div 
                            class="progress-bar transition-all bg-danger" 
                            :style="{ width: Math.min((res.avg_wait_time || 0) / 100 * 100, 100) + '%' }"
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Detailed Table -->
              <div class="table-responsive bg-white rounded shadow-sm border overflow-hidden">
                <table class="table table-hover mb-0 align-middle" style="table-layout: fixed; width: 100%;">
                  <thead class="bg-light">
                    <tr class="text-uppercase text-muted" style="font-size: 0.8rem; letter-spacing: 0.5px;">
                      <th class="p-3 border-0" style="width: 30%;">Configuratie</th>
                      <th class="p-3 border-0 text-center">Queue</th>
                      <th class="p-3 border-0 text-center">Snelheid</th>
                      <th class="p-3 border-0 text-center">Flow</th>
                      <th class="p-3 border-0 text-center">Teleports</th>
                      <th class="p-3 border-0 text-center">Duur</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="res in comparedResults" :key="'t-'+res.id">
                      <td class="p-3">
                        <div class="d-flex align-items-start gap-3">
                          <div :class="res.strategy.includes('AI') ? 'bg-primary' : 'bg-success'" style="width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; mt-2"></div>
                          <div>
                            <div class="fw-bold text-dark" style="font-size: 0.95rem;">{{ res.strategy }}</div>
                            <div class="text-muted mt-1" style="font-size: 0.8rem;">
                              {{ res.scenario }} • {{ res.network || 'Hasselt XL' }}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td class="p-3 text-center">
                        <div class="fw-bold text-dark">{{ res.avg_queue.toFixed(2) }}</div>
                        <div class="text-muted" style="font-size: 0.65rem;">veh</div>
                      </td>
                      <td class="p-3 text-center">
                        <div class="fw-bold text-primary">{{ (res.avg_speed || 0).toFixed(1) }}</div>
                        <div class="text-muted" style="font-size: 0.65rem;">km/h</div>
                      </td>
                      <td class="p-3 text-center">
                        <div class="fw-bold text-success">{{ (res.throughput / (res.total_steps || 1) * 60).toFixed(1) }}</div>
                        <div class="text-muted" style="font-size: 0.65rem;">v/m</div>
                      </td>
                      <td class="p-3 text-center" :class="res.teleports > 50 ? 'text-danger fw-bold' : ''">{{ res.teleports }}</td>
                      <td class="p-3 text-center text-muted">{{ res.total_steps }}s</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.comparison-container {
  background: #fcfcfc;
  height: 100% !important;
  overflow: hidden;
}

.transition-all {
  transition: all 0.2s ease-in-out;
}

.border-start-4 {
  border-left: 4px solid transparent !important;
}

.result-card {
  cursor: pointer;
  border-right: 1px solid transparent;
}

.result-card:hover {
  background-color: #fcfdfe;
}

.active-selection {
  background-color: #f0f7ff !important;
  border-right: 3px solid #0d6efd !important;
  box-shadow: inset 4px 0 0 -2px #0d6efd;
}

.selection-check {
  background: #0d6efd;
  color: white;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(13, 110, 253, 0.3);
}

.grid-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  background: #f8f9fa;
  padding: 8px;
  border-radius: 8px;
}

.stat-item {
  text-align: center;
}

.stat-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  color: #6c757d;
  font-weight: 700;
  margin-bottom: 2px;
}

.stat-value {
  font-size: 0.85rem;
  font-weight: 700;
}

.hover-opacity-100:hover {
  opacity: 1 !important;
}

.bg-primary-subtle { background-color: rgba(13, 110, 253, 0.1); }
.bg-success-subtle { background-color: rgba(25, 135, 84, 0.1); }

.scroll-container {
  overflow-y: auto !important;
  overflow-x: hidden !important;
}

/* Scrollbar Styling */
.scroll-container::-webkit-scrollbar {
  width: 6px;
}
.scroll-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 10px;
}
.scroll-container::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 10px;
}
.scroll-container::-webkit-scrollbar-thumb:hover {
  background: #aaa;
}

/* --- New Average Performance Section Styles --- */
.avg-performance-section {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0,0,0,0.05);
}

.section-icon-wrapper {
  background: rgba(255, 193, 7, 0.15);
  color: #ffb300;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.section-icon-compare {
  background: rgba(13, 110, 253, 0.1);
  color: #0d6efd;
}

.strategy-avg-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.strategy-avg-card {
  border: 1px solid #eaeaea;
  border-radius: 10px;
  padding: 1rem;
  background: #fafafa;
  transition: all 0.2s ease;
}

.strategy-avg-card:hover {
  background: white;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  border-color: #dee2e6;
}

.strategy-avg-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #f0f0f0;
}

.strategy-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.dot-ai { background: #0d6efd; box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.1); }
.dot-baseline { background: #198754; box-shadow: 0 0 0 3px rgba(25, 135, 84, 0.1); }

.kpi-grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.kpi-metric-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.kpi-metric-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6c757d;
  display: flex;
  align-items: center;
  gap: 4px;
}

.kpi-metric-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #333;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.kpi-unit {
  font-size: 0.75rem;
  font-weight: 500;
  color: #999;
}

.best-value {
  color: #0d6efd;
}
.best-value .kpi-unit {
  color: rgba(13, 110, 253, 0.7);
}

.trophy-icon {
  color: #ffb300;
  margin-left: 4px;
  align-self: center;
}

.kpi-bar-track {
  height: 6px;
  background: #e9ecef;
  border-radius: 3px;
  margin-top: 4px;
  overflow: hidden;
}

.kpi-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.bar-travel-time { background: #17a2b8; }
.bar-speed { background: #0d6efd; }
.bar-flow { background: #20c997; }
.bar-delay { background: #dc3545; }

/* Responsive adjustments */
@media (max-width: 992px) {
  .kpi-grid-4 {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.25rem;
  }
}
</style>
