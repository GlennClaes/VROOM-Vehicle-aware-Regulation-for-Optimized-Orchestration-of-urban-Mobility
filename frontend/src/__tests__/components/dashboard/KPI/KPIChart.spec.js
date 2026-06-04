import { mount, shallowMount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import KPIChart from '@/components/dashboard/KPI/KPIChart.vue'

// Mock Chart.js at the top level
const mockChartDestroy = vi.fn()
const mockChartUpdate = vi.fn()
let lastChartConfig = null

vi.mock('chart.js/auto', () => {
  return {
    default: class MockChart {
      constructor(ctx, config) {
        lastChartConfig = config
        this.destroy = mockChartDestroy
        this.update = mockChartUpdate
        this.data = config.data || { datasets: [], labels: [] }
      }
    }
  }
})

// Mock Canvas
const mockChartContext = {
    createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn()
    }))
}
HTMLCanvasElement.prototype.getContext = vi.fn(() => mockChartContext)

describe('KPIChart.vue', () => {
  const defaultProps = {
    data: [
        { time: 1, tnr: -10, avg_speed: 5 },
        { time: 2, tnr: -12, avg_speed: 5.5 }
    ],
    kpiConfigs: [
        { key: 'tnr', title: 'Reward', color: '#ff0000' },
        { key: 'avg_speed', title: 'Speed', color: '#00ff00' }
    ],
    title: 'Test Chart'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    lastChartConfig = null
  })

  it('renders correctly', () => {
    const wrapper = shallowMount(KPIChart, {
      props: defaultProps
    })
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.text()).toContain('Test Chart')
  })

  it('detects dual axis requirement correctly', async () => {
    const props = {
        ...defaultProps,
        data: [
            { time: 1, tnr: -600, avg_speed: 5 }
        ]
    }
    const wrapper = mount(KPIChart, { props })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.dual-axis-legend').exists()).toBe(true)
  })

  it('updates chart when data changes', async () => {
    const wrapper = mount(KPIChart, { props: defaultProps })
    const newData = [...defaultProps.data, { time: 3, tnr: -15, avg_speed: 6 }]
    await wrapper.setProps({ data: newData })
    expect(mockChartUpdate).toHaveBeenCalled()
  })

  it('destroys and recreates chart when configs change', async () => {
    const wrapper = mount(KPIChart, { props: defaultProps })
    await wrapper.setProps({
        kpiConfigs: [{ key: 'tawt', title: 'Wait', color: '#0000ff' }]
    })
    expect(mockChartDestroy).toHaveBeenCalled()
  })

  it('handles tooltip label callbacks correctly', async () => {
    mount(KPIChart, { props: defaultProps })
    
    expect(lastChartConfig).not.toBeNull()
    const labelCallback = lastChartConfig.options.plugins.tooltip.callbacks.label
    
    // Test with valid value
    const context = {
      dataset: { label: 'Speed' },
      parsed: { y: 15.555 }
    }
    const result = labelCallback(context)
    expect(result).toBe('Speed: 15,56')

    // Test with null value
    const nullContext = {
      dataset: { label: 'Speed' },
      parsed: { y: null }
    }
    expect(labelCallback(nullContext)).toBe('Speed: ')
  })

  it('destroys chart on unmount', () => {
    const wrapper = mount(KPIChart, { props: defaultProps })
    wrapper.unmount()
    expect(mockChartDestroy).toHaveBeenCalled()
  })
})
