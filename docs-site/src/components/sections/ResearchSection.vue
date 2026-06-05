<template>
  <section class="doc-section">
    <SectionHeading eyebrow="Research paper" title="Research question, method, literature, and conclusion" />

    <p>
      The research paper focuses on whether a SAM reinforcement-learning controller can improve traffic
      performance compared with a fixed-time traffic-light controller. The project uses SUMO because it gives
      a repeatable environment where both strategies can be tested under comparable scenario conditions.
    </p>

    <div class="quote-block">
      <p>
        What is the effect of the SAM reinforcement-learning controller on traffic performance compared
        with a fixed-time control strategy in predefined SUMO scenarios with varying traffic intensity?
      </p>
    </div>

    <h4>Research method</h4>
    <ol class="step-list">
      <li>Run the fixed-time controller and the SAM controller under the same scenario conditions.</li>
      <li>Repeat simulations to avoid conclusions based on one noisy run.</li>
      <li>Measure waiting time, total delay, throughput, queue length, pressure, fairness, and reward.</li>
      <li>Compare results to judge whether adaptive control improves traffic flow.</li>
    </ol>

    <h4>Subquestions from the paper</h4>
    <div class="question-list">
      <p v-for="question in researchQuestions" :key="question">{{ question }}</p>
    </div>

    <h4>Research findings translated into project decisions</h4>
    <div class="insight-list">
      <article v-for="insight in researchInsights" :key="insight.title">
        <strong>{{ insight.title }}</strong>
        <p>{{ insight.text }}</p>
      </article>
    </div>

    <h4>Literature base</h4>
    <ul class="check-list">
      <li v-for="source in literatureSources" :key="source">{{ source }}</li>
    </ul>

    <div class="source-box">
      <strong>Paper conclusion</strong>
      <p>
        The paper concludes that D3QN provides clear value for adaptive traffic-light control, especially
        in busy and dynamic traffic situations where fixed-time schedules cannot react quickly enough.
        It also notes that transfer to new cities usually needs retraining or fine-tuning.
      </p>
    </div>

    <div class="source-box">
      <strong>Academic integrity note</strong>
      <p>
        AI was used as writing support for structure, readability, and reformulation. The team remained
        responsible for the research question, subquestions, method, KPI selection, literature choices,
        conclusions, and final interpretation.
      </p>
    </div>
  </section>
</template>

<script setup>
import SectionHeading from '../SectionHeading.vue'
import {
  literatureSources,
  researchInsights,
  researchQuestions,
} from '../../data/documentation'
</script>
