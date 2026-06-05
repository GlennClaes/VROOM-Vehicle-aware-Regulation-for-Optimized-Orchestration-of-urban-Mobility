import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'

vi.mock('@/composables/useSumoBridge', () => {
  const { ref, shallowRef } = require('vue')
  return {
    aiDecisionHistory: shallowRef([]),
    selectedStrategy: ref('baseline')
  }
})

import AIDecisions from '@/components/tabs/AIDecisions.vue'
import { aiDecisionHistory, selectedStrategy } from '@/composables/useSumoBridge'

const stubs = {
  ArrowRight: true,
  BrainCircuit: true,
  ChevronLeft: true,
  ChevronRight: true,
  Clock3: true
}

function decision(overrides = {}) {
  return {
    id: `${overrides.timestep ?? 10}-${overrides.tlsId ?? 'tls-a'}-${overrides.action ?? 1}`,
    timestep: 10,
    time: 10,
    tlsId: 'tls-a',
    action: 1,
    aiPhaseIndex: 1,
    previousPhaseIndex: 0,
    targetPhaseIndex: 1,
    currentSumoPhase: 0,
    targetSumoPhase: 1,
    switched: true,
    yellowTransition: false,
    status: 'switching_yellow',
    queueEstimate: 4,
    vehicleEstimate: 6,
    waitingTimeEstimate: 12,
    model: '',
    strategy: 'sam',
    fallback: false,
    error: null,
    ...overrides
  }
}

