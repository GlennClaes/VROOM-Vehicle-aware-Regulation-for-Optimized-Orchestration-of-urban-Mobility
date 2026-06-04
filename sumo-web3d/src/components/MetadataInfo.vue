<template>
  <div class="metadata-info">
    <h3>Stats</h3>
    <div class="metadata-section">
      <div>time: {{ timeSecs }} s</div>
      <div>payload: {{ payloadKb }} KB</div>
      <div>simulate: {{ simulateMs }} ms</div>
      <div>snapshot: {{ snapshotMs }} ms</div>
    </div>

    <h3>Vehicle Summary</h3>
    <div class="metadata-section">
      <div v-for="(count, vClass) in state.stats.vehicleCounts" :key="vClass">
        {{ vehicleLabel(String(vClass)) }}(s): {{ count }}
      </div>
    </div>

    <h3>Click Summary</h3>
    <div class="metadata-section">
      <div v-if="noClickData">N/A</div>
      <template v-if="state.clickedPoint">
        <div>
          Lat, Lng: ({{ state.clickedPoint.lat.toFixed(6) }},
          {{ state.clickedPoint.lng.toFixed(6) }})
        </div>
        <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px;">
          <a :href="googleMapsUrl" target="_blank" class="btn btn-primary" style="text-align: center; display: block;">Open in Google Maps</a>
          <a :href="osmUrl" target="_blank" class="btn btn-secondary" style="text-align: center; display: block;">Open in OpenStreetMap</a>
        </div>
      </template>
      <div v-if="state.clickedSumoPoint">
        SUMO: ({{ state.clickedSumoPoint[0].toFixed(2) }},
        {{ state.clickedSumoPoint[1].toFixed(2) }})
      </div>
    </div>

    <div v-if="state.clickedObjects?.length" class="metadata-section">
      Objects at point:
      <ul>
        <li v-for="(obj, i) in state.clickedObjects" :key="i">
          <template v-if="obj.osmId">
            <a :href="`http://www.openstreetmap.org/${obj.osmId.type}/${obj.osmId.id}`" target="_blank">
              {{ obj.name }}
            </a>
          </template>
          <template v-else-if="obj.vClass && SUPPORTED_VEHICLE_CLASSES[obj.vClass]">
            {{ obj.name }}
            <div class="flex-container">
              <button class="btn btn-primary" @click="actions.followObjectPOV(obj.name)">Follow</button>
              <button class="btn btn-secondary" @click="actions.toggleRouteObjectHighlighted(obj.name)">
                {{ state.edgesHighlighted ? 'Hide Route' : 'Show Route' }}
              </button>
            </div>
          </template>
          <template v-else>{{ obj.name }}</template>
        </li>
      </ul>
    </div>

    <div v-if="state.clickedVehicleId && state.clickedVehicleInfo" class="metadata-section">
      <div class="clicked-vehicle-info">
        {{ state.clickedVehicleId }}: {{ JSON.stringify(state.clickedVehicleInfo, null, 2) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { isEmpty } from 'lodash-es'
import { type StoreState, type StoreActions } from '../composables/useStore'
import { SUPPORTED_VEHICLE_CLASSES } from '../constants'

const props = defineProps<{
  state: StoreState
  actions: StoreActions
}>()

const timeSecs = computed(() => (props.state.stats.time / 1000).toFixed(3))
const payloadKb = computed(() => (props.state.stats.payloadSize / 1024).toFixed(1))
const simulateMs = computed(() => (props.state.stats.simulateSecs * 1000).toFixed(2))
const snapshotMs = computed(() => (props.state.stats.snapshotSecs * 1000).toFixed(2))

const noClickData = computed(
    () =>
        isEmpty(props.state.clickedObjects) &&
        isEmpty(props.state.clickedSumoPoint) &&
        isEmpty(props.state.clickedPoint) &&
        !props.state.clickedVehicleId,
)

const googleMapsUrl = computed(() => {
  if (!props.state.clickedPoint) return ''
  const { lat, lng } = props.state.clickedPoint
  return `https://www.google.com/maps/search/${lat},${lng}`
})
const osmUrl = computed(() => {
  if (!props.state.clickedPoint) return ''
  const { lat, lng } = props.state.clickedPoint
  return `http://www.openstreetmap.org/#map=18/${lat}/${lng}`
})

function vehicleLabel(vClass: string | number): string {
  return SUPPORTED_VEHICLE_CLASSES[String(vClass)]?.label ?? String(vClass)
}
</script>

<style scoped>
.metadata-info h3 {
  font-size: 0.8rem;
  text-transform: uppercase;
  color: #95a5a6;
  margin: 1.5rem 0 0.5rem 0;
  letter-spacing: 1px;
}

.metadata-section {
  background: rgba(0,0,0,0.2);
  padding: 0.8rem;
  border-radius: 4px;
  font-size: 0.9rem;
  line-height: 1.4;
}

.flex-container {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

ul {
  padding-left: 1.2rem;
  margin: 0.5rem 0 0 0;
}

li {
  margin-bottom: 0.5rem;
}

a {
  color: #3498db;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

.clicked-vehicle-info {
  white-space: pre-wrap;
  word-break: break-all;
  font-family: monospace;
  font-size: 0.8rem;
}
</style>
