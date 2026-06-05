<template>
  <div class="section-heading">
    <p class="eyebrow">{{ eyebrow }}</p>
    <h3>{{ title }}</h3>
  </div>
</template>

<script setup>
defineProps({
  eyebrow: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
})
</script>
