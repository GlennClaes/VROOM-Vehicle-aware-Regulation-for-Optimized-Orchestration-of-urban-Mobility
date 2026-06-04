<script setup>
import { ref } from 'vue'
import { Upload, AlertTriangle, CheckCircle2 } from 'lucide-vue-next'
import { simulationService } from '@/services/simulationService'

const emit = defineEmits(['imported'])

// File Import States
const fileInput = ref(null)
const isDragging = ref(false)
const isParsing = ref(false)
const isSavingImport = ref(false)
const importError = ref(null)
const parsedHistory = ref([])
const parsedSummary = ref(null)
const importForm = ref({ scenario: '', strategy: '', modelName: 'Geïmporteerd', network: 'Hasselt XL' })

// File Upload & Parse Handlers
const handleFileUpload = (event) => {
  const file = event.target.files?.[0] || event.dataTransfer?.files?.[0]
  if (!file) return

  if (!file.name.endsWith('.csv')) {
    importError.value = 'Het geselecteerde bestand is geen CSV-bestand. Upload a.b.b. een .csv.'
    return
  }

  isParsing.value = true
  importError.value = null

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const text = e.target.result
      parseAndValidateCsv(text, file.name)
    } catch (err) {
      console.error(err)
      importError.value = err.message || 'Er is een fout opgetreden bij het lezen van het bestand.'
      isParsing.value = false
    }
  }
  reader.onerror = () => {
    importError.value = 'Fout bij het lezen van het bestand.'
    isParsing.value = false
  }
  reader.readAsText(file)
}

