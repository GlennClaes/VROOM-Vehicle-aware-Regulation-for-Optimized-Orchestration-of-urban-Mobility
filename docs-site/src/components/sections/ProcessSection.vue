<template>
  <section class="doc-section">
    <SectionHeading eyebrow="Sprints and process" title="How Jira and Confluence supported the work" />

    <p>
      The assignment evaluated both the software and the development process. VROOM used Jira for user stories,
      sprint tracking, status updates, and PR traceability. Confluence was used for project analysis, sprint
      reviews, retrospectives, team agreements, planning, and documentation evidence.
    </p>

    <h4>Process evidence</h4>
    <IconCardGrid :items="assetCards" />

    <h4>Sprint 0 to Sprint 3 timeline</h4>
    <div class="sprint-list">
      <article v-for="sprint in sprintTimeline" :key="sprint.sprint" class="sprint-card">
        <div class="sprint-meta">
          <span>{{ sprint.sprint }}</span>
          <strong>{{ sprint.title }}</strong>
          <p>{{ sprint.period }}</p>
        </div>
        <div>
          <p class="sprint-goal">{{ sprint.goal }}</p>
          <ul class="check-list">
            <li v-for="outcome in sprint.outcomes" :key="outcome">{{ outcome }}</li>
          </ul>
        </div>
      </article>
    </div>

    <h4>Working agreements from Sprint 0</h4>
    <div class="process-grid">
      <article v-for="agreement in workingAgreements" :key="agreement.title">
        <strong>{{ agreement.title }}</strong>
        <p>{{ agreement.text }}</p>
      </article>
    </div>

    <h4>Scrum rhythm</h4>
    <div class="process-grid">
      <article v-for="ritual in processRituals" :key="ritual.title">
        <strong>{{ ritual.title }}</strong>
        <p>{{ ritual.text }}</p>
      </article>
    </div>

    <div class="source-box">
      <strong>Where to look during assessment</strong>
      <p>
        Use this documentation site for the final technical overview. Use Jira for backlog evidence and sprint
        execution. Use Confluence for analysis, sprint reviews, sprint retrospectives, team agreements, and
        assignment-required process documentation.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import SectionHeading from '../SectionHeading.vue'
import IconCardGrid from '../IconCardGrid.vue'
import {
  assetCards,
  processRituals,
  sprintTimeline,
  workingAgreements,
} from '../../data/documentation'
</script>
