<template>
  <section class="doc-section">
    <SectionHeading eyebrow="SAM AI controller" title="How reinforcement learning is used" />

    <p>
      SAM stands for Smart Adaptive Mobility. In VROOM, SAM is the learning traffic-light controller.
      The repository contains DQN/D3QN based agents, a fixed-time baseline, training scripts, evaluation
      scripts, and API routes for starting inference from the backend.
    </p>

    <div class="split-layout">
      <div>
        <h4>State</h4>
        <p>
          The controller observes traffic pressure through normalized lane features such as queue length,
          vehicle count, waiting time, speed, and the current signal phase. These features are shaped into
          a fixed observation vector that can be processed by the neural network.
        </p>
      </div>
      <div>
        <h4>Action</h4>
        <p>
          The action is the selected traffic-light phase. During inference, the trained agent chooses the
          phase with the highest estimated value and sends that decision to the simulation service.
        </p>
      </div>
    </div>

    <h4>Reward design</h4>
    <p>
      The reward encourages throughput and queue reduction. It penalizes large queues, long waiting times,
      inefficient empty green phases, and traffic pressure that risks spillback. This makes the model optimize
      for network behavior instead of a single visible metric.
    </p>

    <div class="metric-grid">
      <article v-for="metric in metrics" :key="metric.name" class="metric-card">
        <span>{{ metric.name }}</span>
        <p>{{ metric.description }}</p>
      </article>
    </div>

    <h4>Spillback probability calculator</h4>
    <p>
      The C++ performance module includes a sigmoidal queue-spillback estimate. The calculator below mirrors
      that idea: as the queue approaches lane capacity, the probability rises quickly.
    </p>

    <div class="calculator-panel">
      <div class="slider-stack">
        <label>
          <span>Current queue</span>
          <strong>{{ currentQueue }} vehicles</strong>
          <input v-model.number="currentQueue" type="range" min="0" :max="laneCapacity">
        </label>
        <label>
          <span>Lane capacity</span>
          <strong>{{ laneCapacity }} vehicles</strong>
          <input v-model.number="laneCapacity" type="range" min="10" max="100">
        </label>
      </div>
      <div class="calculator-result">
        <span>{{ formattedProbability }}%</span>
        <p>spillback probability</p>
        <strong :style="{ color: statusColor }">{{ statusLabel }}</strong>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import SectionHeading from '../SectionHeading.vue'
import { metrics } from '../../data/documentation'

const currentQueue = ref(15)
const laneCapacity = ref(30)

const spillbackProbability = computed(() => {
  if (laneCapacity.value <= 0) return 1
  const ratio = currentQueue.value / laneCapacity.value
  if (ratio >= 1) return 1
  if (ratio <= 0) return 0
  return 1 / (1 + Math.exp(-10 * (ratio - 0.75)))
})

const formattedProbability = computed(() => Math.round(spillbackProbability.value * 100))

const statusColor = computed(() => {
  const probability = spillbackProbability.value
  if (probability < 0.3) return '#27845f'
  if (probability < 0.7) return '#a45f14'
  return '#b42318'
})

const statusLabel = computed(() => {
  const probability = spillbackProbability.value
  if (probability < 0.3) return 'Low risk'
  if (probability < 0.7) return 'Watch closely'
  return 'High risk'
})
</script>
