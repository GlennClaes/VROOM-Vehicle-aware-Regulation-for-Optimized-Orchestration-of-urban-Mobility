import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import KPIEmptyState from '@/components/dashboard/KPI/KPIEmptyState.vue'

const vi_bridge = vi.hoisted(() => ({
  handleStartSimulation: vi.fn(),
  isStarting: { value: false, __v_isRef: true }
}))

vi.mock('@/composables/useSumoBridge', () => vi_bridge)

describe('KPIEmptyState.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi_bridge.isStarting.value = false
  })

  it('renders correctly', () => {
    const wrapper = mount(KPIEmptyState)
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('h6').text()).toBe('Geen actieve simulatie')
  })

  it('calls handleStartSimulation when the button is clicked', async () => {
    const wrapper = mount(KPIEmptyState)
    const button = wrapper.find('button')
    
    expect(button.element.disabled).toBe(false)
    
    await button.trigger('click')
    expect(vi_bridge.handleStartSimulation).toHaveBeenCalled()
  })

  it('shows loading state when isStarting is true', async () => {
    vi_bridge.isStarting.value = true
    const wrapper = mount(KPIEmptyState)
    const button = wrapper.find('button')
    
    expect(button.element.disabled).toBe(true)
    expect(wrapper.text()).toContain('Laden...')
  })
})
