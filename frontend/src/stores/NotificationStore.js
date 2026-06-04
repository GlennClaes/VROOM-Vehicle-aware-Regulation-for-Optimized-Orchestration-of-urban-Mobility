import { reactive, readonly } from 'vue'

const state = reactive({
  notifications: []
})

export function useNotifications() {
  const addNotification = (notification) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9)
    const newNotification = {
      id,
      type: 'info',
      title: '',
      message: '',
      duration: 5000,
      actions: [],
      ...notification
    }
    
    state.notifications.push(newNotification)
    
    if (newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, newNotification.duration)
    }
    
    return id
  }

  const removeNotification = (id) => {
    const index = state.notifications.findIndex(n => n.id === id)
    if (index !== -1) {
      state.notifications.splice(index, 1)
    }
  }

  return {
    notifications: readonly(state.notifications),
    addNotification,
    removeNotification
  }
}
