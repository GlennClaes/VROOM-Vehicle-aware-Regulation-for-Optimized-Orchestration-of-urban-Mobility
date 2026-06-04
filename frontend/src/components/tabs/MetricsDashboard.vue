<script setup>
import KPIContainer from '@/components/dashboard/KPI/KPIContainer.vue'

defineProps({
  isRunning: {
    type: Boolean,
    default: false
  },
  runId: {
    type: String,
    default: null
  }
})
</script>

<template>
  <div class="metrics-dashboard-wrapper">
    <KPIContainer :isRunning="isRunning" :runId="runId" />
  </div>
</template>

<style scoped>
.metrics-dashboard-wrapper {
  display: flex;
  flex-direction: column;
}
</style>
