<template>
  <div class="card shadow-sm border-0">
    <div class="card-body">
      <h6 class="fw-bold mb-3 d-flex align-items-center gap-2 text-primary">
        <BrainCircuit :size="18" /> Strategie
      </h6>
      <p class="small text-muted mb-3">Kies een verkeersregelstrategie om te vergelijken</p>

      <div class="d-flex gap-2" role="group" aria-label="Strategie selectie">
        <button
          id="strategy-btn-baseline"
          type="button"
          class="btn flex-fill strategy-btn"
          :class="selectedStrategy === 'baseline' ? 'strategy-btn-active' : 'strategy-btn-inactive'"
          :disabled="hasUserStarted"
          @click="selectStrategy('baseline')"
        >
          <div class="d-flex flex-column align-items-center gap-1 py-1">
            <Timer :size="20" />
            <span class="fw-bold" style="font-size: 0.85rem;">Baseline</span>
            <span class="text-muted" style="font-size: 0.65rem;">Vaste tijden</span>
          </div>
        </button>

        <button
          id="strategy-btn-sam"
          type="button"
          class="btn flex-fill strategy-btn"
          :class="selectedStrategy === 'sam' ? 'strategy-btn-active' : 'strategy-btn-inactive'"
          :disabled="hasUserStarted"
          @click="selectStrategy('sam')"
        >
          <div class="d-flex flex-column align-items-center gap-1 py-1">
            <BrainCircuit :size="20" />
            <span class="fw-bold" style="font-size: 0.85rem;">SAM Model</span>
            <span class="text-muted" style="font-size: 0.65rem;">AI-gestuurd</span>
          </div>
        </button>

      </div>

      <!-- Active strategy indicator -->
      <div class="mt-3 p-2 rounded d-flex align-items-center gap-2" :class="indicatorClass">
        <span class="badge rounded-pill" :class="badgeClass">{{ indicatorLabel }}</span>
        <span class="small">{{ indicatorDescription }}</span>
      </div>

      <!-- SAM Model Selection Dropdown -->
      <div v-if="selectedStrategy === 'sam'" class="mt-3">
        <label for="sam-model-select" class="form-label small fw-bold text-muted mb-1 d-flex align-items-center gap-1">
          <BrainCircuit :size="14" /> Kies AI Model:
        </label>
        <select
          id="sam-model-select"
          class="form-select form-select-sm premium-select"
          :value="selectedSamModel"
          :disabled="hasUserStarted"
          @change="e => sumoActions.changeSamModel(e.target.value)"
        >
          <option v-if="availableSamModels.length === 0" value="" disabled>Geen modellen gevonden</option>
          <option v-for="model in availableSamModels" :key="model.path" :value="model.name">
            {{ model.name }} ({{ model.size_kb }} KB)
          </option>
        </select>
        <div v-if="availableSamModels.length > 0" class="small text-muted mt-1" style="font-size: 0.7rem;">
          {{ availableSamModels.find(m => m.name === selectedSamModel)?.modified ? 'Laatst gewijzigd: ' + new Date(availableSamModels.find(m => m.name === selectedSamModel).modified).toLocaleDateString() : '' }}
        </div>
      </div>

      <div v-if="hasUserStarted" class="small text-muted mt-2 d-flex align-items-center gap-1">
        <Lock :size="12" />
        Stop de simulatie om van strategie te wisselen
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import { BrainCircuit, Timer, Lock } from 'lucide-vue-next'
import {
  selectedStrategy,
  hasUserStarted,
  sumoActions,
  selectedSamModel,
  availableSamModels
} from '@/composables/useSumoBridge'

function selectStrategy(strategy) {
  if (hasUserStarted.value) return
  sumoActions.changeStrategy(strategy)
}

onMounted(() => {
  if (selectedStrategy.value === 'sam') {
    sumoActions.fetchModels()
  }
})

watch(selectedStrategy, (newVal) => {
  if (newVal === 'sam' && availableSamModels.value.length === 0) {
    sumoActions.fetchModels()
  }
})

const indicatorClass = computed(() => {
  if (selectedStrategy.value === 'sam') return 'bg-info bg-opacity-10 text-info'
  return 'bg-success bg-opacity-10 text-success'
})

const badgeClass = computed(() => {
  if (selectedStrategy.value === 'sam') return 'bg-info'
  return 'bg-success'
})

const indicatorLabel = computed(() => {
  if (selectedStrategy.value === 'sam') return 'SAM'
  return 'Baseline'
})

const indicatorDescription = computed(() => {
  if (selectedStrategy.value === 'sam') return 'AI-model optimaliseert verkeerslichten'
  return 'Vaste tijdsintervallen voor verkeerslichten'
})
</script>

<style scoped>
.premium-select {
  border-radius: 0.5rem;
  border: 1px solid #dee2e6;
  background-color: #fff;
  font-size: 0.85rem;
  padding: 0.4rem 0.6rem;
  transition: all 0.2s ease;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);
}

.premium-select:focus {
  border-color: #0dcaf0;
  box-shadow: 0 0 0 0.25rem rgba(13, 202, 240, 0.25);
  outline: 0;
}

.premium-select:disabled {
  background-color: #f8f9fa;
  cursor: not-allowed;
  opacity: 0.7;
}

.strategy-btn {
  border-radius: 0.5rem;
  transition: all 0.25s ease;
  border: 2px solid transparent;
}

.strategy-btn-active {
  background-color: #eaf3fd;
  border-color: #0d6efd;
  color: #0d6efd;
  box-shadow: 0 2px 8px rgba(13, 110, 253, 0.15);
}

.strategy-btn-inactive {
  background-color: #f8f9fa;
  border-color: #dee2e6;
  color: #6c757d;
}

.strategy-btn-inactive:hover:not(:disabled) {
  background-color: #e9ecef;
  border-color: #adb5bd;
  color: #495057;
}

.strategy-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
