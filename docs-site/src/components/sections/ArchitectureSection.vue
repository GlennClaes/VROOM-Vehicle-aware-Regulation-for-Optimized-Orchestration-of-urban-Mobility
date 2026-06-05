<template>
  <section class="doc-section">
    <SectionHeading eyebrow="Production architecture" title="How the system is deployed" />

    <p>
      The architecture diagram shows VROOM as a containerized production cluster. GitHub Actions validates
      and builds the code, Docker images are produced for the services, and the runtime stack is composed of
      a gateway, frontend, backend, SUMO-Web3D simulator, Redis cache, and MySQL database.
    </p>

    <figure class="architecture-figure">
      <img :src="architectureDiagram" alt="VROOM Traffic AI production architecture diagram">
      <figcaption>
        VROOM production architecture: GitHub Actions and Docker lifecycle on the left, runtime containers
        in the center, and storage/cache services on the right.
      </figcaption>
    </figure>

    <h4>Container responsibilities</h4>
    <div class="service-list">
      <article v-for="service in services" :key="service.name">
        <div>
          <strong>{{ service.name }}</strong>
          <p>{{ service.role }}</p>
        </div>
        <span>{{ service.tech }}</span>
      </article>
    </div>

    <h4>Runtime data flow</h4>
    <ol class="step-list">
      <li>The user starts or inspects a simulation through the Vue dashboard.</li>
      <li>The frontend calls FastAPI for scenarios, model actions, logs, stored results, and status information.</li>
      <li>SUMO-Web3D runs the traffic simulation and exposes live state for visualization.</li>
      <li>The SAM controller receives state, selects a traffic-light phase, and sends the decision back.</li>
      <li>Metrics are collected so the AI strategy can be compared with fixed-time control.</li>
    </ol>
  </section>
</template>

<script setup>
import SectionHeading from '../SectionHeading.vue'
import architectureDiagram from '../../assets/architecture-diagram.png'
import { services } from '../../data/documentation'
</script>
