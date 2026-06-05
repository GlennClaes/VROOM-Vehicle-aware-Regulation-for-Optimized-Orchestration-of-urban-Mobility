<template>
  <header class="document-header">
    <p class="eyebrow">VROOM - Vehicle-aware Regulation for Optimized Orchestration of urban Mobility</p>
    <h2>Traffic-light control, explained as a real project handover.</h2>
    <p class="lead">
      VROOM is the AIN3 research project for adaptive urban traffic control in the Hasselt XL SUMO network.
      The project combines simulation, reinforcement learning, a Vue dashboard, a FastAPI backend,
      Dockerized services, and an agile process documented through Jira and Confluence.
    </p>

    <div class="facts-grid">
      <div v-for="fact in facts" :key="fact.label" class="fact-card">
        <span>{{ fact.label }}</span>
        <strong>{{ fact.value }}</strong>
        <p>{{ fact.text }}</p>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { headerFacts as facts } from '../data/documentation'
</script>
