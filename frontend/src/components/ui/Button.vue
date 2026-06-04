<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="['btn', variantClass, 'rounded-3 shadow-sm']"
    @click="$emit('click', $event)"
  >
    <slot></slot>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  type: {
    type: String,
    default: 'button',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'outline', 'ghost'].includes(value),
  },
})

defineEmits(['click'])

const variantClass = computed(() => {
  const mapping = {
    default: 'btn-primary',
    outline: 'btn-outline-secondary bg-white',
    ghost: 'btn-light border-0',
  }
  return mapping[props.variant]
})
</script>
