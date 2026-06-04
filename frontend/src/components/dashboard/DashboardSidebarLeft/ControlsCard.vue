<template>
  <div class="card shadow-sm border-0 flex-grow-1">
    <div class="card-body d-flex flex-column">
      <h6 class="fw-bold mb-4 d-flex align-items-center gap-2 text-primary">
        <SettingsIcon :size="18" /> Besturing
      </h6>

      <div class="mb-4">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <label class="form-label small mb-0 fw-bold">Simulatiesnelheid</label>
          <span class="badge text-primary bg-light">{{ localSpeedLabel }}</span>
        </div>
        <input type="range" class="form-range" min="0" max="99" v-model.number="localDelaySlider" @change="updateDelay">
      </div>

      <div class="mt-auto d-flex flex-column gap-2">
        <!-- 1. Start Button: Shown only if not active at all -->
        <button
          v-if="!hasUserStarted && !isStarting"
          class="btn btn-success fw-bold py-2 shadow-sm"
          @click="handleStart"
        >
          ▶ Start Simulatie
        </button>

        <!-- 2. Loading State: Shown if user started but bridge or backend is still preparing -->
        <button
          v-else-if="isStarting || (sumoState && sumoState.simulationStatus === 'loading')"
          disabled
          class="btn btn-primary opacity-50 fw-bold py-2 d-flex align-items-center justify-content-center gap-2"
        >
          <span class="spinner-border spinner-border-sm" role="status"></span>
          {{ isStarting ? 'Laden...' : 'Systeem voorbereiden...' }}
        </button>

        <!-- 3. Active State Controls: Pause/Resume/Stop -->
        <template v-else-if="hasUserStarted && sumoState && ['running', 'paused'].includes(sumoState.simulationStatus)">
          <div class="d-flex flex-column gap-2">
            <button
              v-if="sumoState.simulationStatus === 'running'"
              class="btn btn-warning fw-bold py-2 shadow-sm"
              @click="handlePause"
            >
              ⏸ Pauzeer Simulatie
            </button>
            <button
              v-else
              class="btn btn-success fw-bold py-2 shadow-sm"
              @click="handleStart"
            >
              ▶ Hervat Simulatie
            </button>

            <button
              class="btn btn-outline-danger fw-bold py-2"
              @click="sumoActions.cancelSimulation()"
            >
              ⏹ Stop Simulatie
            </button>
          </div>
        </template>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Settings as SettingsIcon, AlertCircle } from 'lucide-vue-next'
import { sumoState, sumoActions, isStarting, hasUserStarted, selectedScenario, handleStartSimulation } from '@/composables/useSumoBridge'

// Delay MS slider (0 = slow, 99 = fast)
const MAX_DELAY_MS = 300
const localDelaySlider = ref(50)

watch(() => sumoState.value?.delayMs, (newDelay) => {
  if (newDelay !== undefined) {
    localDelaySlider.value = Math.round((1 - newDelay / MAX_DELAY_MS) * 99)
  }
})

const localSpeedLabel = computed(() => {
  if (localDelaySlider.value > 80) return 'Fast'
  if (localDelaySlider.value < 20) return 'Slow'
  return '1x'
})

function updateDelay() {
  const ms = (1 - localDelaySlider.value / 99) * MAX_DELAY_MS
  sumoActions.changeDelay(ms)
}

function handleStart() {
  handleStartSimulation()
}

function handlePause() {
  sumoActions.pauseSimulation()
}
</script>
