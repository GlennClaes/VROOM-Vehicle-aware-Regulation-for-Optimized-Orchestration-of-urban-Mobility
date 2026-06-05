<template>
  <div class="cabinet-telemetry-container">
    <h3 class="telemetry-title">
      <span class="icon">📡</span> Live VROOM Edge Telemetry
    </h3>
    
    <div class="cabinet-grid">
      <div 
        v-for="cabinet in cabinets" 
        :key="cabinet.intersection_id" 
        class="cabinet-card"
        :class="{ 'is-online': cabinet.status === 'Online', 'is-failed': cabinet.health_status.startsWith('failed') }"
      >
        <div class="card-header">
          <h4 class="cabinet-id">{{ cabinet.intersection_id }}</h4>
          <span class="status-badge" :class="cabinet.status.toLowerCase()">
            <span class="pulse-dot" v-if="cabinet.status === 'Online'"></span>
            {{ cabinet.status }}
          </span>
        </div>
        
        <div class="card-body">
          <div class="telemetry-row">
            <span class="label">Active Phase:</span>
            <span class="value phase-badge" :class="cabinet.active_phase.toLowerCase()">
              {{ cabinet.active_phase }}
            </span>
          </div>

          <div class="telemetry-row">
            <span class="label">Health Status:</span>
            <span class="value health-text" :class="{ 'has-error': cabinet.health_status !== 'ok' }">
              {{ cabinet.health_status }}
            </span>
          </div>

          <div class="telemetry-row">
            <span class="label">mTLS Latency:</span>
            <span class="value latency-value">{{ cabinet.latency_ms }} ms</span>
          </div>

          <div class="telemetry-row">
            <span class="label">Sequence:</span>
            <span class="value text-muted">#{{ cabinet.seq }}</span>
          </div>
        </div>
        
        <div class="card-footer">
          <span class="last-seen">
            Last seen: {{ formatLastSeen(cabinet.last_seen_ms) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const cabinets = ref([
  {
    intersection_id: "hasselt-xl-a",
    active_phase: "ALL_RED",
    health_status: "offline",
    seq: 0,
    timestamp_ms: 0,
    last_seen_ms: 0,
    latency_ms: 0,
    status: "Offline"
  },
  {
    intersection_id: "hasselt-xl-b",
    active_phase: "ALL_RED",
    health_status: "offline",
    seq: 0,
    timestamp_ms: 0,
    last_seen_ms: 0,
    latency_ms: 0,
    status: "Offline"
  }
]);

let pollInterval = null;

const fetchTelemetry = async () => {
  try {
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost';
    const res = await fetch(`${origin}/api/real-traffic/status`);
    if (res.ok) {
      const data = await res.json();
      cabinets.value = data;
    }
  } catch (e) {
    console.error("Failed to fetch cabinet telemetry:", e);
  }
};

const formatLastSeen = (timestamp) => {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  if (diff < 2000) return 'Just now';
  return `${Math.round(diff / 1000)}s ago`;
};

onMounted(() => {
  fetchTelemetry();
  pollInterval = setInterval(fetchTelemetry, 2000);
});

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval);
});
</script>

<style scoped>
.cabinet-telemetry-container {
  background: rgba(20, 24, 33, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
  color: #e2e8f0;
}

.telemetry-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cabinet-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.cabinet-card {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 14px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.cabinet-card:hover {
  transform: translateY(-2px);
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.cabinet-card.is-online {
  border-left: 3px solid #10b981;
}

.cabinet-card.is-failed {
  border-left: 3px solid #ef4444;
  background: rgba(239, 68, 68, 0.05);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 8px;
}

.cabinet-id {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
  text-transform: uppercase;
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  gap: 4px;
  text-transform: uppercase;
}

.status-badge.online {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.status-badge.offline {
  background: rgba(100, 116, 139, 0.15);
  color: #94a3b8;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  background-color: #10b981;
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.telemetry-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
}

.label {
  color: #94a3b8;
}

.value {
  font-weight: 500;
  color: #fff;
}

.phase-badge {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
  padding: 1px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.phase-badge.ns_green, .phase-badge.ew_green {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.phase-badge.ns_amber, .phase-badge.ew_amber {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.phase-badge.all_red {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.health-text {
  color: #34d399;
}

.health-text.has-error {
  color: #f87171;
  font-weight: 600;
}

.latency-value {
  font-family: monospace;
}

.card-footer {
  margin-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.03);
  padding-top: 8px;
  font-size: 0.75rem;
  color: #64748b;
  text-align: right;
}

@keyframes pulse {
  0% {
    transform: scale(0.9);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(0.9);
    opacity: 0.6;
  }
}
</style>
