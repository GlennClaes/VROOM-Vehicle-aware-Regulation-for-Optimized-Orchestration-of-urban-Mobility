<template>
  <div ref="container" class="map-container">
    <div v-if="loading" class="loading-overlay">
      <div class="loader"></div>
      <p>Laden van simulatie...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import Sumo3D from '../sumo3d'
import { InitResources } from '../initialization'

const props = defineProps<{
  initResources: InitResources
  store: any
}>()

const container = ref<HTMLElement | null>(null)
const loading = ref(true)
let sumo3d: Sumo3D | null = null

onMounted(async () => {
  if (container.value) {
    // Initialize the 3D simulation
    sumo3d = new Sumo3D(container.value, props.initResources, {
      onClick: props.store.actions.onClick,
      onUnfollow: props.store.actions.onUnfollow,
      onRemove: props.store.actions.onRemove,
      onUnhighlight: props.store.actions.onUnhighlight,
    })

    // Connect store to sumo3d logic
    props.store.actions.setSumo3D(sumo3d)

    loading.value = false

    // Gebruik de globale LoadingManager om te wachten op de belangrijkste assets.
    // We voegen een timeout toe zodat we nooit 'oneindig' blijven hangen op een kleine texture.
    const checkReady = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          console.log("[SIMULATOR] Scène is klaar voor start")
          window.parent.postMessage('map-ready', '*')
        })
      })
    }

    // Als alles binnen 2 seconden niet geladen is, sturen we alsnog map-ready
    const safetyTimeout = setTimeout(checkReady, 2000)

    if (THREE.DefaultLoadingManager.itemStart === THREE.DefaultLoadingManager.itemEnd) {
      clearTimeout(safetyTimeout)
      checkReady()
    } else {
      THREE.DefaultLoadingManager.onLoad = () => {
        clearTimeout(safetyTimeout)
        checkReady()
      }
    }
  }
})

onUnmounted(() => {
  if (sumo3d) {
    sumo3d.dispose()
  }
})
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #1a1a1a;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  color: white;
}

.loader {
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-left-color: #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
