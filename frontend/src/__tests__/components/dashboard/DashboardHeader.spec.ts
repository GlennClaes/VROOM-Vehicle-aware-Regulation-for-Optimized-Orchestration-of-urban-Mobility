import { mount } from '@vue/test-utils'
import Header from '@/components/dashboard/DashboardHeader.vue'

const mockUser = {
  name: 'Jan Jansen',
  email: 'jan@test.be'
}

describe('Header.vue', () => {

  test('component rendert correct', () => {
    const wrapper = mount(Header, {
      props: {
        user: mockUser,
        isRunning: false
      }
    })

    expect(wrapper.exists()).toBe(true)
  })


  test('toont de titel Verkeerscentrum', () => {
    const wrapper = mount(Header, {
      props: { user: mockUser, isRunning: false }
    })

    expect(wrapper.text()).toContain('VROOM')
  })


  test('toont subtitel Intelligente Verkeerssimulatie', () => {
    const wrapper = mount(Header, {
      props: { user: mockUser, isRunning: false }
    })

    expect(wrapper.text()).toContain('Intelligente Verkeerssimulatie')
  })


  test('toont user naam', () => {
    const wrapper = mount(Header, {
      props: { user: mockUser, isRunning: false }
    })

    expect(wrapper.text()).toContain(mockUser.name)
  })


  test('toont user email', () => {
    const wrapper = mount(Header, {
      props: { user: mockUser, isRunning: false }
    })

    expect(wrapper.text()).toContain(mockUser.email)
  })

  test('logout knop bestaat', () => {
    const wrapper = mount(Header, {
      props: { user: mockUser, isRunning: false }
    })

    const button = wrapper.find('button')

    expect(button.exists()).toBe(true)
  })


  test('klik op logout emit event', async () => {
    const wrapper = mount(Header, {
      props: { user: mockUser, isRunning: false }
    })

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted()).toHaveProperty('logout')
  })


  test('logout event wordt exact 1 keer verstuurd', async () => {
    const wrapper = mount(Header, {
      props: { user: mockUser, isRunning: false }
    })

    const button = wrapper.find('button')

    await button.trigger('click')

    expect(wrapper.emitted('logout')).toHaveLength(1)
  })


  test('logo box bestaat', () => {
    const wrapper = mount(Header, {
      props: { user: mockUser, isRunning: false }
    })

    expect(wrapper.find('.logo-box').exists()).toBe(true)
  })

  test('logout knop bevat tekst Uitloggen', () => {
    const wrapper = mount(Header, {
      props: { user: mockUser, isRunning: false }
    })

    expect(wrapper.text()).toContain('Uitloggen')
  })

  test('toont actieve simulatie badge wanneer isRunning true is', () => {
    const wrapper = mount(Header, {
      props: { user: mockUser, isRunning: true }
    })
    expect(wrapper.find('.badge-active').exists()).toBe(true)
    expect(wrapper.text()).toContain('Simulatie actief')
  })

})
