import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import QuickSearch from '../../../components/sumo/QuickSearch.vue'

describe('QuickSearch.vue', () => {
  it('renders an input field', () => {
    const wrapper = mount(QuickSearch, {
      props: { isProjection: false, errorMessage: '' },
    })
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('renders a Search button', () => {
    const wrapper = mount(QuickSearch, {
      props: { isProjection: false, errorMessage: '' },
    })
    expect(wrapper.find('button').text()).toBe('Search')
  })

  it('Search button is disabled when input is empty', () => {
    const wrapper = mount(QuickSearch, {
      props: { isProjection: false, errorMessage: '' },
    })
    expect(wrapper.find('button').element.disabled).toBe(true)
  })

  it('Search button is enabled when input has text', async () => {
    const wrapper = mount(QuickSearch, {
      props: { isProjection: false, errorMessage: '' },
    })
    await wrapper.find('input').setValue('test query')
    expect(wrapper.find('button').element.disabled).toBe(false)
  })

  it('emits search event with input value when button clicked', async () => {
    const wrapper = mount(QuickSearch, {
      props: { isProjection: false, errorMessage: '' },
    })
    await wrapper.find('input').setValue('some location')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('search')).toBeTruthy()
    expect(wrapper.emitted('search')[0]).toEqual(['some location'])
  })

  it('shows SUMO hint when isProjection is false', () => {
    const wrapper = mount(QuickSearch, {
      props: { isProjection: false, errorMessage: '' },
    })
    expect(wrapper.find('input').attributes('placeholder')).toContain('float')
  })

  it('shows projection hint when isProjection is true', () => {
    const wrapper = mount(QuickSearch, {
      props: { isProjection: true, errorMessage: '' },
    })
    expect(wrapper.find('input').attributes('placeholder')).toContain('OSM ID')
  })

  it('shows error message when input has text and errorMessage is set', async () => {
    const wrapper = mount(QuickSearch, {
      props: { isProjection: false, errorMessage: 'Not found' },
    })
    await wrapper.find('input').setValue('bad input')
    expect(wrapper.find('.search-error').text()).toBe('Not found')
  })

  it('does not show error message when input is empty', () => {
    const wrapper = mount(QuickSearch, {
      props: { isProjection: false, errorMessage: 'Not found' },
    })
    expect(wrapper.find('.search-error').exists()).toBe(false)
  })
})
