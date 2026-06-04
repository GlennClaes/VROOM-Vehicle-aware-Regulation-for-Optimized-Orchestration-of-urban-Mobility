<template>
  <div class="dashboard-sidebar-left d-flex flex-column gap-3">
    <ScenarioCard />
    <StrategyCard />
    <IntervalCard />
    <ControlsCard />
    <LocationDetailsCard />
  </div>
</template>

<script setup>
import ScenarioCard from './DashboardSidebarLeft/ScenarioCard.vue'
import StrategyCard from './DashboardSidebarLeft/StrategyCard.vue'
import IntervalCard from './DashboardSidebarLeft/IntervalCard.vue'
import ControlsCard from './DashboardSidebarLeft/ControlsCard.vue'
import LocationDetailsCard from './DashboardSidebarLeft/LocationDetailsCard.vue'
</script>

<style scoped>
.dashboard-sidebar-left {
  height: 100%;
  overflow-y: auto;
  padding-right: 5px;
}

/* Subtiele scrollbar voor uitsluitend de acties in de linker zijbalk */
.dashboard-sidebar-left::-webkit-scrollbar {
  width: 6px;
}
.dashboard-sidebar-left::-webkit-scrollbar-track {
  background: transparent;
}
.dashboard-sidebar-left::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 4px;
}
.dashboard-sidebar-left::-webkit-scrollbar-thumb:hover {
  background-color: #94a3b8;
}

.btn-check:checked + .btn-outline-primary {
  background-color: #eaf3fd;
  border-color: #0d6efd;
  color: #0d6efd;
}
.btn-check:not(:checked) + .btn-outline-primary {
  border-color: #dee2e6;
  color: #6c757d;
}
</style>
