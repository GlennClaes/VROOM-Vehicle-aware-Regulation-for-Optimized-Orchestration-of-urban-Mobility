<template>
  <header class="bg-white border-bottom sticky-top shadow-sm z-3">
    <div class="container-fluid px-4 py-3 d-flex align-items-center justify-content-between">
      <div class="d-flex align-items-center gap-3">
        <div class="logo-box">
          <NavigationIcon class="text-white" :size="24" />
        </div>
        <div>
          <h1 class="h4 fw-bold mb-0">VROOM</h1>
          <p class="text-muted small">Intelligente Verkeerssimulatie</p>
        </div>
      </div>

      <div class="d-flex align-items-center gap-4">
        <div v-if="isRunning" class="badge-active">
          <div class="dot blink"></div>
          <span>Simulatie actief</span>
        </div>
        <div class="text-end d-none d-md-block">
          <p class="user-name mb-0">{{ user.name }}</p>
          <p class="user-email mb-0">{{ user.email }}</p>
        </div>
        <button @click="$emit('logout')" class="logout-btn">
          <LogOutIcon :size="16" /> Uitloggen
        </button>
      </div>
    </div>
  </header>
</template>

<script>
import { Navigation as NavigationIcon, LogOut as LogOutIcon } from 'lucide-vue-next';
export default {
  props: ['user', 'isRunning'],
  components: { NavigationIcon, LogOutIcon }
}
</script>

<style scoped>
.logo-box {
  width: 48px; height: 48px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 12px; display: flex; align-items: center; justify-content: center;
}
.badge-active {
  display: flex; align-items: center; gap: 8px;
  background: #f0fdf4; color: #166534; padding: 6px 12px;
  border-radius: 20px; border: 1px solid #bbf7d0; font-size: 0.85rem;
}
.dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; }
.blink { animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: 0.3; } }
.logout-btn {
  border: 1px solid #e2e8f0;
  background: white;
  padding: 6px 12px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #334155;
  transition: all 0.15s ease;
}

.logout-btn:hover {
  background-color: #f1f5f9; /* lichtgrijs */
  border-color: #cbd5e1;
  color: #0f172a;
}


.user-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #0f172a;
}

.user-email {
  font-size: 0.8rem;
  color: #64748b;
  opacity: 0.9;
}
</style>
