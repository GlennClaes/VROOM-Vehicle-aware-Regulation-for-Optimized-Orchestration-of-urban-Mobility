<template>
  <div class="d-flex align-items-center gap-2 text-muted" style="font-size: 0.9rem;">
    <div class="d-flex align-items-center justify-content-center bg-primary bg-opacity-10 text-primary rounded-circle" style="width: 28px; height: 28px;">
      <Car :size="16" />
    </div>
    <div class="d-flex align-items-baseline gap-1">
      <span class="fw-bold text-dark fs-5" style="font-variant-numeric: tabular-nums; min-width: 1.2ch; text-align: center;">
        {{ totalVehicles }}
      </span>
      <span class="d-none d-md-inline fw-medium" style="font-size: 0.85rem;">actieve voertuigen</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Car } from 'lucide-vue-next'
import { sumoState } from '@/composables/useSumoBridge'

const totalVehicles = computed(() => {
  // Correct path is stats.vehicleCounts based on useStore.ts postMessage structure
  const counts = sumoState.value?.stats?.vehicleCounts
  if (!counts) return 0
  return Object.values(counts).reduce((acc, count) => acc + count, 0)
})
</script>

<style scoped>
/* No styles needed currently */
</style>
