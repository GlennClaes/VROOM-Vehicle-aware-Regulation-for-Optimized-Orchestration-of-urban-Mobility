import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import ScenarioDropdown from '../../../components/sumo/ScenarioDropdown.vue'

const scenarios = [
  { kebabCase: 'scenario-one', displayName: 'Scenario One' },
  { kebabCase: 'scenario-two', displayName: 'Scenario Two' },
  { kebabCase: 'scenario-three', displayName: 'Scenario Three' },
]

describe('ScenarioDropdown.vue', () => {
  it('renders a select element', () => {
    const wrapper = mount(ScenarioDropdown, {
      props: { scenarios, current: 'scenario-one' },
    })
    expect(wrapper.find('select').exists()).toBe(true)
  })

  it('renders correct number of options', () => {
    const wrapper = mount(ScenarioDropdown, {
      props: { scenarios, current: 'scenario-one' },
    })
    expect(wrapper.findAll('option').length).toBe(3)
  })

  it('renders correct display names', () => {
    const wrapper = mount(ScenarioDropdown, {
      props: { scenarios, current: 'scenario-one' },
    })
    const options = wrapper.findAll('option')
    expect(options[0].text()).toBe('Scenario One')
    expect(options[1].text()).toBe('Scenario Two')
  })

  it('emits change event with correct value on selection', async () => {
    const wrapper = mount(ScenarioDropdown, {
      props: { scenarios, current: 'scenario-one' },
    })
    const select = wrapper.find('select')
    await select.setValue('scenario-two')
    expect(wrapper.emitted('change')).toBeTruthy()
    expect(wrapper.emitted('change')[0]).toEqual(['scenario-two'])
  })

  it('sets the current value as selected', () => {
    const wrapper = mount(ScenarioDropdown, {
      props: { scenarios, current: 'scenario-two' },
    })
    expect(wrapper.find('select').element.value).toBe('scenario-two')
  })
})
