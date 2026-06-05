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

<script setup>
defineProps({
  rows: {
    type: Array,
    required: true,
  },
  firstHeading: {
    type: String,
    required: true,
  },
  secondHeading: {
    type: String,
    required: true,
  },
  firstKey: {
    type: String,
    required: true,
  },
  secondKey: {
    type: String,
    required: true,
  },
  narrow: {
    type: Boolean,
    default: false,
  },
})
</script>
