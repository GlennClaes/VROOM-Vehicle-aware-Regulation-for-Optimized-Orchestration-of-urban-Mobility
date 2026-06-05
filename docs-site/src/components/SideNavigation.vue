<template>
  <aside class="side-nav" aria-label="Documentation navigation">
    <div class="brand-block">
      <div class="brand-mark">VR</div>
      <div>
        <p class="brand-kicker">Research Project AIN</p>
        <h1>VROOM</h1>
      </div>
    </div>

    <label class="search-control">
      <Search :size="16" aria-hidden="true" />
      <input
        :value="searchQuery"
        type="search"
        placeholder="Search documentation"
        aria-label="Search documentation"
        @input="$emit('update:searchQuery', $event.target.value)"
      >
    </label>

    <nav class="section-nav">
      <button
        v-for="section in sections"
        :key="section.id"
        :class="['nav-button', { active: activeSection === section.id }]"
        type="button"
        @click="$emit('update:activeSection', section.id)"
      >
        <component :is="section.icon" :size="18" aria-hidden="true" />
        <span>{{ section.label }}</span>
      </button>
    </nav>

    <div class="side-note">
      <p>Sources used for this site:</p>
      <span v-for="source in sourceNotes" :key="source">{{ source }}</span>
    </div>
  </aside>
</template>

<script setup>
import { Search } from 'lucide-vue-next'
import { sourceNotes } from '../data/documentation'

defineProps({
  sections: {
    type: Array,
    required: true,
  },
  activeSection: {
    type: String,
    required: true,
  },
  searchQuery: {
    type: String,
    required: true,
  },
})

defineEmits(['update:activeSection', 'update:searchQuery'])
</script>
