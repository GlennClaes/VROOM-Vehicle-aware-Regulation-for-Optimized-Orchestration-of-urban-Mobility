<template>
  <section class="doc-section">
    <SectionHeading eyebrow="Simulation and user interface" title="How users explore the traffic system" />

    <p>
      VROOM is built around the Hasselt XL SUMO scenario. SUMO provides the traffic environment, SUMO-Web3D
      gives the project a visual simulation layer, and the Vue dashboard gives users control over scenarios,
      strategies, metrics, logs, and analysis.
    </p>

    <div class="timeline">
      <article v-for="item in simulationFlow" :key="item.title">
        <span>{{ item.step }}</span>
        <div>
          <strong>{{ item.title }}</strong>
          <p>{{ item.text }}</p>
        </div>
      </article>
    </div>

    <h4>User-facing workflows</h4>
    <IconCardGrid :items="uiWorkflows" />

    <h4>Project visuals from the sprint evidence</h4>
    <VisualGallery :assets="visualAssets" />

    <h4>Vision and sensor data</h4>
    <p>
      The assignment explicitly included experiments with perfect simulated sensors and noisy vision-based input.
      The repository includes a vision-oriented API route that can produce camera-style views from simulation state.
      The core comparison remains centered on SUMO telemetry because it is controlled and repeatable.
    </p>

    <div class="source-box">
      <strong>Dashboard design continuity</strong>
      <p>
        The documentation now reuses the dashboard favicon and references the Sprint 0 mockup scope, so the
        documentation site feels connected to the application instead of standing apart from it.
      </p>
    </div>
  </section>
</template>

<script setup>
import SectionHeading from '../SectionHeading.vue'
import IconCardGrid from '../IconCardGrid.vue'
import VisualGallery from '../VisualGallery.vue'
import { simulationFlow, uiWorkflows, visualAssets } from '../../data/documentation'
</script>
