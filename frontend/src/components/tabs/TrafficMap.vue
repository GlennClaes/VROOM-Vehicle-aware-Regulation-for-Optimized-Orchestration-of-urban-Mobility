<template>
  <div class="card border-0 shadow-sm overflow-hidden" style="min-height: 500px;">
    <div class="p-3 border-bottom bg-white d-flex justify-content-between align-items-center">
      <div class="d-flex align-items-center gap-3">
        <h6 class="mb-0 fw-bold text-dark">Live Verkeerskaart</h6>
        <VehicleCounter v-if="effectiveIsRunning && !showLoadingOverlay" />
      </div>
      <div class="d-flex align-items-center gap-2">
        <button 
          v-if="!effectiveIsRunning && kpiHistory && kpiHistory.length > 0" 
          @click="handleSaveResult" 
          class="btn btn-sm btn-outline-primary d-flex align-items-center gap-1 fw-bold"
          :disabled="isSaving"
          title="Resultaten nu opslaan"
        >
          <div v-if="isSaving" class="spinner-border spinner-border-sm" role="status"></div>
          <Save v-else size="14" /> {{ isSaving ? 'Bezig...' : 'Opslaan' }}
        </button>
        <FullscreenButton v-if="effectiveIsRunning && !showLoadingOverlay" @toggle="toggleFullscreen" :isFullscreen="isFullscreen" />
        <span class="badge bg-light text-dark border">{{ runId || 'Geen actieve run' }}</span>
      </div>
    </div>

    <!--
      DEFINITION OF ABSOLUTE STABILITY:
      1. No reactive classes (:class) on the container.
      2. No v-if inside the container for stable elements (iframe).
      3. Using v-show for overlays instead of v-if to avoid DOM tree mutations.
      4. The close button is ALWAYS in the DOM, just CSS-hidden when not in fullscreen.
    -->
    <div
      class="card-body p-0 position-relative map-stable-container"
      ref="fullscreenContainer"
      id="traffic-map-root"
      style="height: 620px; background-color: #f8f9fa;"
    >
      <!-- Simulation Not Running Placeholder (v-show to keep DOM stable) -->
      <div v-show="!effectiveIsRunning" class="position-absolute top-0 start-0 w-100 h-100 flex-column align-items-center justify-content-center bg-light text-center p-4 overlay-centered" style="z-index: 20;">
        <div v-if="hasFinished" class="bg-white rounded shadow-lg p-5 mb-4 animate-fade-in" style="max-width: 450px;">
          <div class="text-success mb-3"><CheckCircle :size="64" /></div>
          <h4 class="fw-bold text-dark mb-2">Simulatie Voltooid</h4>
          <p class="text-muted mb-4 small">
            De simulatie is succesvol afgerond. U kunt de resultaten nu opslaan in de modelvergelijking om deze later te analyseren.
          </p>
          <div class="d-flex gap-2 justify-content-center">
            <button
              @click="handleSaveResult"
              class="btn btn-primary fw-bold px-4 py-2 d-flex align-items-center gap-2 shadow-sm"
              :disabled="isSaving"
            >
              <Save v-if="!isSaving" :size="18" />
              <div v-else class="spinner-border spinner-border-sm" role="status"></div>
              {{ isSaving ? 'Opslaan...' : 'Opslaan in modelvergelijking' }}
            </button>
            <button
              @click="handleStartSimulation"
              class="btn btn-outline-secondary fw-bold px-4 py-2 shadow-sm"
            >
              Opnieuw Starten
            </button>
          </div>
        </div>

        <div v-else class="d-flex flex-column align-items-center">
          <div class="bg-white rounded-circle shadow-sm p-4 mb-4" style="width: 120px; height: 120px; display: flex; align-items: center; justify-content: center;">
            <Play :size="48" class="text-success ms-1" />
          </div>
          <h5 class="fw-bold text-dark mb-2">Simulatie stand-by</h5>
          <p class="text-muted mb-4" style="max-width: 300px;">
            Kies een scenario in de zijbalk en klik op de knop hieronder om te beginnen.
          </p>
          <button
            @click="handleStartSimulation"
            class="btn btn-success fw-bold px-4 py-2 d-flex align-items-center gap-2 shadow-sm"
          >
            <Play :size="18" fill="currentColor" />
            Start Simulatie
          </button>
        </div>
      </div>

      <!-- Loading overlay (v-show to keep DOM stable) -->
      <div v-show="showLoadingOverlay" class="position-absolute top-0 start-0 w-100 h-100 flex-column align-items-center justify-content-center bg-white overlay-centered" style="z-index: 10;">
        <div class="spinner-border text-primary mb-3" role="status" style="width: 3.5rem; height: 3.5rem; border-width: 0.3rem;"></div>
        <p class="text-muted fw-bold">Verkeerskaart laden...</p>
      </div>

      <!-- Active Scenario Overlay (v-show to keep DOM stable) -->
      <div v-show="effectiveIsRunning && !showLoadingOverlay && activeScenarioDetails"
           class="position-absolute m-3 px-3 py-2 bg-white rounded shadow border-0 overlay-scen"
           style="top: 0; right: 0; z-index: 5; transition: all 0.3s ease;">
        <div class="d-flex align-items-center gap-3">
          <div class="bg-primary bg-opacity-10 p-2 rounded d-flex align-items-center justify-content-center text-primary">
            <MapPin size="20" />
          </div>
          <div>
            <div class="text-muted" style="font-size: 0.65rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Actief Scenario</div>
            <div class="fw-bold text-dark" style="font-size: 0.95rem; line-height: 1.2;">{{ activeScenarioDetails?.displayName }}</div>
            <div class="vr mx-1"></div>
            <div>
              <div class="text-muted" style="font-size: 0.65rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Strategie</div>
              <div class="fw-bold" :class="selectedStrategy === 'sam' ? 'text-info' : 'text-success'" style="font-size: 0.95rem; line-height: 1.2;">
                {{ selectedStrategy === 'sam' ? 'SAM Model' : 'Baseline' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <iframe
        ref="mapFrame"
        :src="mapFrameUrl"
        style="width: 100%; height: 100%; border: none; display: block; z-index: 1;"
        allow="accelerometer; autoplay"
      />

      <!--
        Close button: ALWAYS IN DOM.
        Visibility is controlled purely by the CSS :fullscreen selector below.
      -->
      <button
        @click="toggleFullscreen"
        class="btn btn-light shadow fullscreen-close-btn"
      >
        <Minimize size="20" />
        <span class="d-none d-sm-inline">Sluiten (Esc)</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Play, MapPin, Minimize, Save, CheckCircle } from 'lucide-vue-next'
import { simulationService } from '@/services/simulationService'
import VehicleCounter from '@/components/traffic/VehicleCounter.vue'
import FullscreenButton from '@/components/traffic/FullscreenButton.vue'
import {
  sumoState,
  isStarting,
  isReloading,
  hasUserStarted,
  sumoActions,
  bindMapFrame,
  initSumoBridge,
  destroySumoBridge,
  selectedScenario,
  availableScenarios,
  selectedStrategy,
  selectedSamModel,
  handleStartSimulation,
  kpiHistory
} from '../../composables/useSumoBridge'

defineProps(['runId'])

const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
const mapFrameUrl = computed(() => '/map/?iframe=true')
const mapInitialized = ref(false)

// ── Fullscreen & Vision State ──
const isFullscreen = ref(false)
const fullscreenContainer = ref(null)

const toggleFullscreen = () => {
  if (!isFullscreen.value) {
    if (fullscreenContainer.value?.requestFullscreen) {
      fullscreenContainer.value.requestFullscreen().catch(err => {
        console.error(`Fullscreen error: ${err.message}`)
      })
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen()
    }
  }
}

const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
  // NO DELAYS NEEDED: ResizeObserver handles synchronization instantly and fluidly
}

