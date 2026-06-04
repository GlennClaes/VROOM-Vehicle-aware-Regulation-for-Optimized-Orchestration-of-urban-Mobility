<template>
  <div 
    class="card border-0 shadow-sm metric-card p-4 h-100 position-relative overflow-hidden"
    :title="tooltip"
    data-bs-toggle="tooltip"
    data-bs-placement="top"
    ref="cardRef"
  >
    <!-- Background Decor -->
    <div class="metric-decor" :style="{ backgroundColor: color }"></div>

    <div class="d-flex flex-column h-100 position-relative z-1">
      <!-- Header -->
      <div class="d-flex justify-content-between align-items-start mb-3">
        <div>
          <p class="text-muted small mb-0 fw-medium text-uppercase ls-wide">{{ title }}</p>
          <h4 class="fw-bold mb-0">{{ abbreviation }}</h4>
        </div>
        <div class="icon-wrapper p-2 rounded-3" :style="{ backgroundColor: color + '15', color: color }">
          <component :is="icon" :size="20" />
        </div>
      </div>

      <!-- Visualization Area -->
      <div class="flex-grow-1 d-flex flex-column align-items-center justify-content-center my-3">
        <template v-if="visualType === 'gauge'">
          <div class="gauge-container position-relative">
            <svg viewBox="0 0 100 60" class="gauge-svg">
              <!-- Background track -->
              <path 
                d="M 10 50 A 40 40 0 0 1 90 50" 
                fill="none" 
                stroke="#eee" 
                stroke-width="8" 
                stroke-linecap="round" 
              />
              <!-- Progress track -->
              <path 
                d="M 10 50 A 40 40 0 0 1 90 50" 
                fill="none" 
                :stroke="color" 
                stroke-width="8" 
                stroke-linecap="round" 
                :stroke-dasharray="strokeDashArray"
                :stroke-dashoffset="strokeDashOffset"
                class="gauge-progress"
              />
            </svg>
            <div class="gauge-value-overlay">
              <span class="value-text" :style="{ color: color }">{{ formattedValue }}</span>
            </div>
          </div>
        </template>

        <template v-else-if="visualType === 'bar'">
          <div class="w-100 px-2 mt-auto">
            <div class="d-flex justify-content-between mb-1">
              <span class="smallest text-muted">Huidig</span>
              <span class="smallest fw-bold" :style="{ color: color }">{{ formattedValue }} {{ unit }}</span>
            </div>
            <div class="progress" style="height: 8px; background-color: #eee;">
              <div 
                class="progress-bar" 
                role="progressbar" 
                :style="{ width: barPercentage + '%', backgroundColor: color }" 
                :aria-valuenow="barPercentage" 
                aria-valuemin="0" 
                aria-valuemax="100"
              ></div>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="display-value mb-1" :style="{ color: color }">{{ formattedValue }}</div>
          <p class="text-muted smallest mb-0">{{ unit }}</p>
        </template>
      </div>

      <!-- Legend/Context -->
      <div class="mt-auto pt-3 border-top border-light-subtle">
        <p class="text-muted smallest mb-0 d-flex align-items-center gap-1">
          <Info :size="12" />
          {{ unitContext }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { 
  Info, Gauge, Activity, Car, Users, TrendingUp, 
  TrendingDown, Clock, Timer, BarChart3, Hourglass, 
  ArrowRightCircle, AlertTriangle, Route, ListOrdered, 
  Scale, Ratio 
} from 'lucide-vue-next'
import * as bootstrap from 'bootstrap'

const props = defineProps({
  title: String,
  abbreviation: String,
  value: {
    type: [Number, String],
    default: 0
  },
  unit: String,
  unitContext: String,
  tooltip: String,
  iconName: String,
  color: {
    type: String,
    default: '#0d6efd'
  },
  visualType: {
    type: String,
    default: 'simple' // 'gauge', 'bar', 'simple'
  },
  maxValue: {
    type: Number,
    default: 100
  },
  decimals: {
    type: Number,
    default: 1
  }
})

const cardRef = ref(null)
let tooltipInstance = null

const iconMap = {
  'gauge': Gauge,
  'activity': Activity,
  'car': Car,
  'users': Users,
  'trending': TrendingUp,
  'trending-down': TrendingDown,
  'clock': Clock,
  'timer': Timer,
  'barchart': BarChart3,
  'hourglass': Hourglass,
  'arrow-right': ArrowRightCircle,
  'alert': AlertTriangle,
  'route': Route,
  'list': ListOrdered,
  'scale': Scale,
  'ratio': Ratio
}


const icon = computed(() => iconMap[props.iconName] || Activity)

const formattedValue = computed(() => {
  if (typeof props.value === 'number') {
    return props.value.toLocaleString('nl-NL', { maximumFractionDigits: props.decimals, minimumFractionDigits: props.decimals })
  }
  return props.value
})


// Gauge logic
const strokeDashArray = 125.6 // Pi * radius (40) for semi-circle is approx 125.6
const barPercentage = computed(() => {
  const val = parseFloat(props.value) || 0
  return Math.min(Math.max((val / props.maxValue) * 100, 0), 100)
})

const strokeDashOffset = computed(() => {
  const percentage = barPercentage.value / 100
  return strokeDashArray * (1 - percentage)
})

onMounted(() => {
  if (cardRef.value) {
    tooltipInstance = new bootstrap.Tooltip(cardRef.value)
  }
})

onUnmounted(() => {
  if (tooltipInstance) {
    tooltipInstance.dispose()
  }
})
</script>

<style scoped>
.metric-card {
  border-radius: 20px;
  transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
  background: white;
  cursor: help;
}

.metric-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 15px 35px rgba(0,0,0,0.1) !important;
}

.metric-decor {
  position: absolute;
  top: -20px;
  right: -20px;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.1;
  transition: opacity 0.3s ease;
}

.metric-card:hover .metric-decor {
  opacity: 0.2;
}

.icon-wrapper {
  transition: transform 0.3s ease;
}

.metric-card:hover .icon-wrapper {
  transform: scale(1.1) rotate(5deg);
}

.display-value {
  font-size: 2.75rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -1px;
}

.ls-wide {
  letter-spacing: 0.05em;
}

.smallest {
  font-size: 0.7rem;
}

/* Gauge styling */
.gauge-container {
  width: 140px;
  height: 90px;
}

.gauge-svg {
  width: 100%;
  height: 100%;
}

.gauge-progress {
  transition: stroke-dashoffset 1s ease-out;
}

.gauge-value-overlay {
  position: absolute;
  bottom: 10px;
  left: 0;
  right: 0;
  text-align: center;
}

.value-text {
  font-size: 1.5rem;
  font-weight: 800;
}

.progress {
  border-radius: 10px;
  overflow: hidden;
}

.progress-bar {
  transition: width 1s ease-out;
}
</style>
