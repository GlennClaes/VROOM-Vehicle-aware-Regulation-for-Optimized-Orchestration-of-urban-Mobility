<template>
  <div class="ai-decisions h-100 d-flex flex-column">
    <div class="decision-header d-flex align-items-start justify-content-between gap-3 mb-3">
      <div>
        <h5 class="fw-bold mb-1 d-flex align-items-center gap-2">
          <BrainCircuit :size="20" class="text-primary" />
          AI-beslissingen per timestep
        </h5>
        <p class="text-muted small mb-0">
          {{ headerText }}
        </p>
      </div>
      <span class="badge bg-primary-subtle text-primary border border-primary-subtle">
        {{ aiDecisionHistory.length }} beslissingen
      </span>
    </div>

    <div v-if="timesteps.length === 0" class="empty-state d-flex flex-column align-items-center justify-content-center text-center">
      <BrainCircuit :size="42" class="text-muted mb-3" />
      <h6 class="fw-bold mb-1">Nog geen AI-beslissingen</h6>
      <p class="text-muted small mb-0">
        Start een simulatie met het SAM Model om beslissingen per timestep te verzamelen.
      </p>
    </div>

    <template v-else>
      <div class="timeline-controls p-3 mb-3">
        <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm icon-btn"
            :disabled="selectedTimestepIndex <= 0"
            aria-label="Vorige timestep"
            @click="goPrevious"
          >
            <ChevronLeft :size="16" />
          </button>

          <div class="text-center">
            <div class="small text-muted d-flex align-items-center justify-content-center gap-1">
              <Clock3 :size="14" />
              Timestep
            </div>
            <div class="fw-bold fs-5">{{ selectedTimestep }}</div>
          </div>

          <button
            type="button"
            class="btn btn-outline-secondary btn-sm icon-btn"
            :disabled="selectedTimestepIndex >= timesteps.length - 1"
            aria-label="Volgende timestep"
            @click="goNext"
          >
            <ChevronRight :size="16" />
          </button>
        </div>

        <input
          v-model.number="selectedTimestepIndex"
          type="range"
          class="form-range"
          min="0"
          :max="timesteps.length - 1"
          step="1"
          aria-label="Navigeer door timesteps"
        >

        <div class="d-flex justify-content-between small text-muted">
          <span>{{ firstTimestep }}</span>
          <span>{{ currentTimeLabel }}</span>
          <span>{{ lastTimestep }}</span>
        </div>
      </div>

      <div class="summary-grid mb-3">
        <div class="summary-cell">
          <span class="label">Beslissingen</span>
          <strong>{{ decisionsForSelectedTimestep.length }}</strong>
        </div>
        <div class="summary-cell">
          <span class="label">Fasewissels</span>
          <strong>{{ switchCount }}</strong>
        </div>
        <div class="summary-cell">
          <span class="label">Gem. wachtrij</span>
          <strong>{{ averageQueue }}</strong>
        </div>
        <div class="summary-cell">
          <span class="label">Model</span>
          <strong class="model-name">{{ modelLabel }}</strong>
        </div>
      </div>

      <div class="decision-table-wrapper flex-grow-1">
        <table class="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th>Kruispunt</th>
              <th>Actie</th>
              <th>Fase</th>
              <th>Effect</th>
              <th class="text-end">Wachtrij</th>
              <th class="text-end">Wachttijd</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="decision in decisionsForSelectedTimestep" :key="decision.id">
              <td class="tls-cell">{{ decision.tlsId }}</td>
              <td>
                <span class="badge bg-light text-dark border">A{{ decision.action }}</span>
              </td>
              <td>
                <span class="phase-pill">
                  {{ phaseLabel(decision.previousPhaseIndex) }}
                  <ArrowRight :size="13" />
                  {{ phaseLabel(decision.targetPhaseIndex) }}
                </span>
              </td>
              <td>
                <span class="status-badge" :class="decision.switched ? 'status-switch' : 'status-hold'">
                  {{ decision.switched ? 'Wissel' : 'Behoud' }}
                </span>
                <span v-if="decision.yellowTransition" class="status-badge status-yellow ms-1">Geel</span>
                <span v-if="decision.fallback" class="status-badge status-fallback ms-1">Fallback</span>
              </td>
              <td class="text-end">{{ formatNumber(decision.queueEstimate) }} veh</td>
              <td class="text-end">{{ formatNumber(decision.waitingTimeEstimate) }} s</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowRight, BrainCircuit, ChevronLeft, ChevronRight, Clock3 } from 'lucide-vue-next'
import { aiDecisionHistory, selectedStrategy } from '@/composables/useSumoBridge'

const selectedTimestepIndex = ref(0)

