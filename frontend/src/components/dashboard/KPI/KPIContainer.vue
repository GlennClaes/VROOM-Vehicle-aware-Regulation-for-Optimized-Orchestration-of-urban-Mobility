<template>
  <div class="card border-0 shadow-sm overflow-hidden animate-fade-in dashboard-container">
    <div class="card-body p-0 position-relative d-flex flex-column h-100">

      <!-- Header with Export Button -->
      <div class="d-flex justify-content-between align-items-center p-4 border-bottom bg-white header-sticky" v-if="effectiveIsRunning">
        <div class="d-flex align-items-center gap-3">
          <h5 class="fw-bold mb-0">Verkeersprestaties Dashboard</h5>
          <span class="badge bg-success-soft text-success d-flex align-items-center gap-1 pulse">
            <span class="dot"></span> LIVE
          </span>
        </div>
        <div class="dropdown">
          <button class="btn btn-primary-glass dropdown-toggle d-flex align-items-center gap-2" type="button" @click="showExportMenu = !showExportMenu">
            <Download :size="16" /> Export Data
          </button>
          <ul v-if="showExportMenu" class="dropdown-menu show shadow-lg border-0 position-absolute end-0 mt-2 animate-slide-down">
            <li><a class="dropdown-item py-2 cursor-pointer" @click="handleExport('csv')">CSV (Raw Data)</a></li>
            <li><a class="dropdown-item py-2 cursor-pointer" @click="handleExport('pdf')">PDF (Analysis Report)</a></li>
          </ul>
        </div>
      </div>

      <!-- View Switcher Tabs -->
      <div class="px-4 border-bottom bg-white d-flex align-items-center justify-content-between" v-if="effectiveIsRunning">
        <div class="nav nav-pills custom-pills py-2 gap-2">
          <button 
            class="nav-link" 
            :class="{ active: viewMode === 'grid' }" 
            @click="viewMode = 'grid'"
          >
            <LayoutGrid :size="16" class="me-2" /> Rasteroverzicht
          </button>
          <button 
            class="nav-link" 
            :class="{ active: viewMode === 'trend' }" 
            @click="viewMode = 'trend'"
          >
            <TrendingUp :size="16" class="me-2" /> Trend Analyse
          </button>
        </div>
        <div v-if="viewMode === 'trend'" class="text-muted small d-none d-md-block">
          Selecteer KPI's om de dynamische effecten over tijd te zien
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!effectiveIsRunning && !isStarting" class="w-100 d-flex align-items-center justify-content-center p-5 empty-state-height">
        <KPIEmptyState />
      </div>

      <!-- Skeleton loader while starting or waiting for first data -->
      <div v-else-if="isStarting || (effectiveIsRunning && !hasKpiData)" class="metrics-grid p-4 p-md-5">
        <div class="row g-4 justify-content-center">
          <div v-for="i in 14" :key="i" class="col-12 col-md-6 col-lg-3">
            <div class="card border-0 shadow-sm metric-card p-4 bg-white text-center h-100 skeleton-card">
              <div class="skeleton-line skeleton-title mb-2"></div>
              <div class="skeleton-line skeleton-value mb-3"></div>
              <div class="skeleton-line skeleton-text"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Metrics grid -->
      <div v-else-if="viewMode === 'grid'" class="metrics-grid p-4 p-md-5">
        <div class="row g-4 justify-content-center">
          <div v-for="kpi in kpiList" :key="kpi.key" class="col-12 col-md-6 col-lg-3">
            <KPICard
              v-bind="kpi"
              :value="currentKpis[kpi.key]"
            />
          </div>
        </div>
      </div>

      <!-- Trend View -->
      <div v-else class="metrics-grid p-4 p-md-5 d-flex flex-column gap-4">
        <div class="row g-4 h-100">
          <div class="col-12 col-xl-9 order-2 order-xl-1">
             <KPIChart 
               :data="kpiHistory" 
               :kpiConfigs="activeKpiConfigs"
               :title="chartTitle"
             />
          </div>
          <div class="col-12 col-xl-3 order-1 order-xl-2">
            <div class="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
              <h6 class="fw-bold mb-3 d-flex align-items-center gap-2">
                <ListOrdered :size="18" class="text-primary" />
                Selecteer KPI's
              </h6>
              <div class="d-flex flex-column gap-2 overflow-auto pe-1" style="max-height: 400px;">
                <div 
                  v-for="kpi in kpiList" 
                  :key="kpi.key"
                  class="kpi-selector-item p-2 rounded-3 cursor-pointer d-flex align-items-center gap-2 transition-all"
                  :class="{ 'active-selector': selectedKpiKeys.includes(kpi.key) }"
                  @click="toggleKpiSelection(kpi.key)"
                >
                  <div class="selection-indicator" :style="{ backgroundColor: selectedKpiKeys.includes(kpi.key) ? kpi.color : '#eee' }"></div>
                  <div class="flex-grow-1">
                    <div class="fw-medium small">{{ kpi.title }}</div>
                    <div class="smallest text-muted">{{ kpi.abbreviation }}</div>
                  </div>
                </div>
              </div>
              <div class="mt-auto pt-3 border-top mt-3">
                <p class="smallest text-muted mb-0 italic">Max. 4 gelijktijdige KPI's voor beste leesbaarheid.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { 
  Download, 
  ListOrdered, 
  LayoutGrid, 
  TrendingUp 
} from 'lucide-vue-next'
import KPIEmptyState from './KPIEmptyState.vue'
import KPICard from './KPICard.vue'
import KPIChart from './KPIChart.vue'
import { sumoState, sumoActions, isStarting, hasUserStarted, kpiHistory } from '@/composables/useSumoBridge'

