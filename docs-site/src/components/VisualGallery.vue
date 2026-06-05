<template>
  <div class="visual-gallery">
    <figure v-for="asset in assets" :key="asset.title" class="visual-card">
      <img :src="asset.src" :alt="asset.alt">
      <figcaption>
        <strong>{{ asset.title }}</strong>
        <span>{{ asset.text }}</span>
      </figcaption>
    </figure>
  </div>
</template>

<script setup lang="ts">
import type { VisualAsset } from '../data/documentation'

defineProps<{
  assets: VisualAsset[]
}>()
</script>
