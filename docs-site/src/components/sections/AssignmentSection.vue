<template>
  <section class="doc-section">
    <SectionHeading eyebrow="Assignment fit" title="How the assignment requirements map to the project" />

    <p>
      The official assignment asked teams to build an intelligent traffic-light controller that runs in SUMO,
      compares at least one non-learning baseline with at least one reinforcement-learning approach, gathers
      metrics, and presents the result through a modern web interface. The documentation keeps those requirements
      visible so the implementation can be assessed against the original brief.
    </p>

    <InfoTable
      :rows="requirementFit"
      first-heading="Assignment requirement"
      second-heading="VROOM implementation"
      first-key="requirement"
      second-key="implementation"
    />

    <h4>Deliverables requested by the assignment</h4>
    <IconCardGrid :items="deliverables" />

    <h4>VROOM mockups from Sprint 0</h4>
    <p>
      Sprint 0 defined the first interface surface before implementation started. The mockups covered the flows
      that later became the main user journeys in the dashboard.
    </p>
    <div class="mockup-list">
      <span v-for="mockup in mockups" :key="mockup">{{ mockup }}</span>
    </div>

    <h4>Definition of Done</h4>
    <p>
      A user story is only considered done when functional behavior, code quality, validation, documentation,
      review, and deploy readiness have all been checked.
    </p>
    <div class="dod-grid">
      <article v-for="group in definitionOfDone" :key="group.title" class="dod-card">
        <strong>{{ group.title }}</strong>
        <ul>
          <li v-for="check in group.checks" :key="check">{{ check }}</li>
        </ul>
      </article>
    </div>

    <div class="callout warning">
      <AlertTriangle :size="20" aria-hidden="true" />
      <div>
        <strong>Documentation traceability</strong>
        <p>
          Jira and Confluence are part of the assessment evidence. This site summarizes the final product,
          while Jira and Confluence remain the detailed trail for backlog work, sprint reviews, retrospectives,
          analysis notes, and process decisions.
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { AlertTriangle } from 'lucide-vue-next'
import SectionHeading from '../SectionHeading.vue'
import IconCardGrid from '../IconCardGrid.vue'
import InfoTable from '../InfoTable.vue'
import {
  definitionOfDone,
  deliverables,
  mockups,
  requirementFit,
} from '../../data/documentation'
</script>