const timesteps = computed(() => {
  return [...new Set(aiDecisionHistory.value.map(decision => decision.timestep))]
    .sort((a, b) => a - b)
})

const selectedTimestep = computed(() => timesteps.value[selectedTimestepIndex.value] ?? 0)
const firstTimestep = computed(() => timesteps.value[0] ?? 0)
const lastTimestep = computed(() => timesteps.value[timesteps.value.length - 1] ?? 0)

const decisionsForSelectedTimestep = computed(() => {
  return aiDecisionHistory.value
    .filter(decision => decision.timestep === selectedTimestep.value)
    .sort((a, b) => a.tlsId.localeCompare(b.tlsId))
})

const switchCount = computed(() => decisionsForSelectedTimestep.value.filter(decision => decision.switched).length)

const averageQueue = computed(() => {
  if (decisionsForSelectedTimestep.value.length === 0) return '0.0 veh'
  const total = decisionsForSelectedTimestep.value.reduce((sum, decision) => sum + (decision.queueEstimate || 0), 0)
  return `${formatNumber(total / decisionsForSelectedTimestep.value.length)} veh`
})

const modelLabel = computed(() => {
  const model = decisionsForSelectedTimestep.value.find(decision => decision.model)?.model
  if (!model) return selectedStrategy.value === 'sam' ? 'SAM' : 'N/A'
  return model.split('/').pop()
})

const currentTimeLabel = computed(() => {
  const time = decisionsForSelectedTimestep.value[0]?.time
  return time !== undefined ? `${formatNumber(time)} s` : '0.0 s'
})

const headerText = computed(() => {
  if (selectedStrategy.value !== 'sam') return 'Selecteer SAM Model om AI-regelgedrag te analyseren.'
  return 'Navigeer door de timesteps en inspecteer welke actie het model koos.'
})

watch(timesteps, (newTimesteps, oldTimesteps) => {
  if (newTimesteps.length === 0) {
    selectedTimestepIndex.value = 0
    return
  }
  if (!oldTimesteps || oldTimesteps.length === 0) {
    selectedTimestepIndex.value = newTimesteps.length - 1
    return
  }

  const selectedBefore = oldTimesteps[selectedTimestepIndex.value]
  const wasFollowingLatest = selectedTimestepIndex.value === oldTimesteps.length - 1

  if (newTimesteps.length > oldTimesteps.length && wasFollowingLatest) {
    selectedTimestepIndex.value = newTimesteps.length - 1
    return
  }

  const preservedIndex = newTimesteps.indexOf(selectedBefore)
  if (preservedIndex >= 0) {
    selectedTimestepIndex.value = preservedIndex
  } else if (selectedTimestepIndex.value >= newTimesteps.length) {
    selectedTimestepIndex.value = newTimesteps.length - 1
  }
}, { immediate: true })

function goPrevious() {
  selectedTimestepIndex.value = Math.max(0, selectedTimestepIndex.value - 1)
}

function goNext() {
  selectedTimestepIndex.value = Math.min(timesteps.value.length - 1, selectedTimestepIndex.value + 1)
}

function phaseLabel(value) {
  return value === null || value === undefined ? '-' : `F${value}`
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('nl-BE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })
}
</script>

<style scoped>
.ai-decisions {
  min-height: 0;
  padding: 0.25rem 0 0;
}

.decision-header {
  flex-shrink: 0;
}

.empty-state {
  min-height: 360px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
}

.timeline-controls,
.decision-table-wrapper {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}

.icon-btn {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.summary-cell {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  padding: 0.85rem;
  min-width: 0;
}

.summary-cell .label {
  display: block;
  color: #64748b;
  font-size: 0.75rem;
  margin-bottom: 0.2rem;
}

.summary-cell strong {
  display: block;
  color: #0f172a;
  font-size: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-name {
  font-size: 0.8rem !important;
}

.decision-table-wrapper {
  overflow: auto;
  min-height: 0;
}

.table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f8fafc;
  color: #475569;
  font-size: 0.72rem;
  text-transform: uppercase;
  border-bottom: 1px solid #e2e8f0;
}

.table td {
  font-size: 0.82rem;
  border-color: #edf2f7;
}

.tls-cell {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  color: #334155;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.phase-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: #334155;
  white-space: nowrap;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.2rem 0.45rem;
  font-size: 0.7rem;
  font-weight: 700;
}

.status-switch {
  background: #dbeafe;
  color: #1d4ed8;
}

.status-hold {
  background: #dcfce7;
  color: #15803d;
}

.status-yellow {
  background: #fef3c7;
  color: #92400e;
}

.status-fallback {
  background: #fee2e2;
  color: #b91c1c;
}

@media (max-width: 900px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
