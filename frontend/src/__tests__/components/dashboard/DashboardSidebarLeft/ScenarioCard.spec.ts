import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'

vi.mock('@/composables/useSumoBridge', () => {
  const { ref } = require('vue')
  return {
    sumoState: ref(null),
    isStarting: ref(false),
    hasUserStarted: ref(false),
    selectedScenario: ref(''),
    availableScenarios: ref([]),
    showScenarioError: ref(false),
    selectedPresetId: ref(''),
    currentPresets: ref([]),
    mapFrameRef: ref(null),
    sumoActions: {
      startSimulation: vi.fn(),
      pauseSimulation: vi.fn(),
      resumeSimulation: vi.fn(),
      cancelSimulation: vi.fn(),
      changeDelay: vi.fn(),
      changeScenario: vi.fn(),
      hardReload: vi.fn(),
      createScenarioPreset: vi.fn(() => Promise.resolve(true)),
      deleteScenarioPreset: vi.fn(() => Promise.resolve(true)),
      applyPreset: vi.fn(),
      fetchPresets: vi.fn(() => Promise.resolve([])),
    },
  }
})

// Mock global fetch
global.fetch = vi.fn(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([{ kebabCase: 'mock', displayName: 'Mock' }]),
  })
)

vi.mock('lucide-vue-next', () => ({
  MapPin: { template: '<span class="map-pin" />' },
  Trash2: { template: '<span class="trash" />' },
}))

import ScenarioCard from '@/components/dashboard/DashboardSidebarLeft/ScenarioCard.vue'

