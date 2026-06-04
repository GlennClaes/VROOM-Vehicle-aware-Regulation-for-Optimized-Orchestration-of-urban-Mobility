<template>
  <div>
    <input
        v-model="inputText"
        class="pnc-ignore search-input"
        :placeholder="isProjection ? projectionHint : sumoHint"
    />
    <span v-if="inputText && errorMessage" class="search-error">{{ errorMessage }}</span>
    <br />
    <button
        class="btn btn-raised"
        :disabled="inputText.length === 0"
        @click="onSearch"
    >
      Search
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  isProjection: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  search: [input: string]
  deselect: []
}>()

const inputText = ref('')
const projectionHint = 'OSM ID / Lat, Long / X,Y (int, int)'
const sumoHint = 'X,Y (float, float)'

function onSearch() {
  emit('search', inputText.value)
}
</script>

<style scoped>
.search-input {
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 13px;
  width: 100%;
  margin-bottom: 4px;
}
.search-error {
  color: #c00;
  font-size: 12px;
}
</style>
