<template>
  <button
    class="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center gap-2 transition-all px-3"
    style="height: 36px; border-radius: 8px;"
    @click="$emit('toggle')"
    title="Volledig scherm"
  >
    <Maximize v-if="!isFullscreen" size="18" />
    <Minimize v-else size="18" />
    <span class="d-none d-sm-inline">{{ isFullscreen ? 'Minimaliseren' : 'Volledig scherm' }}</span>
  </button>
</template>

<script setup>
import { Maximize, Minimize } from 'lucide-vue-next'

defineProps({
  isFullscreen: {
    type: Boolean,
    default: false
  }
})

defineEmits(['toggle'])
</script>

<style scoped>
.btn-outline-secondary {
  border-color: #dee2e6;
  color: #6c757d;
}
.btn-outline-secondary:hover {
  background-color: #f8f9fa;
  border-color: #cdd4ea;
  color: #0d6efd;
}
.transition-all {
  transition: all 0.2s ease-in-out;
}
</style>
