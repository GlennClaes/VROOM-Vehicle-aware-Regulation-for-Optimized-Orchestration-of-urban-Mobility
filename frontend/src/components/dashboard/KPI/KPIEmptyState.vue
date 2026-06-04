<template>
  <div class="empty-state-card py-5">
    <div class="d-flex flex-column align-items-center justify-content-center text-center">
      <div class="icon-circle mb-3">
        <Activity :size="32" class="text-primary-blue" />
      </div>
      <h6 class="fw-bold text-dark mb-1">Geen actieve simulatie</h6>
      <p class="text-muted small mb-4">Start een simulatie om KPI's te bekijken</p>

      <button
        @click="handleStartSimulation"
        class="btn btn-outline-primary btn-sm fw-bold px-3 d-flex align-items-center gap-2"
        :disabled="isStarting"
      >
        <template v-if="!isStarting">
          <Play :size="14" fill="currentColor" />
          Start Simulatie
        </template>
        <template v-else>
          <span class="spinner-border spinner-border-sm" role="status"></span>
          Laden...
        </template>
      </button>
    </div>
  </div>
</template>

<script setup>
import { Activity, Play } from 'lucide-vue-next'
import { handleStartSimulation, isStarting } from '@/composables/useSumoBridge'
</script>

<style scoped>
.empty-state-card {
  width: 100%;
}

.icon-circle {
  width: 64px;
  height: 64px;
  background-color: #f0f7ff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.text-primary-blue {
  color: #3b82f6;
  opacity: 0.7;
}

h6 {
  letter-spacing: -0.01em;
}
</style>
