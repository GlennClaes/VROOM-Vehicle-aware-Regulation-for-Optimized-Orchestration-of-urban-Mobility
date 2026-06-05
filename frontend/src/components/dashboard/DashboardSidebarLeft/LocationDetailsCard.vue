<template>
  <Transition name="fade">
    <div v-if="clickedPoint" class="card shadow-sm border-0" style="border-top: none !important;">
      <div class="card-body">
        <h6 class="fw-bold mb-4 d-flex align-items-center gap-2 text-primary">
          <MapPin :size="18" /> Locatie
        </h6>

        <div class="mb-4">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <label class="form-label small mb-0 fw-bold">Geselecteerde Coördinaten</label>
            <span class="badge text-primary bg-light" style="font-size: 0.75rem;">
              {{ clickedPoint.lat.toFixed(5) }}, {{ clickedPoint.lng.toFixed(5) }}
            </span>
          </div>
          <button class="btn btn-light btn-sm w-100 py-2 border mt-2 d-flex align-items-center justify-content-center gap-2" @click="copyToClipboard">
            <Copy :size="14" /> Kopieer coördinaten
          </button>
        </div>

        <div class="d-flex flex-column gap-2">
          <a :href="googleMapsUrl" target="_blank" class="btn btn-outline-primary fw-bold py-2 d-flex align-items-center justify-content-center gap-2">
            <ExternalLink :size="18" /> Google Maps
          </a>
          <a :href="osmUrl" target="_blank" class="btn btn-outline-secondary fw-bold py-2 d-flex align-items-center justify-content-center gap-2">
            <ExternalLink :size="18" /> OpenStreetMap
          </a>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { MapPin, ExternalLink, Copy } from 'lucide-vue-next'
import { clickedPoint } from '../../../composables/useSumoBridge'

const googleMapsUrl = computed(() => {
  if (!clickedPoint.value) return '#'
  return `https://www.google.com/maps/search/?api=1&query=${clickedPoint.value.lat},${clickedPoint.value.lng}`
})

const osmUrl = computed(() => {
  if (!clickedPoint.value) return '#'
  return `https://www.openstreetmap.org/?mlat=${clickedPoint.value.lat}&mlon=${clickedPoint.value.lng}&zoom=17`
})

function copyToClipboard() {
  if (!clickedPoint.value) return
  const text = `${clickedPoint.value.lat.toFixed(6)}, ${clickedPoint.value.lng.toFixed(6)}`
  navigator.clipboard.writeText(text)
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