const viewMode = ref('grid') // 'grid' or 'trend'
const selectedKpiKeys = ref(['avg_speed', 'vehicle_count', 'avg_waiting_time'])

defineProps({
  isRunning: {
    type: Boolean,
    default: false
  },
  runId: {
    type: String,
    default: null
  }
})

const showExportMenu = ref(false)

// Derive running state directly from sumoState to avoid reactivity mismatches
// between the Options API watcher in DashboardView and Composition API refs
const effectiveIsRunning = computed(() => {
  const status = sumoState.value?.simulationStatus
  return hasUserStarted.value && (status === 'loading' || status == 'running' || status === 'paused')
})

const hasKpiData = computed(() => {
  const kpis = sumoState.value?.stats?.kpis
  return kpis && Object.keys(kpis).length > 0 && kpis.tnr !== undefined
})

const currentKpis = computed(() => {
  return sumoState.value?.stats?.kpis || {}
})

const kpiList = computed(() => [
  { key: 'tnr',             title: 'Total Negative Reward',  abbreviation: 'TNR',   iconName: 'trending-down', color: '#8b5cf6', unit: '',    unitContext: 'Netto beloningsscore',        decimals: 2, tooltip: 'De cumulatieve negatieve beloning. Een lagere waarde duidt op meer verkeerscongestie en langere wachttijden.' },
  { key: 'tawt',            title: 'Accumm. Wait Time',      abbreviation: 'TAWT',  iconName: 'clock',         color: '#ef4444', unit: 's',   unitContext: 'Totale opgebouwde wachttijd', decimals: 0, tooltip: 'De som van alle tijd die alle voertuigen stilstaand hebben doorgebracht tijdens hun gehele route.' },
  { key: 'ewpc',            title: 'Avg Wait per Car',       abbreviation: 'EWPC',  iconName: 'timer',         color: '#f97316', unit: 's',   unitContext: 'Gem. wachttijd per voertuig', decimals: 1, tooltip: 'De gemiddelde tijd dat een individueel voertuig heeft moeten wachten tot nu toe.' },
  { key: 'aql',             title: 'Avg Queue Length',       abbreviation: 'AQL',   iconName: 'barchart',      color: '#3b82f6', unit: 'veh', unitContext: 'Gem. wachtrij per rijstrook', decimals: 2, tooltip: 'De gemiddelde lengte van de wachtrij bij alle kruispunten, gemeten in aantal voertuigen.' },
  { key: 'avg_speed',       title: 'Gemiddelde Snelheid',    abbreviation: 'AvgV',  iconName: 'gauge',         color: '#22c55e', unit: 'm/s', unitContext: 'm/s over hele netwerk',       decimals: 1, visualType: 'gauge', maxValue: 20,  tooltip: 'De gemiddelde snelheid van alle actieve voertuigen op dit moment. Hoger is doorgaans beter.' },
  { key: 'avg_waiting_time',title: 'Gem. Wachttijd',         abbreviation: 'AWT',   iconName: 'hourglass',     color: '#f59e0b', unit: 's',   unitContext: 'Huidige gem. wachttijd',      decimals: 1, tooltip: 'De gemiddelde wachttijd van alle actieve voertuigen op het huidige tijdstip.' },
  { key: 'vehicle_count',   title: 'Aantal Voertuigen',      abbreviation: 'Count', iconName: 'car',           color: '#14b8a6', unit: 'veh', unitContext: 'Actieve voertuigen',          decimals: 0, visualType: 'bar',   maxValue: 200, tooltip: 'Het totaal aantal voertuigen dat momenteel deelneemt aan de simulatie.' },
  { key: 'throughput',      title: 'Doorvoer',               abbreviation: 'TP',    iconName: 'arrow-right',   color: '#10b981', unit: 'veh', unitContext: 'Simulatie verlaten',          decimals: 0, visualType: 'bar',   maxValue: 100, tooltip: 'Het aantal voertuigen dat hun bestemming heeft bereikt en de simulatie heeft verlaten.' },
  { key: 'intersection_delay', title: 'Kruispuntvertraging', abbreviation: 'DLY',   iconName: 'alert',         color: '#f43f5e', unit: 's',   unitContext: 'Tijdverlies bij lichten',     decimals: 1, tooltip: 'Het totale tijdsverlies door vertraging bij kruispunten (TimeLoss).' },
  { key: 'pressure',        title: 'Druk',                   abbreviation: 'PRS',   iconName: 'activity',      color: '#6366f1', unit: '',    unitContext: 'In vs. Uit balans',           decimals: 0, tooltip: 'Het verschil tussen inkomend en uitgaand verkeer bij kruispunten; een maatstaf voor lokale opstopping.' },
  { key: 'ttt',             title: 'Totale Reistijd',        abbreviation: 'TTT',   iconName: 'route',         color: '#0ea5e9', unit: 's',   unitContext: 'Som van alle reistijden',     decimals: 0, tooltip: 'De cumulatieve tijd die door alle voertuigen in de simulatie is doorgebracht.' },
  { key: 'nql',             title: 'Genorm. Wachtrij',       abbreviation: 'NQL',   iconName: 'list',          color: '#a78bfa', unit: '',    unitContext: 'Genormaliseerde lengte',      decimals: 4, tooltip: 'Gemiddelde wachtrijlengte gecorrigeerd voor wegcapaciteit en lengte.' },
  { key: 'fairness',        title: 'Eerlijkheidsindex',      abbreviation: 'JFI',   iconName: 'scale',         color: '#06b6d4', unit: '',    unitContext: "Jain's Fairness Index",       decimals: 3, tooltip: "Een waarde tussen 0 en 1 die aangeeft hoe gelijkmatig de vertraging is verdeeld over alle voertuigen." },
  { key: 'tp_delay_ratio',  title: 'TP/Delay Ratio',         abbreviation: 'RAT',   iconName: 'ratio',         color: '#84cc16', unit: '',    unitContext: 'Doorvoer vs. Vertraging',     decimals: 4, tooltip: 'De verhouding tussen de gerealiseerde doorvoer en de opgelopen vertraging (hoger is beter).' },
])

