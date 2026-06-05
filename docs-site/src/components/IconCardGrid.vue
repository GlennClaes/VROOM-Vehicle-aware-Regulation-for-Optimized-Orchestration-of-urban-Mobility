<template>
  <div :class="['compact-grid', variant]">
    <article v-for="item in items" :key="item.title" class="plain-card">
      <component v-if="item.icon" :is="item.icon" :size="20" aria-hidden="true" />
      <h5>{{ item.title }}</h5>
      <p>{{ item.text }}</p>
    </article>
  </div>
</template>

<script setup lang="ts">
import type { IconCard } from '../data/documentation'

defineProps<{
  items: IconCard[]
  variant?: string
}>()
</script>