// ── Simulation state ──
const effectiveIsRunning = computed(() => {
  if (!hasUserStarted.value && !isStarting.value && !isReloading.value) return false
  return isStarting.value ||
         isReloading.value ||
         sumoState.value?.simulationStatus === 'loading' ||
         sumoState.value?.simulationStatus === 'running' ||
         sumoState.value?.simulationStatus === 'paused'
})

const isSaving = ref(false)
const hasFinished = ref(false)

// Track if a simulation was actually running before it stopped
watch(effectiveIsRunning, (isRunning, wasRunning) => {
  // We transitioned from running to not running
  if (wasRunning && !isRunning) {
    if (kpiHistory.value && kpiHistory.value.length > 0) {
      console.log("[TrafficMap] Simulation stopped with data. Showing save option.")
      hasFinished.value = true
    }
  }
  
  // Also show if we have data and we are in standby
  if (!isRunning && kpiHistory.value && kpiHistory.value.length > 0) {
    hasFinished.value = true
  }

  // Reset when starting a new one
  if (isRunning) {
    hasFinished.value = false
  }
})

const handleSaveResult = async () => {
  const history = kpiHistory.value || []
  if (history.length === 0) {
    alert('Geen data om op te slaan.')
    return
  }

  // Bereken gemiddelden over de hele geschiedenis
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
    // Throughput is vaak cumulatief, dus we pakken de laatste waarde later, 
    // of we sommeren als het per stap is. In onze bridge is het cumulatief.
    totalThroughput = Math.max(totalThroughput, point.throughput ?? 0)
    maxTotalVehicles = Math.max(maxTotalVehicles, point.total_vehicles ?? 0)
  })

  const avgQueue = sumQueue / totalSteps
  const avgWait = sumWait / totalSteps
  const avgSpeed = (sumSpeed / totalSteps) * 3.6 // Convert m/s to km/h
  
  isSaving.value = true
  try {
    const result = {
      strategy: selectedStrategy.value === 'sam' ? 'AI Adaptief (SAM)' : 'Baseline (Fixed)',
      model_name: selectedStrategy.value === 'sam' ? (selectedSamModel.value || 'Default Model') : 'N/A',
      scenario: activeScenarioDetails.value?.displayName || selectedScenario.value || 'Normal Traffic (Default)',
      network: activeScenarioDetails.value?.network || 'Hasselt XL',
      avg_queue: avgQueue,
      avg_speed: avgSpeed,
      avg_wait_time: avgWait,
      teleports: Math.round(maxTeleports),
      throughput: Math.round(totalThroughput),
      total_vehicles: Math.max(Math.round(maxTotalVehicles), Math.round(totalThroughput)), // Failsafe
      total_steps: totalSteps,
      data_points: JSON.stringify(history)
    }
    
    await simulationService.saveResult(result)
    alert('Simulatie succesvol opgeslagen in Modelvergelijking!')
    hasFinished.value = false
  } catch (err) {
    console.error('Opslaan mislukt:', err)
    alert('Fout bij het opslaan: ' + err.message)
  } finally {
    isSaving.value = false
  }
}

