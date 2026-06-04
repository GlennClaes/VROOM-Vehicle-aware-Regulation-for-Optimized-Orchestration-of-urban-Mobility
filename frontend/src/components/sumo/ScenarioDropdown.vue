<template>
  <div class="scenario-list">
    <select :value="current" class="scenario-select" @change="onChange">
      <option
          v-for="scenario in scenarios"
          :key="scenario.kebabCase"
          :value="scenario.kebabCase"
      >
        {{ scenario.displayName }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">


defineProps<{
  scenarios: readonly any[]
  current: string
}>()

const emit = defineEmits<{ change: [scenario: string] }>()

function onChange(e: Event) {
  emit('change', (e.target as HTMLSelectElement).value)
}
</script>

<style scoped>
.scenario-select {
  max-width: 180px;
  padding: 4px 6px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
}
</style>