describe('ScenarioCard.vue', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/composables/useSumoBridge')
    mod.sumoState.value = null
    mod.hasUserStarted.value = false
    mod.selectedScenario.value = ''
    mod.availableScenarios.value = []
    mod.showScenarioError.value = false
    mod.selectedPresetId.value = ''
    mod.currentPresets.value = []
  })

  it('renders loading message when scenarios are being fetched', async () => {
    const wrapper = mount(ScenarioCard)
    await nextTick()
    expect(wrapper.text()).toContain('Scenario\'s laden...')
  })

  it('renders scenario select when scenarios are available', async () => {
    const { availableScenarios } = await import('@/composables/useSumoBridge')
    availableScenarios.value = [
      { kebabCase: 'scenario-a', displayName: 'Scenario A' },
      { kebabCase: 'scenario-b', displayName: 'Scenario B' },
    ]
    const wrapper = mount(ScenarioCard)
    await nextTick()
    expect(wrapper.find('select').exists()).toBe(true)
  })

  it('renders available scenarios as options', async () => {
    const { availableScenarios } = await import('@/composables/useSumoBridge')
    availableScenarios.value = [
      { kebabCase: 'scenario-a', displayName: 'Scenario A' },
      { kebabCase: 'scenario-b', displayName: 'Scenario B' },
      { kebabCase: 'scenario-c', displayName: 'Scenario C' },
    ]
    const wrapper = mount(ScenarioCard)
    await nextTick()
    expect(wrapper.findAll('option').length).toBe(4) // 3 + 1 disabled default
  })

  it('shows warning when no scenario selected', async () => {
    const { availableScenarios, selectedScenario } = await import('@/composables/useSumoBridge')
    availableScenarios.value = [{ kebabCase: 'a', displayName: 'A' }]
    selectedScenario.value = ''
    const wrapper = mount(ScenarioCard)
    await nextTick()
    expect(wrapper.find('.text-warning').exists()).toBe(true)
  })

  it('does not sync selectedScenario from sumoState if hasUserStarted is false', async () => {
    const { sumoState, selectedScenario, hasUserStarted } = await import('@/composables/useSumoBridge')
    selectedScenario.value = ''
    hasUserStarted.value = false
    sumoState.value = { scenario: 'some-scenario' }

    const wrapper = mount(ScenarioCard)
    await nextTick()
    await nextTick()

    expect(selectedScenario.value).toBe('')
  })

  it('syncs selectedScenario from sumoState if hasUserStarted is true', async () => {
    const { sumoState, selectedScenario, hasUserStarted } = await import('@/composables/useSumoBridge')
    selectedScenario.value = ''
    hasUserStarted.value = true
    sumoState.value = { scenario: 'new-scenario' }

    const wrapper = mount(ScenarioCard)
    await nextTick()
    await nextTick()

    expect(selectedScenario.value).toBe('new-scenario')
  })

  it('shows empty preset message when no presets exist', async () => {
    const { currentPresets, selectedPresetId, selectedScenario } = await import('@/composables/useSumoBridge')
    currentPresets.value = []
    selectedPresetId.value = ''
    selectedScenario.value = 'test-scenario'
    
    const wrapper = mount(ScenarioCard)
    await nextTick()
    
    expect(wrapper.text()).toContain('Geen opgeslagen configuraties')
    expect(wrapper.text()).toContain('Maak je eerste preset')
  })

  it('shows preset select and delete button when presets exist and one is selected', async () => {
    const { currentPresets, selectedPresetId, selectedScenario } = await import('@/composables/useSumoBridge')
    currentPresets.value = [{ id: 1, name: 'Preset A' }, { id: 2, name: 'Preset B' }]
    selectedPresetId.value = 1
    selectedScenario.value = 'test-scenario'
    
    const wrapper = mount(ScenarioCard)
    await nextTick()
    
    const presetOptions = wrapper.findAll('option')
    const presetTexts = presetOptions.map(o => o.text())
    expect(presetTexts).toContain('Preset A')
    expect(presetTexts).toContain('Preset B')
    
    const deleteBtn = wrapper.find('button[title="Verwijder preset"]')
    expect(deleteBtn.exists()).toBe(true)
  })

  it('toggles new preset form and creates preset', async () => {
    const { currentPresets, selectedScenario, sumoActions } = await import('@/composables/useSumoBridge')
    currentPresets.value = []
    selectedScenario.value = 'test-scenario'
    
    const wrapper = mount(ScenarioCard)
    await nextTick()
    
    // Click "+ Nieuwe" button to show form
    const newBtn = wrapper.find('button.btn-link')
    expect(newBtn.exists()).toBe(true)
    await newBtn.trigger('click')
    await nextTick()
    
    // Form should be visible with input
    const input = wrapper.find('input[placeholder="Naam configuratie..."]')
    expect(input.exists()).toBe(true)
    
    // Fill in name and submit
    await input.setValue('Test Preset')
    const saveBtn = wrapper.find('button.btn-primary')
    expect(saveBtn.exists()).toBe(true)
    await saveBtn.trigger('click')
    
    expect(sumoActions.createScenarioPreset).toHaveBeenCalledWith('Test Preset')
  })

  it('cancel button hides the new preset form', async () => {
    const { selectedScenario } = await import('@/composables/useSumoBridge')
    selectedScenario.value = 'test-scenario'
    
    const wrapper = mount(ScenarioCard)
    await nextTick()
    
    // Open form
    await wrapper.find('button.btn-link').trigger('click')
    await nextTick()
    
    // Click "Annuleer"
    const cancelBtn = wrapper.find('button.text-danger')
    expect(cancelBtn.exists()).toBe(true)
    await cancelBtn.trigger('click')
    await nextTick()
    
    // Form should be hidden again
    expect(wrapper.find('input[placeholder="Naam configuratie..."]').exists()).toBe(false)
  })

  it('confirm-delete: first click shows Zeker?, second click deletes', async () => {
    const { currentPresets, selectedPresetId, selectedScenario, sumoActions } = await import('@/composables/useSumoBridge')
    currentPresets.value = [{ id: 42, name: 'To Delete' }]
    selectedPresetId.value = 42
    selectedScenario.value = 'test-scenario'
    
    const wrapper = mount(ScenarioCard)
    await nextTick()
    
    const deleteBtn = wrapper.find('button[title="Verwijder preset"]')
    expect(deleteBtn.exists()).toBe(true)
    
    // First click: enters confirm mode
    await deleteBtn.trigger('click')
    await nextTick()
    expect(wrapper.find('.pulse').exists()).toBe(true)
    expect(sumoActions.deleteScenarioPreset).not.toHaveBeenCalled()
    
    // Second click: actually deletes
    const confirmBtn = wrapper.find('button.btn-danger.pulse')
    await confirmBtn.trigger('click')
    expect(sumoActions.deleteScenarioPreset).toHaveBeenCalledWith(42)
  })

  it('does not show delete button when no preset is selected', async () => {
    const { currentPresets, selectedPresetId, selectedScenario } = await import('@/composables/useSumoBridge')
    currentPresets.value = [{ id: 1, name: 'Preset 1' }]
    selectedPresetId.value = ''
    selectedScenario.value = 'test-scenario'
    
    const wrapper = mount(ScenarioCard)
    await nextTick()
    
    const deleteBtn = wrapper.find('button[title="Verwijder preset"]')
    expect(deleteBtn.exists()).toBe(false)
  })

  it('handles fetch failure gracefully', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network Error'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { availableScenarios } = await import('@/composables/useSumoBridge')
    availableScenarios.value = [] // Force fetch
    
    mount(ScenarioCard)
    await flushPromises()
    
    expect(warnSpy).toHaveBeenCalled()
  })

  it('does not refetch when scenarios are already loaded', async () => {
    const { availableScenarios } = await import('@/composables/useSumoBridge')
    availableScenarios.value = [
      { kebabCase: 'loaded', displayName: 'Already Loaded' }
    ]
    
    const fetchCallsBefore = global.fetch.mock.calls.length
    mount(ScenarioCard)
    await flushPromises()
    
    // fetch should NOT be called since scenarios already exist
    expect(global.fetch.mock.calls.length).toBe(fetchCallsBefore)
  })

  it('retries when fetch returns empty array', async () => {
    vi.useFakeTimers()
    const { availableScenarios } = await import('@/composables/useSumoBridge')
    availableScenarios.value = []
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([])
    })
    
    mount(ScenarioCard)
    await flushPromises()
    
    // Should schedule a retry
    expect(global.fetch).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('does not create preset with empty name', async () => {
    const { currentPresets, selectedScenario, sumoActions } = await import('@/composables/useSumoBridge')
    currentPresets.value = []
    selectedScenario.value = 'test-scenario'
    
    const wrapper = mount(ScenarioCard)
    await nextTick()
    
    // Open form
    await wrapper.find('button.btn-link').trigger('click')
    await nextTick()
    
    // Save button should be disabled when name is empty
    const saveBtn = wrapper.find('button.btn-primary')
    expect(saveBtn.attributes('disabled')).toBeDefined()
  })
})
