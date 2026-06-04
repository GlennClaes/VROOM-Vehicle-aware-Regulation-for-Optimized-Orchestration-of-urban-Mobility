<template>
  <div class="sidebar-container">
    <!-- Header -->
    <div class="sidebar-header">
      <div class="scenario-row">
        <span>Current Scenario:</span>
        <ScenarioDropdown
            :scenarios="state.availableScenarios"
            :current="state.scenario"
            @change="actions.changeScenario"
        />
      </div>

      <div class="button-row">
        <button
            v-if="state.simulationStatus === 'off'"
            class="btn btn-primary"
            :disabled="state.isLoading"
            @click="actions.startSimulation"
        >
          restart
        </button>
        <button v-else class="btn btn-primary" @click="actions.cancelSimulation">cancel</button>

        <button
            v-if="state.simulationStatus === 'running'"
            class="btn"
            @click="actions.pauseSimulation"
        >
          pause
        </button>
        <button
            v-else-if="state.simulationStatus === 'paused'"
            class="btn"
            @click="actions.resumeSimulation"
        >
          resume
        </button>

        <KeyboardHelp />
      </div>

      <div class="slider-row">
        <span>slow</span>
        <div id="speed-control-slider">
          <input
              type="range"
              min="0"
              max="99"
              v-model.number="localSlider"
              @input="onSliderInput"
          />
          <div class="speed-control-slider-label">
            Delay: {{ delayDisplay }} ms
          </div>
        </div>
        <span id="fast-symbol">fast</span>
      </div>

      <button v-if="state.followingVehicle" class="btn btn-secondary" @click="actions.unfollowObjectPOV">
        Unfollow
      </button>
    </div>

    <!-- Body -->
    <div class="sidebar-body">
      <MetadataInfo :state="state" :actions="actions" />
    </div>

    <!-- Footer -->
    <div class="sidebar-footer">
      <div class="quick-focus-title">Quick Find</div>
      <QuickSearch
          :is-projection="state.isProjection"
          :error-message="state.searchBoxErrorMessage"
          @search="actions.handleSearch"
          @deselect="actions.deselectSearch"
      />
      <div class="quick-focus-buttons">
        <button
            v-for="(v, vClass) in SUPPORTED_VEHICLE_CLASSES"
            :key="vClass"
            class="btn btn-primary"
            :disabled="!state.stats.vehicleCounts[vClass]"
            @click="actions.focusOnVehicleOfClass(String(vClass))"
        >
          {{ v.label }}
        </button>
        <button class="btn btn-primary" @click="actions.focusOnTrafficLight">Light</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { StoreState, StoreActions } from './types'
import { SUPPORTED_VEHICLE_CLASSES } from './constants'
import KeyboardHelp from './KeyboardHelp.vue'
import ScenarioDropdown from './ScenarioDropdown.vue'
import MetadataInfo from './MetadataInfo.vue'
import QuickSearch from './QuickSearch.vue'

const MAX_DELAY_MS = 300

const props = defineProps<{
  state: StoreState
  actions: StoreActions
}>()

// Slider: 0=slow(100ms), 99=fast(1ms)
const localSlider = ref(Math.round((1 - props.state.delayMs / MAX_DELAY_MS) * 99))

// Watch for external changes (from store/backend)
watch(() => props.state.delayMs, (newDelay) => {
  localSlider.value = Math.round((1 - newDelay / MAX_DELAY_MS) * 99)
})

const delayDisplay = computed(() =>
    ((1 - localSlider.value / 99) * MAX_DELAY_MS).toFixed(1)
)

function onSliderInput() {
  const ms = (1 - localSlider.value / 99) * MAX_DELAY_MS
  props.actions.changeDelay(ms)
}
</script>

<style scoped>
.sidebar-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1rem;
  box-sizing: border-box;
}

.sidebar-header {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  padding-bottom: 1rem;
  margin-bottom: 1rem;
}

.sidebar-body {
  flex-grow: 1;
  overflow-y: auto;
}

.sidebar-footer {
  flex-shrink: 0;
  border-top: 1px solid rgba(255,255,255,0.1);
  padding-top: 1rem;
  margin-top: 1rem;
}

.scenario-row, .slider-row {
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.button-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.quick-focus-title {
  font-weight: bold;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.quick-focus-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.btn {
  padding: 6px 12px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  background: #34495e;
  color: white;
  transition: background 0.2s;
}

.btn:hover:not(:disabled) {
  background: #465d75;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3498db;
}

.btn-primary:hover:not(:disabled) {
  background: #2980b9;
}

.btn-secondary {
  background: #e67e22;
}

#speed-control-slider {
  flex-grow: 1;
  margin: 0 10px;
}

input[type="range"] {
  width: 100%;
}

.speed-control-slider-label {
  font-size: 11px;
  text-align: center;
}
</style>
