<template>
  <div class="card shadow-sm border-0">
    <div class="card-body">
      <h6 class="fw-bold mb-3 d-flex align-items-center gap-2 text-primary">
        <Clock :size="18" /> Update Interval
      </h6>
      <p class="small text-muted mb-3">Kies de simulatie stapgrootte. Dit treedt in werking bij een nieuwe start.</p>

      <div class="d-flex gap-2" role="group">
        <select
          class="form-select form-select-sm"
          v-model.number="localInterval"
          @change="updateInterval"
          :disabled="hasUserStarted"
        >
          <option :value="1">1 seconde</option>
          <option :value="2">2 seconden</option>
          <option :value="5">5 seconden</option>
          <option :value="10">10 seconden</option>
          <!-- Fallback if a value is loaded that is not in the list -->
          <option v-if="![1, 2, 5, 10].includes(localInterval)" :value="localInterval">
            {{ localInterval }} seconden (Aangepast)
          </option>
        </select>

      </div>

      <div v-if="hasUserStarted" class="small text-muted mt-2 d-flex align-items-center gap-1">
        <Lock :size="12" />
        Stop de simulatie om het interval te wijzigen
      </div>
    </div>
  </div>
</template>


<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { Clock, Lock, Save } from 'lucide-vue-next'
import { selectedUpdateInterval, sumoActions, hasUserStarted, selectedScenario, availableScenarios } from '@/composables/useSumoBridge'

const localInterval = ref(1)

watch(() => selectedUpdateInterval.value, (newVal) => {
  localInterval.value = newVal
})

onMounted(() => {
  localInterval.value = selectedUpdateInterval.value || 1
})

function updateInterval() {
  if (hasUserStarted.value) return
  sumoActions.changeUpdateInterval(localInterval.value)
}
</script>


<style scoped>
.x-small {
  font-size: 0.7rem;
}
</style>

