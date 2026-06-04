<template>
  <div v-if="!user" class="min-vh-100 d-flex align-items-center justify-content-center bg-light">
    <div class="text-center">
      <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;"></div>
      <p class="text-muted">Laden...</p>
    </div>
  </div>

  <div v-else class="vh-100 dashboard-bg d-flex flex-column overflow-hidden">
    <DashboardHeader :user="user" :isRunning="isRunning" @logout="handleLogout" />

    <main class="container-fluid p-4 flex-grow-1 overflow-hidden" style="max-height: calc(100vh - 60px);">
      <div class="row g-4 h-100">
        <div class="col-12 col-lg-3 sidebar-col h-100 pe-1">
          <DashboardSidebarLeft v-if="activeTab !== 'settings'" />
          <div v-else class="text-muted small">Ga naar een simulatie tab om besturing te zien.</div>
        </div>

        <div class="col-12 col-lg-9 h-100 d-flex flex-column overflow-hidden">
          <TabNavigation v-model:activeTab="activeTab" :tabs="tabs" />

          <div ref="tabContentRoot" class="tab-content-root border-top flex-grow-1 d-flex flex-column" :style="{ overflowY: (['KPI', 'settings', 'ai-decisions', 'logs'].includes(activeTab)) ? 'auto' : 'hidden' }">
            <!-- 
              STABILITY LAYERING SYSTEM: 
              We stack Map and KPI tabs on top of each other using z-index and opacity.
              This keeps the TrafficMap iframe 'visible' to the browser at all times,
              ensuring the first simulation start works instantly without suspension.
            -->
            <div class="tab-stack-container">
              
              <!-- Map Layer -->
              <div :class="['tab-stack-layer', { 'layer-active': activeTab === 'map', 'layer-inactive': activeTab !== 'map' }]">
                <TrafficMap :runId="runId" :isRunning="isRunning" />
              </div>

              <!-- KPI Layer -->
              <div :class="['tab-stack-layer', { 'layer-active': activeTab === 'KPI', 'layer-inactive': activeTab !== 'KPI' }]">
                <MetricsDashboard :runId="runId" :isRunning="isRunning" />
              </div>

              <!-- Other Tabs (v-if is fine here as they aren't background-sensitive) -->
              <div v-if="['logs', 'settings', 'comparison', 'ai-decisions'].includes(activeTab)" class="tab-stack-layer layer-active bg-white">
                <LogsViewer v-if="activeTab === 'logs'" :runId="runId" />
                <AccountSettings v-if="activeTab === 'settings'" :user="user" @profile-updated="updateLocalUser" />
                <ModelComparison v-if="activeTab === 'comparison'" />
                <AIDecisions v-if="activeTab === 'ai-decisions'" />
              </div>

            </div>
          </div>
        </div>
      </div>
    </main>

    <SaveRunModal
      v-if="showSaveDialog"
      v-model:runName="runName"
      :runId="runId"
      :scenario="scenario"
      :strategy="strategy"
      @save="handleSaveRun"
      @discard="handleDiscardRun"
    />
  </div>
</template>

<script>
import { useAuthStore } from '../stores/AuthStore.js';
import { Map, BarChart3, FileText, Settings, GitCompare, BrainCircuit } from 'lucide-vue-next';
import { sumoState, hasUserStarted, selectedStrategy, sumoActions, handleStartSimulation } from '../composables/useSumoBridge';

// Components
import DashboardHeader from '@/components/dashboard/DashboardHeader.vue';
import TabNavigation from '@/components/dashboard/TabNavigation.vue';
import SaveRunModal from '@/components/dashboard/SaveSimulationModal.vue';
import DashboardSidebarLeft from '@/components/dashboard/DashboardSidebarLeft.vue';
// Tabs
import TrafficMap from '../components/tabs/TrafficMap.vue';
import MetricsDashboard from '../components/tabs/MetricsDashboard.vue';
import LogsViewer from '../components/tabs/LogsViewer.vue';
import AccountSettings from '../components/tabs/AccountSettings.vue';
import ModelComparison from '../components/tabs/ModelComparison.vue';
import AIDecisions from '../components/tabs/AIDecisions.vue';

export default {
  components: {
    DashboardHeader, TabNavigation, SaveRunModal, DashboardSidebarLeft,
    TrafficMap, MetricsDashboard, LogsViewer, AccountSettings, ModelComparison, AIDecisions
  },
  data() {
    return {
      user: null,
      scenario: '',
      parameters: { simulationSpeed: 1, trafficLightTiming: 30, repetitions: 1 },
      runId: null,
      showSaveDialog: false,
      runName: '',
      activeTab: 'map',
      tabs: [
        { id: 'map', label: 'Verkeerskaart', icon: Map },
        { id: 'KPI', label: 'KPI Dashboard', icon: BarChart3 },
        { id: 'ai-decisions', label: 'AI Beslissingen', icon: BrainCircuit },
        { id: 'logs', label: 'Logs', icon: FileText },
        { id: 'comparison', label: 'Modelvergelijking', icon: GitCompare },
        { id: 'settings', label: 'Instellingen', icon: Settings },
      ]
    };
  },
  setup() { return { authStore: useAuthStore(), hasUserStarted }; },
  async mounted() {
    await this.checkAuth();
    window.addEventListener('switch-tab', this.onSwitchTab);
  },
  unmounted() {
    window.removeEventListener('switch-tab', this.onSwitchTab);
  },
  methods: {
    onSwitchTab(event) {
      if (event.detail) {
        this.activeTab = event.detail;
      }
    },
    async checkAuth() {
      const isValid = await this.authStore.verifySession();
      if (!isValid) {
        await this.authStore.logout();
        this.$router.push('/');
        return;
      }
      const sessionData = this.authStore.session?.value || this.authStore.session;
      this.user = {
        name: sessionData?.user?.username || sessionData?.user?.name || 'Gebruiker',
        email: sessionData?.user?.email || '',
      };
    },
    updateLocalUser(newData) {
      this.user.name = newData.name;
      this.user.email = newData.email;
    },
    async handleLogout() {
      await this.authStore.logout();
      this.$router.push('/');
    },
    handleStartSimulation() {
      if (!this.scenario) return alert('Selecteer eerst een scenario');
      this.runId = this.generateRunId();
      handleStartSimulation();
    },
    generateRunId() {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      return `SIM-${year}${month}${day}-${hours}${minutes}`;
    },
    handleStopSimulation() {
      this.showSaveDialog = true;
    },
    handleSaveRun() {
      this.showSaveDialog = false;
      alert('✅ Simulatie opgeslagen!');
    },
    handleDiscardRun() {
      this.showSaveDialog = false;
      this.runId = null;
    }
  },
  computed: {
    simulationStatus() {
      return sumoState.value?.simulationStatus || 'off';
    },
    strategy() {
      return selectedStrategy.value;
    },
    isRunning() {
      return this.hasUserStarted && (['loading', 'running', 'paused'].includes(this.simulationStatus));
    }
  },
  watch: {
    simulationStatus(newStatus) {
      const activeInSession = this.hasUserStarted;
      
      if (newStatus === 'off') {
        this.runId = null;
      } else if (activeInSession && !this.runId && (newStatus === 'loading' || newStatus === 'running' || newStatus === 'paused')) {
        this.runId = this.generateRunId();
      }
    },
    strategy() {
      // Logic for strategy changes (no tab switch)
    },
    activeTab: {
      handler(newTab) {
        // Reset scroll position when switching tabs
        if (this.$refs.tabContentRoot) {
          this.$refs.tabContentRoot.scrollTop = 0;
        }

        const isMapTab = (newTab === 'map');
        if (sumoActions && sumoActions.setMapVisible) {
           sumoActions.setMapVisible(isMapTab);
        }
      },
      immediate: true
    }
  }
};
</script>

<style scoped>
.dashboard-bg {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  height: 100vh;
}

.tab-content-root {
  min-height: 600px;
}

/* 
  Container that stacks tabs.
  Using a grid where all children occupy the first cell.
*/
.tab-stack-container {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  flex-grow: 1;
  padding-top: 1rem;
  min-height: 0;
}

.tab-stack-layer {
  grid-area: 1 / 1 / 2 / 2;
  transition: opacity 0.2s ease-in-out;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.layer-active {
  opacity: 1;
  z-index: 2;
  visibility: visible;
  pointer-events: auto;
}

.layer-inactive {
  opacity: 0;
  z-index: 1;
  visibility: hidden;
  pointer-events: none;
}
</style>
