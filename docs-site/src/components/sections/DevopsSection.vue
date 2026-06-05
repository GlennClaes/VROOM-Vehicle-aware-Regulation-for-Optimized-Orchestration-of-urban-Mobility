<template>
  <section class="doc-section">
    <SectionHeading eyebrow="DevOps and runbook" title="How to build, test, run, and deploy VROOM" />

    <p>
      The project uses Docker Compose for local and production-style orchestration. GitHub Actions handles
      continuous integration, coverage checks, Docker build verification, security scanning, deployment
      workflows, and GitHub Pages publication for this documentation site.
    </p>

    <h4>Important commands</h4>
    <div class="command-list">
      <article v-for="command in commands" :key="command.cmd">
        <code>{{ command.cmd }}</code>
        <span>{{ command.text }}</span>
      </article>
    </div>

    <h4>CI/CD responsibilities</h4>
    <IconCardGrid :items="pipelines" />

    <h4>Ports and services</h4>
    <InfoTable
      :rows="ports"
      first-heading="Service"
      second-heading="Local access"
      first-key="service"
      second-key="url"
      narrow
    />

    <h4>Current continuation note</h4>
    <p>
      This documentation is a current project handover, not the end of the work. I will continue optimizing the
      project after this version, especially around model tuning, performance, tests, deployment reliability,
      and documentation completeness.
    </p>
    <IconCardGrid :items="futureOptimization" />
  </section>
</template>

<script setup>
import SectionHeading from '../SectionHeading.vue'
import IconCardGrid from '../IconCardGrid.vue'
import InfoTable from '../InfoTable.vue'
import {
  commands,
  futureOptimization,
  pipelines,
  ports,
} from '../../data/documentation'
</script>
