<template>
  <section class="doc-section">
    <SectionHeading eyebrow="Real-light production" title="Preparing VROOM for physical traffic lights" />

    <p>
      The original project proves the adaptive-control concept inside SUMO. The new production layer prepares
      the next step: a controller that can run near real traffic-light cabinets while still being testable
      without hardware. It is deliberately separated from the research stack so simulation, AI training,
      dashboard features and physical control do not become one fragile system.
    </p>

    <IconCardGrid :items="productionReadiness" />

    <h4>Safety-first fallback behavior</h4>
    <div class="flow-row" aria-label="Real-light fallback flow">
      <span>Heartbeat lost</span>
      <span>Communication marked lost</span>
      <span>All-red safety phase</span>
      <span>Local fixed cycle</span>
      <span>Resume when restored</span>
    </div>

    <h4>Implementation files</h4>
    <InfoTable
      :rows="productionFiles"
      first-heading="File or folder"
      second-heading="Purpose"
      first-key="name"
      second-key="description"
    />

    <div class="source-box">
      <strong>Production note</strong>
      <p>
        The GPIO and PLC adapters are intentionally behind a HAL. A real deployment must still add certified
        PLC SDK bindings, cabinet wiring validation, hardware watchdogs, local traffic-engineering rules and
        regulatory acceptance tests before controlling public roads.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import SectionHeading from '../SectionHeading.vue'
import IconCardGrid from '../IconCardGrid.vue'
import InfoTable from '../InfoTable.vue'
import { productionFiles, productionReadiness } from '../../data/documentation'
</script>
