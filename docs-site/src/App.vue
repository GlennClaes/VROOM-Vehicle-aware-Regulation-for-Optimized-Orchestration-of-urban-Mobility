<template>
  <div class="documentation-shell">
    <SideNavigation
      :sections="filteredSections"
      :active-section="activeSection"
      :search-query="searchQuery"
      @update:active-section="activeSection = $event"
      @update:search-query="searchQuery = $event"
    />

    <main class="content-area">
      <DocumentHeader />
      <component :is="activeComponent" />
    </main>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import DocumentHeader from './components/DocumentHeader.vue'
import SideNavigation from './components/SideNavigation.vue'
import AiSection from './components/sections/AiSection.vue'
import ArchitectureSection from './components/sections/ArchitectureSection.vue'
import AssignmentSection from './components/sections/AssignmentSection.vue'
import DevopsSection from './components/sections/DevopsSection.vue'
import OverviewSection from './components/sections/OverviewSection.vue'
import ProcessSection from './components/sections/ProcessSection.vue'
import ProductionSection from './components/sections/ProductionSection.vue'
import ResearchSection from './components/sections/ResearchSection.vue'
import SimulationSection from './components/sections/SimulationSection.vue'
import { navigationSections } from './data/documentation'

const searchQuery = ref('')
const activeSection = ref('overview')

const sectionComponents = {
  overview: OverviewSection,
  assignment: AssignmentSection,
  research: ResearchSection,
  architecture: ArchitectureSection,
  ai: AiSection,
  simulation: SimulationSection,
  production: ProductionSection,
  process: ProcessSection,
  devops: DevopsSection,
}

const filteredSections = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return navigationSections
  return navigationSections.filter((section) => {
    return `${section.label} ${section.keywords}`.toLowerCase().includes(query)
  })
})

const activeComponent = computed(() => sectionComponents[activeSection.value] || OverviewSection)
</script>
