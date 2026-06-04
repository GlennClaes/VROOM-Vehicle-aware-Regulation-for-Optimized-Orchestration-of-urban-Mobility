import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import Sidebar from '../../../components/sumo/Sidebar.vue'

const makeState = (overrides = {}) => ({
  availableScenarios: [
    { kebabCase: 'scenario-a', displayName: 'Scenario A' },
    { kebabCase: 'scenario-b', displayName: 'Scenario B' },
  ],
  scenario: 'scenario-a',
  simulationStatus: 'off',
  isLoading: false,
  delayMs: 150,
  followingVehicle: null,
  isProjection: false,
  searchBoxErrorMessage: '',
  stats: {
    time: 0,
    payloadSize: 0,
    simulateSecs: 0,
    snapshotSecs: 0,
    vehicleCounts: {},
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
  changeScenario: vi.fn(),
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
  pauseSimulation: vi.fn(),
  resumeSimulation: vi.fn(),
  changeDelay: vi.fn(),
  unfollowObjectPOV: vi.fn(),
  handleSearch: vi.fn(),
  deselectSearch: vi.fn(),
  focusOnVehicleOfClass: vi.fn(),
  focusOnTrafficLight: vi.fn(),
  followObjectPOV: vi.fn(),
  toggleRouteObjectHighlighted: vi.fn(),
})

describe('Sidebar.vue (sumo)', () => {
  it('renders the sidebar container', () => {
    const wrapper = mount(Sidebar, {
      props: { state: makeState(), actions: makeActions() },
    })
    expect(wrapper.find('.sidebar-container').exists()).toBe(true)
  })

  it('shows restart button when simulationStatus is off', () => {
    const wrapper = mount(Sidebar, {
      props: { state: makeState({ simulationStatus: 'off' }), actions: makeActions() },
    })
    expect(wrapper.text()).toContain('restart')
  })

  it('shows cancel button when simulationStatus is running', () => {
    const wrapper = mount(Sidebar, {
      props: { state: makeState({ simulationStatus: 'running' }), actions: makeActions() },
    })
    expect(wrapper.text()).toContain('cancel')
  })

  it('shows pause button when simulationStatus is running', () => {
    const wrapper = mount(Sidebar, {
      props: { state: makeState({ simulationStatus: 'running' }), actions: makeActions() },
    })
    expect(wrapper.text()).toContain('pause')
  })

  it('shows resume button when simulationStatus is paused', () => {
    const wrapper = mount(Sidebar, {
      props: { state: makeState({ simulationStatus: 'paused' }), actions: makeActions() },
    })
    expect(wrapper.text()).toContain('resume')
  })

  it('calls startSimulation when restart is clicked', async () => {
    const actions = makeActions()
    const wrapper = mount(Sidebar, {
      props: { state: makeState({ simulationStatus: 'off' }), actions },
    })
    await wrapper.find('button.btn-primary').trigger('click')
    expect(actions.startSimulation).toHaveBeenCalled()
  })

  it('calls cancelSimulation when cancel is clicked', async () => {
    const actions = makeActions()
    const wrapper = mount(Sidebar, {
      props: { state: makeState({ simulationStatus: 'running' }), actions },
    })
    await wrapper.find('button.btn-primary').trigger('click')
    expect(actions.cancelSimulation).toHaveBeenCalled()
  })

  it('shows Unfollow button when followingVehicle is set', () => {
    const wrapper = mount(Sidebar, {
      props: { state: makeState({ followingVehicle: 'car-1' }), actions: makeActions() },
    })
    expect(wrapper.text()).toContain('Unfollow')
  })

  it('does not show Unfollow button when not following', () => {
    const wrapper = mount(Sidebar, {
      props: { state: makeState({ followingVehicle: null }), actions: makeActions() },
    })
    expect(wrapper.text()).not.toContain('Unfollow')
  })

  it('calls unfollowObjectPOV when Unfollow is clicked', async () => {
    const actions = makeActions()
    const wrapper = mount(Sidebar, {
      props: { state: makeState({ followingVehicle: 'car-1' }), actions },
    })
    const unfollowBtn = wrapper.findAll('button').find(b => b.text() === 'Unfollow')
    await unfollowBtn.trigger('click')
    expect(actions.unfollowObjectPOV).toHaveBeenCalled()
  })

  it('renders a speed slider', () => {
    const wrapper = mount(Sidebar, {
      props: { state: makeState(), actions: makeActions() },
    })
    expect(wrapper.find('input[type="range"]').exists()).toBe(true)
  })

  it('calls changeDelay when slider is moved', async () => {
    const actions = makeActions()
    const wrapper = mount(Sidebar, {
      props: { state: makeState(), actions },
    })
    const slider = wrapper.find('input[type="range"]')
    await slider.setValue(50)
    await slider.trigger('input')
    expect(actions.changeDelay).toHaveBeenCalled()
  })

  it('shows the Light button in quick focus', () => {
    const wrapper = mount(Sidebar, {
      props: { state: makeState(), actions: makeActions() },
    })
    expect(wrapper.text()).toContain('Light')
  })

  it('calls pauseSimulation when pause is clicked', async () => {
    const actions = makeActions()
    const wrapper = mount(Sidebar, {
      props: { state: makeState({ simulationStatus: 'running' }), actions },
    })
    const pauseBtn = wrapper.findAll('button').find(b => b.text() === 'pause')
    await pauseBtn.trigger('click')
    expect(actions.pauseSimulation).toHaveBeenCalled()
  })

  it('calls resumeSimulation when resume is clicked', async () => {
    const actions = makeActions()
    const wrapper = mount(Sidebar, {
      props: { state: makeState({ simulationStatus: 'paused' }), actions },
    })
    const resumeBtn = wrapper.findAll('button').find(b => b.text() === 'resume')
    await resumeBtn.trigger('click')
    expect(actions.resumeSimulation).toHaveBeenCalled()
  })

  it('calls focusOnVehicleOfClass when class button is clicked', async () => {
    const actions = makeActions()
    const state = makeState({ 
      stats: { vehicleCounts: { passenger: 5 } } 
    })
    const wrapper = mount(Sidebar, {
      props: { state, actions },
    })
    const carBtn = wrapper.findAll('button').find(b => b.text() === 'car')
    await carBtn.trigger('click')
    expect(actions.focusOnVehicleOfClass).toHaveBeenCalledWith('passenger')
  })

  it('watches delayMs and updates localSlider', async () => {
    const wrapper = mount(Sidebar, {
      props: { state: makeState({ delayMs: 150 }), actions: makeActions() },
    })
    // 150ms is middle of 300ms, so slider should be ~50
    expect(wrapper.vm.localSlider).toBe(50)
    
    await wrapper.setProps({ state: makeState({ delayMs: 0 }) })
    expect(wrapper.vm.localSlider).toBe(99)
  })
})
