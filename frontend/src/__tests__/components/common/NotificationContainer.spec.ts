import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import NotificationContainer from '@/components/common/NotificationContainer.vue'
import { useNotifications } from '@/stores/NotificationStore'

vi.mock('@/stores/NotificationStore', () => {
  const { ref } = require('vue')
  return {
    useNotifications: vi.fn()
  }
})

describe('NotificationContainer.vue', () => {
  let mockNotifications
  let mockRemoveNotification

  beforeEach(() => {
    mockNotifications = []
    mockRemoveNotification = vi.fn()
    useNotifications.mockReturnValue({
      notifications: mockNotifications,
      removeNotification: mockRemoveNotification
    })
  })

  it('renders correctly with no notifications', () => {
    const wrapper = mount(NotificationContainer)
    expect(wrapper.findAll('.notification-toast').length).toBe(0)
  })

  it('renders notifications correctly', () => {
    mockNotifications.push({
      id: 1,
      type: 'success',
      title: 'Success Title',
      message: 'Success Message'
    })

    const wrapper = mount(NotificationContainer)
    
    const toasts = wrapper.findAll('.notification-toast')
    expect(toasts.length).toBe(1)
    expect(toasts[0].classes()).toContain('notification-success')
    expect(wrapper.find('.notification-title').text()).toBe('Success Title')
    expect(wrapper.find('.notification-message').text()).toBe('Success Message')
  })

  it('handles remove notification button click', async () => {
    mockNotifications.push({
      id: 1,
      type: 'info',
      message: 'Info Message'
    })

    const wrapper = mount(NotificationContainer)
    const closeButton = wrapper.find('.notification-close')
    
    await closeButton.trigger('click')
    expect(mockRemoveNotification).toHaveBeenCalledWith(1)
  })

  it('renders actions and handles action click', async () => {
    const onClickAction = vi.fn()
    mockNotifications.push({
      id: 2,
      type: 'warning',
      message: 'Warning',
      actions: [
        { label: 'Confirm', class: 'btn-primary', onClick: onClickAction },
        { label: 'Cancel', class: 'btn-secondary', closeOnClick: false }
      ]
    })

    const wrapper = mount(NotificationContainer)
    const actionButtons = wrapper.findAll('.notification-actions button')
    
    expect(actionButtons.length).toBe(2)
    expect(actionButtons[0].text()).toBe('Confirm')
    expect(actionButtons[0].classes()).toContain('btn-primary')
    
    // Click action with closeOnClick = true (default) and onClick function
    await actionButtons[0].trigger('click')
    expect(onClickAction).toHaveBeenCalled()
    expect(mockRemoveNotification).toHaveBeenCalledWith(2)

    mockRemoveNotification.mockClear()
    onClickAction.mockClear()

    // Click action with closeOnClick = false
    await actionButtons[1].trigger('click')
    expect(mockRemoveNotification).not.toHaveBeenCalled()
  })
})
