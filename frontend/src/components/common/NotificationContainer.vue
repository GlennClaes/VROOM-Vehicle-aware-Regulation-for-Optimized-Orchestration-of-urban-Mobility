<template>
  <div class="notification-container">
    <TransitionGroup name="notification-list">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="['notification-toast', `notification-${notification.type}`]"
        role="alert"
      >
        <div class="notification-content">
          <div v-if="notification.title" class="notification-title">{{ notification.title }}</div>
          <div class="notification-message">{{ notification.message }}</div>
          
          <div v-if="notification.actions && notification.actions.length" class="notification-actions">
            <button
              v-for="action in notification.actions"
              :key="action.label"
              class="btn btn-sm"
              :class="action.class || 'btn-light'"
              @click="handleAction(notification, action)"
            >
              {{ action.label }}
            </button>
          </div>
        </div>
        <button class="notification-close" @click="removeNotification(notification.id)">
          &times;
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { useNotifications } from '@/stores/NotificationStore'

const { notifications, removeNotification } = useNotifications()

function handleAction(notification, action) {
  if (action.onClick) {
    action.onClick()
  }
  if (action.closeOnClick !== false) {
    removeNotification(notification.id)
  }
}
</script>

<style scoped>
.notification-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 400px;
  width: 100%;
  pointer-events: none;
}

.notification-toast {
  pointer-events: auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-left: 4px solid #3b82f6;
  position: relative;
  overflow: hidden;
}

.notification-success { border-left-color: #10b981; }
.notification-warning { border-left-color: #f59e0b; }
.notification-danger { border-left-color: #ef4444; }
.notification-info { border-left-color: #3b82f6; }

.notification-content {
  flex-grow: 1;
  margin-right: 1rem;
}

.notification-title {
  font-weight: 700;
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
  color: #1e293b;
}

.notification-message {
  font-size: 0.875rem;
  color: #475569;
  line-height: 1.4;
}

.notification-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.notification-close {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  line-height: 1;
  color: #94a3b8;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s;
}

.notification-close:hover {
  color: #64748b;
}

/* Transitions */
.notification-list-enter-active,
.notification-list-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.notification-list-enter-from {
  opacity: 0;
  transform: translateX(30px) scale(0.9);
}

.notification-list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
