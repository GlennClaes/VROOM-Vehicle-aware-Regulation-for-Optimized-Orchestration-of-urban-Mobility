<template>
  <label :for="htmlFor" class="form-label fw-medium small mb-1">
    <slot></slot>
  </label>
</template>

<script setup>
defineProps({
  htmlFor: { type: String, default: '' },
})
</script>
