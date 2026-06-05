<template>
  <div :class="['requirements-table', { narrow }]">
    <div class="table-row table-head">
      <span>{{ firstHeading }}</span>
      <span>{{ secondHeading }}</span>
    </div>
    <div v-for="row in rows" :key="row[firstKey]" class="table-row">
      <span>{{ row[firstKey] }}</span>
      <span>{{ row[secondKey] }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
defineProps<{
  rows: Array<Record<string, any>>
  firstHeading: string
  secondHeading: string
  firstKey: string
  secondKey: string
  narrow?: boolean
}>()
</script>
