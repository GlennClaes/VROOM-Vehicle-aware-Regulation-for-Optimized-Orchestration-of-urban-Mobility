import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import KPICard from '@/components/dashboard/KPI/KPICard.vue'

// Mock Bootstrap
vi.mock('bootstrap', () => ({
  Tooltip: class {
    constructor() {}
    dispose() {}
  }
}))

describe('KPICard.vue', () => {
  const defaultProps = {
    title: 'Gemiddelde snelheid',
    abbreviation: 'AvgV',
    value: 12.5,
    unit: 'm/s',
    unitContext: 'm/s over kruispunt',
    tooltip: 'Test tooltip',
    iconName: 'gauge',
    color: '#4361ee',
    visualType: 'gauge',
    maxValue: 20,
    decimals: 1
  }

  it('renders correctly with gauge visualization', () => {
    const wrapper = mount(KPICard, {
      props: defaultProps
    })

    expect(wrapper.find('.text-uppercase').text()).toBe('Gemiddelde snelheid')
    expect(wrapper.find('h4').text()).toBe('AvgV')
    expect(wrapper.find('.value-text').text()).toBe('12,5')
    expect(wrapper.find('.gauge-svg').exists()).toBe(true)
  })

  it('renders correctly with bar visualization', () => {
    const wrapper = mount(KPICard, {
      props: {
        ...defaultProps,
        visualType: 'bar'
      }
    })

    expect(wrapper.find('.progress').exists()).toBe(true)
    expect(wrapper.find('.progress-bar').attributes('style')).toContain('width: 62.5%')
  })

  it('renders correctly with simple visualization', () => {
    const wrapper = mount(KPICard, {
      props: {
        ...defaultProps,
        visualType: 'simple'
      }
    })

    expect(wrapper.find('.display-value').text()).toBe('12,5')
    expect(wrapper.find('.gauge-svg').exists()).toBe(false)
    expect(wrapper.find('.progress').exists()).toBe(false)
  })

  it('formats Dutch locale numbers correctly with decimals', () => {
    const wrapper = mount(KPICard, {
      props: {
        ...defaultProps,
        value: 1000.51,
        decimals: 2
      }
    })
    // nl-NL format uses dot as thousand separator and comma as decimal
    expect(wrapper.find('.value-text').text()).toBe('1.000,51')
  })

  it('handles non-number values', () => {
    const wrapper = mount(KPICard, {
      props: {
        ...defaultProps,
        value: 'N/A'
      }
    })
    expect(wrapper.find('.value-text').text()).toBe('N/A')
  })

  it('falls back to default icon when iconName is unknown', () => {
    const wrapper = mount(KPICard, {
      props: {
        ...defaultProps,
        iconName: 'unknown-icon'
      }
    })
    // It should render without crashing
    expect(wrapper.find('.icon-wrapper').exists()).toBe(true)
  })
  it('disposes tooltip on unmount', async () => {
    const { Tooltip } = await import('bootstrap')
    const disposeSpy = vi.spyOn(Tooltip.prototype, 'dispose')
    
    const wrapper = mount(KPICard, {
      props: defaultProps
    })
    
    wrapper.unmount()
    expect(disposeSpy).toHaveBeenCalled()
  })
})