function handleExport(format) {
  sumoActions.exportData(format)
  showExportMenu.value = false
}

const activeKpiConfigs = computed(() => {
  return kpiList.value.filter(kpi => selectedKpiKeys.value.includes(kpi.key))
})

const chartTitle = computed(() => {
  if (selectedKpiKeys.value.length === 1) {
    const kpi = kpiList.value.find(k => k.key === selectedKpiKeys.value[0])
    return `Trend: ${kpi?.title || 'KPI'}`
  }
  return 'Vergelijkende Trend Analyse'
})

function toggleKpiSelection(key) {
  const index = selectedKpiKeys.value.indexOf(key)
  if (index === -1) {
    if (selectedKpiKeys.value.length >= 4) {
      selectedKpiKeys.value.shift() // Remove oldest
    }
    selectedKpiKeys.value.push(key)
  } else {
    if (selectedKpiKeys.value.length > 1) {
      selectedKpiKeys.value.splice(index, 1)
    }
  }
}
</script>

<style scoped>
.dashboard-container {
  display: flex;
  flex-direction: column;
  background: #f8fafc;
}

.header-sticky {
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.9) !important;
}

.metrics-grid {
  flex-grow: 1;
  background: #f8fafc;
}

.metrics-grid::-webkit-scrollbar {
  width: 6px;
}

.metrics-grid::-webkit-scrollbar-track {
  background: transparent;
}

.metrics-grid::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 20px;
}

.metrics-grid::-webkit-scrollbar-thumb:hover {
  background-color: #94a3b8;
}

.metric-card {
  border-radius: 16px;
  transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(0,0,0,0.03) !important;
}

.metric-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0,0,0,0.08) !important;
  background: white !important;
}

