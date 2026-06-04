<template>
  <div class="kpi-chart-wrapper">
    <div class="chart-header d-flex justify-content-between align-items-center mb-3">
      <div class="chart-info">
        <h6 class="fw-bold mb-0 text-dark">{{ title }}</h6>
        <p class="text-muted smallest mb-0">Historisch verloop over de laatste {{ data.length }} seconden</p>
      </div>
      <div class="chart-actions d-flex align-items-center gap-3">
        <div v-if="hasDualAxis" class="dual-axis-legend d-none d-md-flex gap-2">
            <span class="badge bg-secondary-soft text-secondary border border-secondary-subtle px-2 py-1 rounded-pill smallest">
                Linker As: &lt; 100
            </span>
            <span class="badge bg-primary-soft text-primary border border-primary-subtle px-2 py-1 rounded-pill smallest">
                Rechter As: &gt; 100
            </span>
        </div>
        <div class="badge bg-light text-primary border border-primary-subtle px-3 py-2 rounded-pill">
          <Activity :size="14" class="me-1" /> Live Updates
        </div>
      </div>
    </div>
    <div class="chart-canvas-container">
      <canvas ref="chartCanvas"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount, nextTick } from 'vue'
import { Activity } from 'lucide-vue-next'
import Chart from 'chart.js/auto'

const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  kpiConfigs: {
    type: Array,
    required: true // Array of { key, title, color }
  },
  title: {
    type: String,
    default: 'KPI Trend Analyse'
  }
})

const chartCanvas = ref(null)
let chart = null
const hasDualAxis = ref(false)

const createChart = () => {
  if (!chartCanvas.value) return

  const ctx = chartCanvas.value.getContext('2d')
  
  // Determine if we need dual axis
  // Calculate max absolute values for each selected KPI
  const kpiMaxValues = props.kpiConfigs.map(config => {
    const vals = props.data.map(d => Math.abs(d[config.key] || 0))
    return vals.length > 0 ? Math.max(...vals) : 0
  })

  const needsDualAxis = kpiMaxValues.some(v => v > 500) && kpiMaxValues.some(v => v < 100 && v > 0)
  hasDualAxis.value = needsDualAxis

  const datasets = props.kpiConfigs.map((config, index) => {
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400)
    gradient.addColorStop(0, config.color + '30')
    gradient.addColorStop(1, config.color + '00')

    // Decide which Y axis to use
    // If dual axis is needed, anything with max > 100 goes to 'y1' (right)
    const yAxisID = (needsDualAxis && kpiMaxValues[index] > 100) ? 'y1' : 'y'

    return {
      label: config.title,
      data: props.data.map(d => d[config.key]),
      borderColor: config.color,
      backgroundColor: gradient,
      borderWidth: 2.5,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointBackgroundColor: config.color,
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      yAxisID
    }
  })

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: props.data.map(d => Math.floor(d.time) + 's'),
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            padding: 20,
            font: {
              family: "'Inter', sans-serif",
              size: 11,
              weight: '500'
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          titleColor: '#1e293b',
          bodyColor: '#475569',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          padding: 12,
          boxPadding: 6,
          usePointStyle: true,
          titleFont: {
            weight: 'bold'
          },
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += context.parsed.y.toLocaleString('nl-NL', { maximumFractionDigits: 2 });
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 10,
            font: {
              size: 10
            }
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          beginAtZero: false,
          title: {
            display: needsDualAxis,
            text: 'Primaire Schaal',
            font: { size: 10, weight: 'bold' }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
            drawBorder: false
          },
          ticks: {
            font: {
              size: 10
            }
          }
        },
        y1: {
          type: 'linear',
          display: needsDualAxis,
          position: 'right',
          beginAtZero: false,
          title: {
            display: true,
            text: 'Secundaire Schaal',
            font: { size: 10, weight: 'bold' }
          },
          grid: {
            drawOnChartArea: false, // only want the grid lines for one axis
          },
          ticks: {
            font: {
              size: 10
            }
          }
        }
      },
      animations: {
        y: { duration: 0 },
        y1: { duration: 0 }
      }
    }
  })
}

// Watch for data changes to update the chart
watch(() => props.data, (newData) => {
  if (chart && newData && newData.length > 0) {
    chart.data.labels = newData.map(d => Math.floor(d.time) + 's')
    props.kpiConfigs.forEach((config, index) => {
      if (chart.data.datasets[index]) {
        chart.data.datasets[index].data = newData.map(d => d[config.key])
      }
    })
    chart.update('none') 
  }
})

// Watch for config changes to recreate the chart (especially important for Y axis detection)
watch(() => props.kpiConfigs, () => {
  if (chart) {
    chart.destroy()
    nextTick(() => {
        createChart()
    })
  }
}, { deep: true })

onMounted(() => {
  createChart()
})

onBeforeUnmount(() => {
  if (chart) {
    chart.destroy()
  }
})
</script>

<style scoped>
.kpi-chart-wrapper {
  background: white;
  border-radius: 16px;
  padding: 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

.chart-canvas-container {
  flex-grow: 1;
  position: relative;
  min-height: 300px;
}

.smallest {
  font-size: 0.7rem;
}

.bg-light {
  background-color: #f8fafc !important;
}

.bg-secondary-soft { background: rgba(100, 116, 139, 0.1); }
.bg-primary-soft { background: rgba(59, 130, 246, 0.1); }

.text-primary { color: #3b82f6 !important; }
.text-secondary { color: #64748b !important; }

.border-primary-subtle { border-color: #bfdbfe !important; }
.border-secondary-subtle { border-color: #e2e8f0 !important; }

.dual-axis-legend {
    margin-right: 1rem;
}
</style>
