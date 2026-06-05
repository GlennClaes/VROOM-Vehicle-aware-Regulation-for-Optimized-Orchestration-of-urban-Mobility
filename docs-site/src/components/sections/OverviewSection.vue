<template>
  <section class="doc-section">
    <SectionHeading eyebrow="Project overview" title="Why VROOM exists" />

    <p>
      Urban intersections are one of the most visible bottlenecks in city mobility. Fixed traffic-light
      schedules are predictable, but they react poorly to rush-hour pressure, uneven lane distribution,
      incidents, and sudden changes in traffic intensity. VROOM investigates whether an adaptive controller
      can make better decisions by learning from a simulated traffic environment.
    </p>

    <div class="split-layout">
      <div>
        <h4>The product</h4>
        <p>
          The final system is an end-user application around a SUMO simulation. A non-technical user can
          select a scenario, start the simulation, switch between control strategies, inspect live traffic,
          and review performance indicators. The interface is not only a viewer: it is a way to compare
          decision strategies under the same conditions.
        </p>
      </div>
      <div>
        <h4>The research angle</h4>
        <p>
          The research paper frames the main question as a comparison between SAM, the reinforcement-learning
          traffic-light controller, and a fixed-time baseline. The evaluation focuses on whether SAM improves
          traffic performance in predefined SUMO scenarios with different traffic intensities.
        </p>
      </div>
    </div>

    <div class="callout">
      <CheckCircle2 :size="20" aria-hidden="true" />
      <div>
        <strong>What makes this project more than a demo</strong>
        <p>
          The repository contains the operational parts around the research: containerized services,
          training and evaluation scripts, a baseline implementation, backend tests, frontend tests,
          CI/CD workflows, a production-style deployment topology, and this assessment-ready documentation site.
        </p>
      </div>
    </div>

    <h4>Project scope in one flow</h4>
    <div class="flow-row" aria-label="Project flow">
      <span>SUMO scenario</span>
      <span>Traffic state</span>
      <span>SAM or baseline decision</span>
      <span>Light phase update</span>
      <span>KPI comparison</span>
    </div>
  </section>
</template>

<script setup>
import { CheckCircle2 } from 'lucide-vue-next'
import SectionHeading from '../SectionHeading.vue'
</script>
