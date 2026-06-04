import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

// Mock useSumoBridge
vi.mock('@/composables/useSumoBridge', async () => {
  const { ref } = await import('vue')
  return {
    clickedPoint: ref(null),
    sumoActions: {
      cancelSimulation: vi.fn(),
    }
  }
})

// Mock lucide-vue-next
vi.mock('lucide-vue-next', () => ({
  MapPin: { template: '<span class="map-pin-icon" />' },
  ExternalLink: { template: '<span class="external-link-icon" />' },
  Copy: { template: '<span class="copy-icon" />' },
}))

import LocationDetailsCard from '@/components/dashboard/DashboardSidebarLeft/LocationDetailsCard.vue'

describe('LocationDetailsCard.vue', () => {
  beforeEach(async () => {
    const { clickedPoint } = await import('@/composables/useSumoBridge')
    clickedPoint.value = null
    vi.clearAllMocks()

    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    })
  })

  it('renders nothing when clickedPoint is null and handles computed/methods safely', async () => {
    const wrapper = mount(LocationDetailsCard)
    expect(wrapper.find('.card').exists()).toBe(false)
    
    // Test computed properties directly when null
    expect(wrapper.vm.googleMapsUrl).toBe('#')
    expect(wrapper.vm.osmUrl).toBe('#')
    
    // Test copyToClipboard directly when null
    wrapper.vm.copyToClipboard()
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('renders coordinates correctly when clickedPoint is set', async () => {
    const { clickedPoint } = await import('@/composables/useSumoBridge')
    clickedPoint.value = { lat: 51.2194, lng: 4.4025 }

    const wrapper = mount(LocationDetailsCard)
    await nextTick()

    expect(wrapper.find('.card').exists()).toBe(true)
    expect(wrapper.text()).toContain('51.21940')
    expect(wrapper.text()).toContain('4.40250')
  })

  it('generates correct Google Maps and OSM links', async () => {
    const { clickedPoint } = await import('@/composables/useSumoBridge')
    clickedPoint.value = { lat: 51.2194, lng: 4.4025 }

    const wrapper = mount(LocationDetailsCard)
    await nextTick()

    const links = wrapper.findAll('a')
    expect(links[0].attributes('href')).toContain('google.com/maps')
    expect(links[0].attributes('href')).toContain('51.2194')

    expect(links[1].attributes('href')).toContain('openstreetmap.org')
    expect(links[1].attributes('href')).toContain('mlat=51.2194')
  })

  it('copies coordinates to clipboard when copy button is clicked', async () => {
    const { clickedPoint } = await import('@/composables/useSumoBridge')
    clickedPoint.value = { lat: 51.2194, lng: 4.4025 }

    const wrapper = mount(LocationDetailsCard)
    await nextTick()

    const copyBtn = wrapper.find('button')
    await copyBtn.trigger('click')

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('51.219400, 4.402500')
  })
})
