import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useNotifications } from '@/stores/NotificationStore'

describe('NotificationStore', () => {
  let store

  beforeEach(() => {
    store = useNotifications()
    // Clear all notifications
    while (store.notifications.length > 0) {
      store.removeNotification(store.notifications[0].id)
    }
  })

  it('adds a notification with default values', () => {
    const id = store.addNotification({ title: 'Test', message: 'Hello' })
    
    expect(id).toBeTruthy()
    expect(store.notifications.length).toBe(1)
    expect(store.notifications[0].title).toBe('Test')
    expect(store.notifications[0].message).toBe('Hello')
    expect(store.notifications[0].type).toBe('info')
    expect(store.notifications[0].duration).toBe(5000)
    expect(store.notifications[0].actions).toEqual([])
  })

  it('auto-removes notification after duration', async () => {
    vi.useFakeTimers()
    
    store.addNotification({ title: 'Auto Remove', duration: 1000 })
    expect(store.notifications.length).toBe(1)
    
    vi.advanceTimersByTime(1000)
    expect(store.notifications.length).toBe(0)
    
    vi.useRealTimers()
  })

  it('does NOT auto-remove when duration is 0', async () => {
    vi.useFakeTimers()
    
    store.addNotification({ title: 'Persistent', duration: 0 })
    expect(store.notifications.length).toBe(1)
    
    vi.advanceTimersByTime(10000)
    expect(store.notifications.length).toBe(1)
    
    vi.useRealTimers()
  })

  it('removes a notification by id', () => {
    const id = store.addNotification({ title: 'To Remove', duration: 0 })
    expect(store.notifications.length).toBe(1)
    
    store.removeNotification(id)
    expect(store.notifications.length).toBe(0)
  })

  it('does nothing when removing a non-existing id', () => {
    store.addNotification({ title: 'Keep Me', duration: 0 })
    expect(store.notifications.length).toBe(1)
    
    store.removeNotification('non-existing-id')
    expect(store.notifications.length).toBe(1)
  })

  it('adds notification with custom type and actions', () => {
    const actions = [{ label: 'Click me', onClick: vi.fn() }]
    store.addNotification({ title: 'Custom', type: 'success', actions, duration: 0 })
    
    expect(store.notifications[0].type).toBe('success')
    expect(store.notifications[0].actions).toEqual(actions)
  })
})