const handleEscape = (e) => {
  if (e.key === 'Escape' && isFullscreen.value) {
    // If we're logically in fullscreen but the browser exited (Esc key)
    if (!document.fullscreenElement) {
      isFullscreen.value = false
    }
  }
}

const showLoadingOverlay = computed(() => {
  // Show loading if reloading scenario
  if (isReloading.value) return true
  
  // If we are starting, wait for the map to be ready AND the first SUBSTANTIAL state update (time > 0)
  if (isStarting.value) {
    const hasData = sumoState.value && sumoState.value.stats && sumoState.value.stats.time > 0
    return !mapInitialized.value || !hasData
  }
  
  // Default: hide overlay if standing by
  return false
})

const activeScenarioDetails = computed(() => {
  if (!selectedScenario.value) return null
  const found = availableScenarios.value.find(s => s.kebabCase === selectedScenario.value)
  return found || { displayName: selectedScenario.value }
})

watch(isReloading, (newReloading) => {
  if (newReloading) {
    mapInitialized.value = false
  }
})

function onMessage(event) {
  // Relaxed origin check
  const origin = event.origin || ''
  // Allow same-origin or explicit dev port 3000
  const isSameOrigin = origin === window.location.origin || origin === window.location.origin.replace(/\/$/, '')
  if (!origin.includes(':3000') && !isSameOrigin) return

  const data = event.data
  const isMapReady = data === 'map-ready' || data?.type === 'map-ready'

  if (isMapReady) {
    mapInitialized.value = true
    isReloading.value = false
  }
}

let fallbackTimer = null

const mapFrame = ref(null)

onMounted(() => {
  initSumoBridge()
  if (mapFrame.value) {
    bindMapFrame(mapFrame.value)
  }
  window.addEventListener('message', onMessage)
  document.addEventListener('keydown', handleEscape)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
  fallbackTimer = setTimeout(() => {
    console.log("[MAP] Fallback: manual map-ready trigger")
    mapInitialized.value = true
  }, 10000) // Reduced to 10s for better responsiveness
})

onUnmounted(() => {
  destroySumoBridge()
  bindMapFrame(null) // Clear reference
  window.removeEventListener('message', onMessage)
  document.removeEventListener('keydown', handleEscape)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
  clearTimeout(fallbackTimer)
})
</script>

<style scoped>
.map-stable-container {
  height: 620px;
  background: #f8f9fa;
  width: 100%;
}

/*
   THE ZERO-MUTATION SECRET:
   The close button is always in the DOM but hidden by default.
   We only show it when the browser is natively in fullscreen mode.
   This prevents any DOM tree modification during the transition.
*/
.fullscreen-close-btn {
  display: none !important;
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  border-radius: 8px;
  font-weight: 500;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.map-stable-container:fullscreen {
  height: 100vh !important;
  width: 100vw !important;
  background: #000 !important;
  max-width: none !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}

.overlay-centered {
  display: flex;
}

.overlay-scen {
  display: flex;
}

.bg-primary-subtle { background-color: rgba(13, 110, 253, 0.1); }
.bg-success-subtle { background-color: rgba(25, 135, 84, 0.1); }

.map-stable-container:fullscreen .fullscreen-close-btn {
  display: flex !important;
}
</style>
