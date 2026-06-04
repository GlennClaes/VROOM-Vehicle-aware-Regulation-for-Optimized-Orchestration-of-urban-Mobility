import { describe, it, beforeEach, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import { useAuthStore } from '@/stores/AuthStore.js'
import * as SumoBridge from '../../composables/useSumoBridge'

// Gebruik vi.mock maar behoud reactiviteit voor de refs die we willen testen
vi.mock('../../composables/useSumoBridge', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    handleStartSimulation: vi.fn(),
    sumoActions: {
      ...actual.sumoActions,
      setMapVisible: vi.fn(),
    }
  }
})

const routes = [
  { path: '/', component: { template: '<div />' } },
  { path: '/dashboard', component: DashboardView }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

describe('DashboardView', () => {
  let pinia
  let authStore

  beforeEach(async () => {
    pinia = createPinia()
    setActivePinia(pinia)

    // Reset singleton state
    SumoBridge.hasUserStarted.value = false
    SumoBridge.sumoState.value = { simulationStatus: 'off' }

    authStore = useAuthStore()
    authStore.verifySession = vi.fn().mockResolvedValue(true)
    authStore.logout = vi.fn()
    authStore.session = { user: { name: 'Test User', email: 'test@example.com' } }

    router.push('/dashboard')
    await router.isReady()
    vi.clearAllMocks()
  })

  const factory = (options = {}) => {
    return mount(DashboardView, {
      global: {
        plugins: [pinia, router],
        stubs: {
          DashboardHeader: true,
          TabNavigation: true,
          SaveRunModal: true,
          DashboardSidebarLeft: true,
          TrafficMap: true,
          MetricsDashboard: true,
          AIDecisions: true,
          LogsViewer: true,
          AccountSettings: true,
          ModelComparison: true
        }
      },
      ...options
    })
  }

  it('redirects to login when not authenticated', async () => {
    authStore.verifySession.mockResolvedValue(false)
    authStore.session = null
    const pushSpy = vi.spyOn(router, 'push')
    factory()
    await flushPromises()
    expect(pushSpy).toHaveBeenCalledWith('/')
  })

  it('updates local user after profile update', async () => {
    const wrapper = factory()
    await flushPromises()
    wrapper.vm.updateLocalUser({ name: 'NewName', email: 'new@test.com' })
    expect(wrapper.vm.user.name).toBe('NewName')
  })

  it('handleLogout logs out and redirects', async () => {
    const pushSpy = vi.spyOn(router, 'push')
    const wrapper = factory()
    await flushPromises()
    await wrapper.vm.handleLogout()
    expect(authStore.logout).toHaveBeenCalled()
    expect(pushSpy).toHaveBeenCalledWith('/')
  })

  it('handleStartSimulation starts simulation and generates runId', async () => {
    const wrapper = factory()
    await flushPromises()
    wrapper.vm.scenario = 'Centrum'
    wrapper.vm.handleStartSimulation()
    expect(SumoBridge.handleStartSimulation).toHaveBeenCalled()
    expect(wrapper.vm.runId).not.toBeNull()
  })

  it('stops simulation and opens save dialog', async () => {
    const wrapper = factory()
    await flushPromises()
    wrapper.vm.handleStopSimulation()
    expect(wrapper.vm.showSaveDialog).toBe(true)
  })

  it('handleSaveRun and handleDiscardRun logic', async () => {
    const wrapper = factory()
    await flushPromises()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    wrapper.vm.showSaveDialog = true
    wrapper.vm.handleSaveRun()
    expect(wrapper.vm.showSaveDialog).toBe(false)
    expect(alertSpy).toHaveBeenCalled()

    wrapper.vm.runId = 'id'
    wrapper.vm.handleDiscardRun()
    expect(wrapper.vm.runId).toBeNull()
  })

  it('resets runId when simulationStatus becomes off', async () => {
    const wrapper = factory()
    await flushPromises()
    wrapper.vm.runId = 'run123'
    SumoBridge.sumoState.value = { simulationStatus: 'off' }
    // Manually trigger if reactive chain is broken in test environment
    if (wrapper.vm.$options.watch && wrapper.vm.$options.watch.simulationStatus) {
      wrapper.vm.$options.watch.simulationStatus.call(wrapper.vm, 'off')
    }
    await flushPromises()
    expect(wrapper.vm.runId).toBeNull()
  })

  it('generates runId when simulationStatus becomes running if missing', async () => {
    const wrapper = factory()
    await flushPromises()
    SumoBridge.hasUserStarted.value = true
    wrapper.vm.runId = null
    SumoBridge.sumoState.value = { simulationStatus: 'running' }
    await flushPromises()
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.runId).not.toBeNull()
  })

  it('resets scroll on tab change', async () => {
    const wrapper = factory()
    await flushPromises()
    
    // Set scroll top on the real element
    const el = wrapper.find('.tab-content-root').element
    el.scrollTop = 100
    
    wrapper.vm.activeTab = 'KPI'
    await wrapper.vm.$nextTick()
    
    expect(el.scrollTop).toBe(0)
    expect(SumoBridge.sumoActions.setMapVisible).toHaveBeenCalledWith(false)
  })

  it('generates runId in correct format', () => {
    const wrapper = factory()
    const id = wrapper.vm.generateRunId()
    expect(id).toMatch(/^SIM-\d{8}-\d{4}/)
  })

  it('handles switch-tab custom event', async () => {
    const wrapper = factory()
    await flushPromises()

    window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'KPI' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.activeTab).toBe('KPI')
  })

  it('handles switch-tab event without detail', async () => {
    const wrapper = factory()
    await flushPromises()

    wrapper.vm.activeTab = 'map'
    window.dispatchEvent(new CustomEvent('switch-tab', {}))
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.activeTab).toBe('map')
  })

  it('removes event listener on unmount', async () => {
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener')
    const wrapper = factory()
    await flushPromises()

    wrapper.unmount()
    expect(removeListenerSpy).toHaveBeenCalledWith('switch-tab', expect.any(Function))
  })

  it('shows SaveRunModal when showSaveDialog is true', async () => {
    const wrapper = factory()
    await flushPromises()

    wrapper.vm.showSaveDialog = true
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent({ name: 'SaveRunModal' }).exists() || 
           wrapper.find('save-run-modal-stub').exists()).toBe(true)
  })

  it('hides sidebar when activeTab is settings', async () => {
    const wrapper = factory()
    await flushPromises()

    wrapper.vm.activeTab = 'settings'
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Ga naar een simulatie tab om besturing te zien')
  })

  it('calls setMapVisible(true) when switching to map tab', async () => {
    const wrapper = factory()
    await flushPromises()

    wrapper.vm.activeTab = 'KPI'
    await wrapper.vm.$nextTick()
    
    wrapper.vm.activeTab = 'map'
    await wrapper.vm.$nextTick()

    expect(SumoBridge.sumoActions.setMapVisible).toHaveBeenCalledWith(true)
  })
})
