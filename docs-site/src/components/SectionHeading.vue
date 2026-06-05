<template>
  <div class="section-heading">
    <p class="eyebrow">{{ eyebrow }}</p>
    <h3>{{ title }}</h3>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
}>()
</script>