.kpi-icon-circle {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.kpi-purple  { background: rgba(139, 92, 246, 0.12); color: #8b5cf6; }
.kpi-red     { background: rgba(239, 68, 68, 0.12);  color: #ef4444; }
.kpi-orange  { background: rgba(249, 115, 22, 0.12); color: #f97316; }
.kpi-blue    { background: rgba(59, 130, 246, 0.12); color: #3b82f6; }
.kpi-green   { background: rgba(34, 197, 94, 0.12);  color: #22c55e; }
.kpi-amber   { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }
.kpi-teal    { background: rgba(20, 184, 166, 0.12); color: #14b8a6; }
.kpi-emerald { background: rgba(16, 185, 129, 0.12); color: #10b981; }
.kpi-rose    { background: rgba(244, 63, 94, 0.12);  color: #f43f5e; }
.kpi-indigo  { background: rgba(99, 102, 241, 0.12); color: #6366f1; }
.kpi-sky     { background: rgba(14, 165, 233, 0.12); color: #0ea5e9; }
.kpi-violet  { background: rgba(167, 139, 250, 0.12);color: #a78bfa; }
.kpi-cyan    { background: rgba(6, 182, 212, 0.12);  color: #06b6d4; }
.kpi-lime    { background: rgba(132, 204, 22, 0.12); color: #84cc16; }

.uppercase-label {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.7rem;
  opacity: 0.8;
}

.display-value {
  font-size: 2.2rem;
  font-weight: 800;
  line-height: 1.1;
  margin-top: 0.5rem;
}

.unit {
  font-size: 1rem;
  font-weight: 500;
  opacity: 0.6;
  margin-left: 2px;
}

.text-purple  { color: #8b5cf6; }
.text-orange  { color: #f97316; }
.text-green   { color: #22c55e; }
.text-amber   { color: #f59e0b; }
.text-teal    { color: #14b8a6; }
.text-emerald { color: #10b981; }
.text-rose    { color: #f43f5e; }
.text-indigo  { color: #6366f1; }
.text-sky     { color: #0ea5e9; }
.text-violet  { color: #a78bfa; }
.text-cyan    { color: #06b6d4; }
.text-lime    { color: #84cc16; }

.bg-success-soft {
  background-color: #dcfce7;
  color: #166534;
  padding: 6px 12px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.75rem;
}

.dot {
  width: 8px;
  height: 8px;
  background-color: #22c55e;
  border-radius: 50%;
  display: inline-block;
}

.pulse {
  animation: pulse-animation 2s infinite;
}

@keyframes pulse-animation {
  0%   { transform: scale(1);    opacity: 1; }
  50%  { transform: scale(1.05); opacity: 0.8; }
  100% { transform: scale(1);    opacity: 1; }
}

.animate-slide-down {
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.btn-primary-glass {
  background: rgba(13, 110, 253, 0.1);
  color: #0d6efd;
  border: none;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 10px;
  transition: all 0.2s;
}

.btn-primary-glass:hover {
  background: rgba(13, 110, 253, 0.2);
}

.empty-state-height {
  min-height: 500px;
}

.custom-pills .nav-link {
  border-radius: 12px;
  padding: 8px 16px;
  font-weight: 600;
  color: #64748b;
  font-size: 0.9rem;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.custom-pills .nav-link:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.custom-pills .nav-link.active {
  background: #3b82f6;
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.kpi-selector-item {
  border: 1px solid transparent;
  transition: all 0.2s;
}

.kpi-selector-item:hover {
  background: #f1f5f9;
}

.active-selector {
  background: #f8fafc;
  border-color: #e2e8f0;
}

.selection-indicator {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.cursor-pointer {
  cursor: pointer;
}

.transition-all {
  transition: all 0.2s ease;
}

.italic {
  font-style: italic;
}

.animate-fade-in {
  animation: fadeIn 0.6s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Skeleton Styles */
.skeleton-card {
  border-radius: 20px;
  overflow: hidden;
  position: relative;
  cursor: default;
}

.skeleton-card:hover {
  transform: none !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03) !important;
}

.skeleton-line {
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite linear;
  border-radius: 4px;
}

.skeleton-title {
  width: 60%;
  height: 0.75rem;
  margin: 0 auto;
}

.skeleton-value {
  width: 80%;
  height: 2.5rem;
  margin: 0 auto;
}

.skeleton-text {
  width: 90%;
  height: 0.6rem;
  margin: 0 auto;
}

@keyframes skeleton-loading {
  0%   { background-position:  200% 0; }
  100% { background-position: -200% 0; }
}
</style>
