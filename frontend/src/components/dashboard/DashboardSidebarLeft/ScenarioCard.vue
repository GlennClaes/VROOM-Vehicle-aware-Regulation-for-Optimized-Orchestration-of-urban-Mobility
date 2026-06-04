<template>
  <div class="card shadow-sm border-0">
    <div class="card-body">
      <h6 class="fw-bold mb-3 d-flex align-items-center gap-2 text-primary">
        <MapPin :size="18" /> Scenario's
      </h6>
      <p class="small text-muted mb-2">Kies een verkeersscenario om de simulatie te starten</p>
      <div>
        <label class="form-label small mb-1">Selecteer Scenario</label>
        <div v-if="loadingScenarios" class="d-flex align-items-center gap-2 py-1">
          <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
          <span class="small text-muted">Scenario's laden...</span>
        </div>
        <select
          v-else
          class="form-select form-select-sm bg-light border-0"
          v-model="selectedScenario"
          :disabled="hasUserStarted"
        >
          <option disabled value="">Kies een scenario...</option>
          <option v-for="s in availableScenarios" :key="s.kebabCase" :value="s.kebabCase">
            {{ s.displayName }}
          </option>
        </select>
        <div 
          v-if="!selectedScenario && !loadingScenarios" 
          class="small mt-1 transition-all"
          :class="{ 'text-danger fw-bold animate-flash': showScenarioError, 'text-warning': !showScenarioError }"
        >
          ⚠ Selecteer een scenario om te starten
        </div>

        <div v-if="selectedScenario" class="mt-3">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <label class="form-label small mb-0">Configuratie / Preset</label>
            <button 
              v-if="!showNewPresetForm"
              class="btn btn-link btn-sm p-0 text-decoration-none x-small"
              @click="showNewPresetForm = true"
              :disabled="hasUserStarted"
            >
              + Nieuwe
            </button>
            <button 
              v-else
              class="btn btn-link btn-sm p-0 text-decoration-none x-small text-danger"
              @click="showNewPresetForm = false"
            >
              Annuleer
            </button>
          </div>

          <!-- New Preset Form -->
          <div v-if="showNewPresetForm" class="p-2 bg-light rounded border mb-2">
            <input 
              v-model="newPresetName" 
              type="text" 
              class="form-control form-control-sm mb-2" 
              placeholder="Naam configuratie..."
              @keyup.enter="handleCreatePreset"
              ref="newPresetInput"
            >
            <button 
              class="btn btn-primary btn-sm w-100" 
              @click="handleCreatePreset"
              :disabled="!newPresetName.trim() || isCreatingPreset"
            >
              <span v-if="isCreatingPreset" class="spinner-border spinner-border-sm me-1"></span>
              Opslaan
            </button>
          </div>

          <div v-if="!showNewPresetForm">
            <div v-if="currentPresets.length > 0" class="d-flex gap-2">
              <select
                class="form-select form-select-sm bg-light border-0"
                v-model="selectedPresetId"
                @change="sumoActions.applyPreset(selectedPresetId)"
                :disabled="hasUserStarted"
              >
                <option disabled value="">Selecteer een preset...</option>
                <option v-for="p in currentPresets" :key="p.id" :value="p.id">
                  {{ p.name }}
                </option>
              </select>
            <button 
              v-if="selectedPresetId && !hasUserStarted"
              class="btn btn-sm px-2 transition-all"
              :class="isConfirmingDelete ? 'btn-danger pulse' : 'btn-outline-danger'"
              :title="isConfirmingDelete ? 'Klik nogmaals om te bevestigen' : 'Verwijder preset'"
              @click="handleDeletePreset"
            >
              <Trash2 v-if="!isConfirmingDelete" size="14" />
              <span v-else class="x-small fw-bold">Zeker?</span>
            </button>
            </div>
            <div v-else class="p-2 border border-dashed rounded text-center bg-light">
              <p class="x-small text-muted mb-0">Geen opgeslagen configuraties.</p>
              <button 
                class="btn btn-link btn-sm p-0 x-small" 
                @click="showNewPresetForm = true"
                :disabled="hasUserStarted"
              >
                Maak je eerste preset
              </button>
            </div>
          </div>
          
          <p v-if="currentPresets.length > 0" class="x-small text-muted mt-1 mb-0">Presets laden automatisch de opgeslagen strategie en interval.</p>
        </div>



      </div>
    </div>
  </div>
</template>


<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { MapPin, Trash2 } from 'lucide-vue-next'
import { sumoState, selectedScenario, availableScenarios, hasUserStarted, mapFrameRef, showScenarioError, selectedPresetId, sumoActions, currentPresets } from '@/composables/useSumoBridge'

const loadingScenarios = ref(false)
const showNewPresetForm = ref(false)
const newPresetName = ref('')
const isCreatingPreset = ref(false)
const isConfirmingDelete = ref(false)
const newPresetInput = ref(null)


watch(showNewPresetForm, (val) => {
  if (val) {
    newPresetName.value = ''
    setTimeout(() => newPresetInput.value?.focus(), 100)
  }
})

async function handleCreatePreset() {
  if (!newPresetName.value.trim()) return
  
  isCreatingPreset.value = true
  try {
    const success = await sumoActions.createScenarioPreset(newPresetName.value.trim())
    if (success) {
      showNewPresetForm.value = false
    }
  } finally {
    isCreatingPreset.value = false
  }
}

async function handleDeletePreset() {
  if (!selectedPresetId.value) return
  
  if (!isConfirmingDelete.value) {
    isConfirmingDelete.value = true
    // Reset na 3 seconden als er niet nogmaals wordt geklikt
    setTimeout(() => {
      isConfirmingDelete.value = false
    }, 3000)
    return
  }
  
  await sumoActions.deleteScenarioPreset(selectedPresetId.value)
  isConfirmingDelete.value = false
}


async function fetchScenarios() {
  if (availableScenarios.value.length > 0) {
    loadingScenarios.value = false
    return
  }

  loadingScenarios.value = true
  try {
    const response = await fetch(`/map/scenarios`)
    
    if (!response.ok) throw new Error('Simulator nog niet gereed')
    
    const data = await response.json()
    if (Array.isArray(data) && data.length > 0) {
      availableScenarios.value = data
    } else {
      // Als de lijst leeg is, probeer over 2 seconden opnieuw
      setTimeout(fetchScenarios, 2000)
    }
  } catch (e) {
    console.warn('[SIDEBAR] Simulator nog aan het opstarten, retry over 2s...', e)
    setTimeout(fetchScenarios, 2000)
  } finally {
    loadingScenarios.value = false
  }
}

onMounted(() => {
  fetchScenarios()
})

// When state arrives from the map, sync selectedScenario if needed (only if user already started)
watch(() => sumoState.value?.scenario, (newScenario) => {
  if (newScenario && hasUserStarted.value) {
    selectedScenario.value = newScenario
  }
})

defineExpose({ loadingScenarios })
</script>

<style scoped>
.animate-flash {
  animation: flash 0.5s ease-in-out infinite alternate;
}

@keyframes flash {
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0.7; transform: scale(1.02); }
}

.transition-all {
  transition: all 0.3s ease;
}

.x-small {
  font-size: 0.7rem;
}

.border-dashed {
  border-style: dashed !important;
}

.pulse {
  animation: pulse-animation 1s infinite;
}

@keyframes pulse-animation {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.transition-all {
  transition: all 0.3s ease;
}
</style>