describe('AIDecisions.vue', () => {
  beforeEach(() => {
    aiDecisionHistory.value = []
    selectedStrategy.value = 'baseline'
  })

  it('shows empty state and baseline hint without AI decisions', () => {
    const wrapper = mount(AIDecisions, { global: { stubs } })

    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('Nog geen AI-beslissingen')
    expect(wrapper.text()).toContain('Selecteer SAM Model')
    expect(wrapper.text()).toContain('0 beslissingen')
  })

  it('shows SAM hint when SAM strategy is selected but no decisions exist', () => {
    selectedStrategy.value = 'sam'

    const wrapper = mount(AIDecisions, { global: { stubs } })

    expect(wrapper.text()).toContain('Navigeer door de timesteps')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('renders the latest timestep with summaries, badges and formatted values', () => {
    selectedStrategy.value = 'sam'
    aiDecisionHistory.value = [
      decision({ id: '10-tls-a-1', timestep: 10, time: 10, tlsId: 'tls-a', action: 1, model: '' }),
      decision({
        id: '20-tls-b-3',
        timestep: 20,
        time: 20,
        tlsId: 'tls-b',
        action: 3,
        previousPhaseIndex: 1,
        targetPhaseIndex: 2,
        queueEstimate: 8,
        waitingTimeEstimate: 42,
        yellowTransition: true,
        fallback: true,
        model: '/models/dqn_best.pt'
      }),
      decision({
        id: '20-tls-a-2',
        timestep: 20,
        time: 20,
        tlsId: 'tls-a',
        action: 2,
        previousPhaseIndex: null,
        targetPhaseIndex: null,
        switched: false,
        queueEstimate: 2,
        waitingTimeEstimate: 0
      })
    ]

    const wrapper = mount(AIDecisions, { global: { stubs } })

    expect(wrapper.find('.empty-state').exists()).toBe(false)
    expect(wrapper.text()).toContain('20')
    expect(wrapper.text()).toContain('3 beslissingen')
    expect(wrapper.text()).toContain('dqn_best.pt')
    expect(wrapper.text()).toContain('5,0 veh')
    expect(wrapper.text()).toContain('F1')
    expect(wrapper.text()).toContain('F2')
    expect(wrapper.text()).toContain('-')
    expect(wrapper.text()).toContain('Wissel')
    expect(wrapper.text()).toContain('Behoud')
    expect(wrapper.text()).toContain('Geel')
    expect(wrapper.text()).toContain('Fallback')
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
  })

  it('navigates between timesteps and falls back to SAM model label', async () => {
    selectedStrategy.value = 'sam'
    aiDecisionHistory.value = [
      decision({ id: '10-tls-a-1', timestep: 10, time: 10, tlsId: 'tls-a', action: 1, model: '' }),
      decision({ id: '20-tls-b-2', timestep: 20, time: 20, tlsId: 'tls-b', action: 2, model: '' })
    ]

    const wrapper = mount(AIDecisions, { global: { stubs } })
    const buttons = wrapper.findAll('button')

    expect(wrapper.text()).toContain('20')
    expect(buttons[1].attributes('disabled')).toBeDefined()

    await buttons[0].trigger('click')

    expect(wrapper.text()).toContain('10')
    expect(wrapper.text()).toContain('SAM')
    expect(buttons[0].attributes('disabled')).toBeDefined()

    await buttons[1].trigger('click')

    expect(wrapper.text()).toContain('20')
  })

  it('preserves manual timestep selection when a newer timestep arrives', async () => {
    aiDecisionHistory.value = [
      decision({ id: '10-tls-a-1', timestep: 10, time: 10, tlsId: 'tls-a' }),
      decision({ id: '20-tls-a-1', timestep: 20, time: 20, tlsId: 'tls-a' })
    ]

    const wrapper = mount(AIDecisions, { global: { stubs } })
    await wrapper.findAll('button')[0].trigger('click')
    expect(wrapper.text()).toContain('10')

    aiDecisionHistory.value = [
      ...aiDecisionHistory.value,
      decision({ id: '30-tls-a-1', timestep: 30, time: 30, tlsId: 'tls-a' })
    ]
    await nextTick()

    expect(wrapper.text()).toContain('10')

    aiDecisionHistory.value = [
      decision({ id: '30-tls-a-1', timestep: 30, time: 30, tlsId: 'tls-a' })
    ]
    await nextTick()

    expect(wrapper.text()).toContain('30')
  })

  it('updates selectedTimestepIndex when input range changes', async () => {
    aiDecisionHistory.value = [
      decision({ id: '10-tls-a-1', timestep: 10, time: 10, tlsId: 'tls-a' }),
      decision({ id: '20-tls-a-1', timestep: 20, time: 20, tlsId: 'tls-a' }),
      decision({ id: '30-tls-a-1', timestep: 30, time: 30, tlsId: 'tls-a' })
    ]
    const wrapper = mount(AIDecisions, { global: { stubs } })
    const rangeInput = wrapper.find('input[type="range"]')
    await rangeInput.setValue('1')
    expect(wrapper.vm.selectedTimestepIndex).toBe(1)
    expect(wrapper.text()).toContain('20')
  })

  it('caps selectedTimestepIndex when new timesteps array is smaller than current index', async () => {
    aiDecisionHistory.value = [
      decision({ id: '10-tls-a-1', timestep: 10, time: 10, tlsId: 'tls-a' }),
      decision({ id: '20-tls-a-1', timestep: 20, time: 20, tlsId: 'tls-a' }),
      decision({ id: '30-tls-a-1', timestep: 30, time: 30, tlsId: 'tls-a' })
    ]
    const wrapper = mount(AIDecisions, { global: { stubs } })
    
    // Set to index 2
    wrapper.vm.selectedTimestepIndex = 2
    await nextTick()

    // Provide a completely new and smaller array
    aiDecisionHistory.value = [
      decision({ id: '5-tls-a-1', timestep: 5, time: 5, tlsId: 'tls-a' }),
      decision({ id: '6-tls-a-1', timestep: 6, time: 6, tlsId: 'tls-a' })
    ]
    await nextTick()
    
    expect(wrapper.vm.selectedTimestepIndex).toBe(1)
    expect(wrapper.text()).toContain('6')
  })
})