const parseAndValidateCsv = (text, filename) => {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length < 2) {
    throw new Error('Het bestand is leeg of bevat geen dataregels.')
  }

  const rawHeaders = lines[0].split(',')
  const headers = rawHeaders.map(h => h.trim().replace(/^["']|["']$/g, ''))

  const findColIndex = (abbr, dutchLabel = '', englishLabel = '') => {
    return headers.findIndex(h => {
      const cleanH = h.toLowerCase()
      const cleanAbbr = abbr.toLowerCase()
      if (cleanH === cleanAbbr || cleanH.includes(cleanAbbr)) return true
      if (dutchLabel && cleanH.includes(dutchLabel.toLowerCase())) return true
      if (englishLabel && cleanH.includes(englishLabel.toLowerCase())) return true
      return false
    })
  }

  const timeIdx = findColIndex('Time', 'tijd', 'time')
  const tnrIdx = findColIndex('TNR', 'negative reward', 'negative reward')
  const tawtIdx = findColIndex('TAWT', 'accum', 'accum')
  const ewpcIdx = findColIndex('EWPC', 'car', 'car')
  const aqlIdx = findColIndex('AQL', 'wachtrij', 'queue')
  const avgvIdx = findColIndex('AvgV', 'snelheid', 'speed')
  const awtIdx = findColIndex('AWT', 'wachttijd', 'waiting_time')
  const countIdx = findColIndex('Count', 'voertuigen', 'vehicle_count')
  const tpIdx = findColIndex('TP', 'doorvoer', 'throughput')
  const dlyIdx = findColIndex('DLY', 'vertraging', 'delay')
  const prsIdx = findColIndex('PRS', 'druk', 'pressure')
  const tttIdx = findColIndex('TTT', 'reistijd', 'travel_time')
  const nqlIdx = findColIndex('NQL', 'genorm', 'norm')
  const jfiIdx = findColIndex('JFI', 'eerlijkheid', 'fairness')
  const ratIdx = findColIndex('RAT', 'ratio', 'ratio')

  const missingCols = []
  if (timeIdx === -1) missingCols.push('Time')
  if (avgvIdx === -1) missingCols.push('AvgV (Gemiddelde Snelheid)')
  if (awtIdx === -1) missingCols.push('AWT (Gemiddelde Wachttijd)')
  if (aqlIdx === -1) missingCols.push('AQL (Gemiddelde Wachtrij)')
  if (tpIdx === -1) missingCols.push('TP (Doorvoer)')

  if (missingCols.length > 0) {
    throw new Error(`Essentiële kolommen ontbreken in de CSV-kopregel: ${missingCols.join(', ')}. Dit bestand heeft een ongeldige structuur.`)
  }

  const history = []

  for (let i = 1; i < lines.length; i++) {
    const rawRow = lines[i].split(',')
    if (rawRow.length !== rawHeaders.length) {
      continue
    }

    const row = rawRow.map(v => v.trim().replace(/^["']|["']$/g, ''))

    const parseVal = (idx, fallback = 0) => {
      if (idx === -1 || idx >= row.length) return fallback
      const parsed = parseFloat(row[idx])
      return isNaN(parsed) ? fallback : parsed
    }

    const point = {
      time: parseVal(timeIdx),
      tnr: parseVal(tnrIdx),
      tawt: parseVal(tawtIdx),
      ewpc: parseVal(ewpcIdx),
      aql: parseVal(aqlIdx),
      avg_speed: parseVal(avgvIdx),
      avg_waiting_time: parseVal(awtIdx),
      vehicle_count: parseVal(countIdx),
      throughput: parseVal(tpIdx),
      intersection_delay: parseVal(dlyIdx),
      pressure: parseVal(prsIdx),
      ttt: parseVal(tttIdx),
      nql: parseVal(nqlIdx),
      fairness: parseVal(jfiIdx),
      tp_delay_ratio: parseVal(ratIdx),
      teleports: 0
    }

    const teleportsIdx = findColIndex('teleport')
    if (teleportsIdx !== -1) {
      point.teleports = parseVal(teleportsIdx)
    }

    history.push(point)
  }

  if (history.length === 0) {
    throw new Error('Geen geldige data-rijen gevonden in de CSV.')
  }

  const totalSteps = history.length
  let sumQueue = 0
  let sumWait = 0
  let sumSpeed = 0
  let maxTeleports = 0
  let totalThroughput = 0
  let maxTotalVehicles = 0

  history.forEach(point => {
    sumQueue += (point.aql ?? point.avg_queue ?? 0)
    sumWait += (point.ewpc ?? point.avg_waiting_time ?? 0)
    sumSpeed += (point.avg_speed ?? 0)
    maxTeleports = Math.max(maxTeleports, point.teleports ?? 0)
    totalThroughput = Math.max(totalThroughput, point.throughput ?? 0)
    maxTotalVehicles = Math.max(maxTotalVehicles, point.vehicle_count ?? point.total_vehicles ?? 0)
  })

  const avgQueue = sumQueue / totalSteps
  const avgWait = sumWait / totalSteps
  const avgSpeed = (sumSpeed / totalSteps) * 3.6

  parsedHistory.value = history
  parsedSummary.value = {
    avgQueue,
    avgWait,
    avgSpeed,
    teleports: Math.round(maxTeleports),
    throughput: Math.round(totalThroughput),
    totalVehicles: Math.max(Math.round(maxTotalVehicles), Math.round(totalThroughput)),
    totalSteps
  }

  let defaultScenario = filename.replace(/\.[^/.]+$/, "")
  defaultScenario = defaultScenario.replace(/^traffic_kpis_/, "")
  defaultScenario = defaultScenario.replace(/_/g, " ")
  defaultScenario = defaultScenario.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  let defaultStrategy = 'Geïmporteerde Simulatie'
  if (filename.toLowerCase().includes('ai') || filename.toLowerCase().includes('sam')) {
    defaultStrategy = 'AI Adaptief (SAM)'
  } else if (filename.toLowerCase().includes('baseline') || filename.toLowerCase().includes('fixed')) {
    defaultStrategy = 'Baseline (Fixed)'
  }

  importForm.value = {
    scenario: defaultScenario,
    strategy: defaultStrategy,
    modelName: filename.toLowerCase().includes('ai') ? 'SAM Model' : 'N/A',
    network: 'Hasselt XL'
  }

  isParsing.value = false
}

const saveImportedSimulation = async () => {
  if (!parsedSummary.value || parsedHistory.value.length === 0) return

  isSavingImport.value = true
  try {
    const result = {
      strategy: importForm.value.strategy,
      model_name: importForm.value.modelName,
      scenario: importForm.value.scenario,
      network: importForm.value.network,
      avg_queue: parsedSummary.value.avgQueue,
      avg_speed: parsedSummary.value.avgSpeed,
      avg_wait_time: parsedSummary.value.avgWait,
      teleports: parsedSummary.value.teleports,
      throughput: parsedSummary.value.throughput,
      total_vehicles: parsedSummary.value.totalVehicles,
      total_steps: parsedSummary.value.totalSteps,
      data_points: JSON.stringify(parsedHistory.value)
    }

    await simulationService.saveResult(result)
    cancelImport()
    emit('imported')
  } catch (err) {
    console.error('Import opslaan mislukt:', err)
    alert('Fout bij het importeren van de simulatie: ' + err.message)
  } finally {
    isSavingImport.value = false
  }
}

const cancelImport = () => {
  parsedHistory.value = []
  parsedSummary.value = null
  importError.value = null
  isParsing.value = false
  isDragging.value = false
  importForm.value = { scenario: '', strategy: '', modelName: 'Geïmporteerd', network: 'Hasselt XL' }
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const onDragOver = (e) => {
  e.preventDefault()
  isDragging.value = true
}

const onDragLeave = () => {
  isDragging.value = false
}

const onDrop = (e) => {
  e.preventDefault()
  isDragging.value = false
  handleFileUpload(e)
}

const triggerFileInput = () => {
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  fileInput.value?.click()
}
</script>

<template>
  <div class="card border-0 shadow-sm mb-4 animate-fade-in">
    <div class="card-header bg-white border-bottom p-3">
      <h6 class="mb-0 fw-bold d-flex align-items-center gap-2">
        <Upload size="18" class="text-primary" />
        Simulatie Importeren
      </h6>
    </div>
    <div class="card-body p-3">
      <!-- 1. Drag & Drop Area / Dropzone -->
      <div 
        v-if="!parsedSummary && !importError && !isParsing"
        class="dropzone d-flex flex-column align-items-center justify-content-center p-4 text-center cursor-pointer transition-all border-dashed rounded"
        :class="{ 'dropzone-active bg-primary-subtle border-primary': isDragging }"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
        @click="triggerFileInput"
      >
        <Upload size="32" class="text-muted mb-2 transition-all upload-icon" />
        <p class="mb-1 fw-semibold text-dark">Sleep een geëxporteerd CSV-bestand hierheen</p>
        <p class="text-muted small mb-0">of klik om te bladeren</p>
        <input 
          type="file" 
          ref="fileInput" 
          class="d-none" 
          accept=".csv" 
          @change="handleFileUpload" 
        />
      </div>

      <!-- 2. Loading State -->
      <div v-else-if="isParsing" class="p-4 text-center">
        <div class="spinner-border text-primary spinner-border-sm mb-2" role="status"></div>
        <p class="text-muted small mb-0">Bestand analyseren...</p>
      </div>

      <!-- 3. Error State -->
      <div v-else-if="importError" class="alert alert-danger border-0 p-3 mb-0">
        <div class="d-flex align-items-start gap-2 mb-2">
          <AlertTriangle size="18" class="text-danger flex-shrink-0 mt-1" />
          <div>
            <h6 class="alert-heading fw-bold mb-1" style="font-size: 0.9rem;">Validatiefout</h6>
            <p class="small mb-0 text-secondary">{{ importError }}</p>
          </div>
        </div>
        <div class="d-flex gap-2 justify-content-end mt-3">
          <button @click="cancelImport" class="btn btn-sm btn-outline-secondary px-3">Annuleren</button>
          <button @click="triggerFileInput" class="btn btn-sm btn-danger px-3">Kies ander bestand</button>
        </div>
      </div>

      <!-- 4. Success State & Metadata form -->
      <div v-else-if="parsedSummary" class="import-preview animate-fade-in">
        <div class="alert alert-success bg-success-subtle border-0 p-3 d-flex align-items-start gap-2 mb-3">
          <CheckCircle2 size="18" class="text-success flex-shrink-0 mt-0" />
          <div>
            <h6 class="alert-heading fw-bold mb-0 text-success" style="font-size: 0.9rem;">
              Bestand gevalideerd ({{ parsedSummary.totalSteps }} datapunten)
            </h6>
          </div>
        </div>

        <!-- Stats Preview Grid -->
        <div class="grid-stats mb-3 bg-light rounded p-2" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
          <div class="stat-item bg-white p-2 rounded shadow-sm">
            <div class="stat-label" style="font-size: 0.6rem; color: #888;">Avg Queue</div>
            <div class="stat-value text-dark fw-bold" style="font-size: 0.9rem;">
              {{ parsedSummary.avgQueue.toFixed(2) }} <small class="text-muted" style="font-size: 0.65rem;">veh</small>
            </div>
          </div>
          <div class="stat-item bg-white p-2 rounded shadow-sm">
            <div class="stat-label" style="font-size: 0.6rem; color: #888;">Avg Speed</div>
            <div class="stat-value text-dark fw-bold" style="font-size: 0.9rem;">
              {{ parsedSummary.avgSpeed.toFixed(1) }} <small class="text-muted" style="font-size: 0.65rem;">km/h</small>
            </div>
          </div>
          <div class="stat-item bg-white p-2 rounded shadow-sm">
            <div class="stat-label" style="font-size: 0.6rem; color: #888;">Avg Wait Time</div>
            <div class="stat-value text-dark fw-bold" style="font-size: 0.9rem;">
              {{ parsedSummary.avgWait.toFixed(1) }} <small class="text-muted" style="font-size: 0.65rem;">s</small>
            </div>
          </div>
          <div class="stat-item bg-white p-2 rounded shadow-sm">
            <div class="stat-label" style="font-size: 0.6rem; color: #888;">Throughput</div>
            <div class="stat-value text-dark fw-bold" style="font-size: 0.9rem;">
              {{ parsedSummary.throughput }} <small class="text-muted" style="font-size: 0.65rem;">veh</small>
            </div>
          </div>
        </div>

        <!-- Meta input Form -->
        <div class="mb-3">
          <label class="form-label small fw-bold text-muted mb-1">Scenario</label>
          <input 
            type="text" 
            v-model="importForm.scenario" 
            class="form-control form-control-sm border-light shadow-sm bg-light"
            placeholder="Bijv. Rush Hour"
            required
          />
        </div>

        <div class="mb-3">
          <label class="form-label small fw-bold text-muted mb-1">Strategie</label>
          <input 
            type="text" 
            v-model="importForm.strategy" 
            class="form-control form-control-sm border-light shadow-sm bg-light"
            placeholder="Bijv. AI Adaptief of Baseline"
            required
          />
        </div>

        <div class="row g-2 mb-3">
          <div class="col-6">
            <label class="form-label small fw-bold text-muted mb-1">Modelnaam</label>
            <input 
              type="text" 
              v-model="importForm.modelName" 
              class="form-control form-control-sm border-light shadow-sm bg-light"
            />
          </div>
          <div class="col-6">
            <label class="form-label small fw-bold text-muted mb-1">Netwerk</label>
            <input 
              type="text" 
              v-model="importForm.network" 
              class="form-control form-control-sm border-light shadow-sm bg-light"
            />
          </div>
        </div>

        <div class="d-flex gap-2 justify-content-end mt-3">
          <button 
            @click="cancelImport" 
            class="btn btn-sm btn-outline-secondary px-3"
            :disabled="isSavingImport"
          >
            Annuleren
          </button>
          <button 
            @click="saveImportedSimulation" 
            class="btn btn-sm btn-primary px-3 fw-bold d-flex align-items-center gap-1"
            :disabled="isSavingImport"
          >
            <div v-if="isSavingImport" class="spinner-border spinner-border-sm" role="status"></div>
            {{ isSavingImport ? 'Importeren...' : 'Toevoegen' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* CSV Dropzone & Import Styling */
.dropzone {
  border: 2px dashed #dee2e6;
  background-color: #f8f9fa;
  min-height: 140px;
  transition: all 0.2s ease-in-out;
}

.dropzone:hover {
  border-color: #0d6efd;
  background-color: #f0f7ff;
}

.dropzone:hover .upload-icon {
  color: #0d6efd !important;
  transform: translateY(-2px);
}

.dropzone-active {
  border-color: #0d6efd !important;
  background-color: #e0f0ff !important;
}

.cursor-pointer {
  cursor: pointer;
}

.border-dashed {
  border-style: dashed !important;
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.bg-primary-subtle { background-color: rgba(13, 110, 253, 0.1); }
.bg-success-subtle { background-color: rgba(25, 135, 84, 0.1); }
</style>
