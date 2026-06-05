import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import MetadataInfo from '../../../components/sumo/MetadataInfo.vue'

const makeState = (overrides = {}) => ({
  stats: {
    time: 5000,
    payloadSize: 2048,
    simulateSecs: 0.123,
    snapshotSecs: 0.045,
    vehicleCounts: { passenger: 3, bicycle: 1 },
  },
  clickedPoint: null,
  clickedSumoPoint: null,
  clickedObjects: [],
  clickedVehicleId: null,
  clickedVehicleInfo: null,
  edgesHighlighted: false,
  ...overrides,
})

const makeActions = () => ({
  followObjectPOV: vi.fn(),
  toggleRouteObjectHighlighted: vi.fn(),
})

describe('MetadataInfo.vue', () => {
  it('renders Stats section', () => {
    const wrapper = mount(MetadataInfo, {
      props: { state: makeState(), actions: makeActions() },
    })
    expect(wrapper.text()).toContain('Stats')
  })

  it('displays computed time in seconds', () => {
    const wrapper = mount(MetadataInfo, {
      props: { state: makeState(), actions: makeActions() },
    })
    expect(wrapper.text()).toContain('5.000 s')
  })

  it('displays computed payload in KB', () => {
    const wrapper = mount(MetadataInfo, {
      props: { state: makeState(), actions: makeActions() },
    })
    expect(wrapper.text()).toContain('2.0 KB')
  })

  it('displays simulate ms', () => {
    const wrapper = mount(MetadataInfo, {
      props: { state: makeState(), actions: makeActions() },
    })
    expect(wrapper.text()).toContain('123.00 ms')
  })

  it('displays snapshot ms', () => {
    const wrapper = mount(MetadataInfo, {
      props: { state: makeState(), actions: makeActions() },
    })
    expect(wrapper.text()).toContain('45.00 ms')
  })

  it('renders Vehicle Summary section', () => {
    const wrapper = mount(MetadataInfo, {
      props: { state: makeState(), actions: makeActions() },
    })
    expect(wrapper.text()).toContain('Vehicle Summary')
  })

  it('shows N/A in click summary when no click data', () => {
    const wrapper = mount(MetadataInfo, {
      props: { state: makeState(), actions: makeActions() },
    })
    expect(wrapper.text()).toContain('N/A')
  })

  it('shows clicked lat/lng when clickedPoint is set', () => {
    const state = makeState({ clickedPoint: { lat: 51.123456, lng: 4.654321 } })
    const wrapper = mount(MetadataInfo, {
      props: { state, actions: makeActions() },
    })
    expect(wrapper.text()).toContain('51.123456')
    expect(wrapper.text()).toContain('4.654321')
  })

  it('renders Google Maps and OSM links when clickedPoint is set', () => {
    const state = makeState({ clickedPoint: { lat: 51.1, lng: 4.6 } })
    const wrapper = mount(MetadataInfo, {
      props: { state, actions: makeActions() },
    })
    expect(wrapper.find('a[href*="google.com"]').exists()).toBe(true)
    expect(wrapper.find('a[href*="openstreetmap"]').exists()).toBe(true)
  })

  it('shows SUMO coordinates when clickedSumoPoint is set', () => {
    const state = makeState({ clickedSumoPoint: [12.34, 56.78] })
    const wrapper = mount(MetadataInfo, {
      props: { state, actions: makeActions() },
    })
    expect(wrapper.text()).toContain('12.34')
    expect(wrapper.text()).toContain('56.78')
  })

  it('renders vehicle label from SUPPORTED_VEHICLE_CLASSES', () => {
    const state = makeState({ stats: { time: 0, payloadSize: 0, simulateSecs: 0, snapshotSecs: 0, vehicleCounts: { passenger: 5 } } })
    const wrapper = mount(MetadataInfo, {
      props: { state, actions: makeActions() },
    })
    expect(wrapper.text()).toContain('car(s): 5')
  })

  it('shows clicked objects list when clickedObjects has items', () => {
    const state = makeState({
      clickedObjects: [{ name: 'edge-1', osmId: { type: 'way', id: '123' } }],
    })
    const wrapper = mount(MetadataInfo, {
      props: { state, actions: makeActions() },
    })
    expect(wrapper.text()).toContain('edge-1')
  })

  it('shows Follow and Show Route buttons for supported vehicle objects', () => {
    const state = makeState({
      clickedObjects: [{ name: 'vehicle-1', vClass: 'passenger' }],
    })
    const wrapper = mount(MetadataInfo, {
      props: { state, actions: makeActions() },
    })
    expect(wrapper.text()).toContain('Follow')
    expect(wrapper.text()).toContain('Show Route')
  })

  it('calls followObjectPOV when Follow is clicked', async () => {
    const actions = makeActions()
    const state = makeState({
      clickedObjects: [{ name: 'vehicle-1', vClass: 'passenger' }],
    })
    const wrapper = mount(MetadataInfo, { props: { state, actions } })
    await wrapper.find('button.btn-primary').trigger('click')
    expect(actions.followObjectPOV).toHaveBeenCalledWith('vehicle-1')
  })
})
