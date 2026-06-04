<template>
  <div class="app-layout">
    <Sidebar
        :state="store.state"
        :actions="store.actions"
        class="app-sidebar"
    />
    <main class="app-main">
      <Map
        :initResources="initResources"
        :store="store"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import type { InitResources } from './initialization'
import { createStore } from './composables/useStore'
import Sidebar from './components/Sidebar.vue'
import Map from './components/Map.vue'

const props = defineProps<{ initResources: InitResources }>()

const store = createStore(props.initResources)

// DISABLED: Auto-start on page load conflicts with WebSocket-controlled start/stop
// The dashboard UI will send 'startSimulation' via postMessage when the user clicks Start
// onMounted(() => {
//   store.actions.startSimulation()
// })
</script>

<style>
/* Global styles for the app layout */
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

.app-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
}

.app-sidebar {
  width: 350px;
  height: 100%;
  flex-shrink: 0;
  background: #2c3e50;
  color: white;
  box-shadow: 2px 0 10px rgba(0,0,0,0.3);
  z-index: 10;
  overflow-y: auto;
}

.app-main {
  flex-grow: 1;
  height: 100%;
  position: relative;
}
</style>
