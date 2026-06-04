import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Input from '@/components/ui/Input.vue'

describe('Input.vue', () => {
  it('emits update:modelValue wanneer er getypt wordt', async () => {
    const wrapper = mount(Input, {
      props: {
        modelValue: '',
        'onUpdate:modelValue': (e) => wrapper.setProps({ modelValue: e }),
      },
    })

    const input = wrapper.find('input')
    await input.setValue('test waarde')

    // Dit dekt de @input regel (vaak regel 11 of 12)
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['test waarde'])
  })

  it('emits blur event wanneer de focus verloren gaat', async () => {
    const wrapper = mount(Input)
    const input = wrapper.find('input')

    await input.trigger('blur')

    // Dit dekt de @blur regel
    expect(wrapper.emitted('blur')).toBeTruthy()
  })

  it('emits focus event wanneer het veld geselecteerd wordt', async () => {
    const wrapper = mount(Input)
    const input = wrapper.find('input')

    await input.trigger('focus')

    // Dit dekt de @focus regel
    expect(wrapper.emitted('focus')).toBeTruthy()
  })

  it('past de html attributen correct toe', () => {
    const wrapper = mount(Input, {
      props: {
        id: 'test-id',
        type: 'email',
        placeholder: 'E-mailadres',
        required: true,
        disabled: true,
      },
    })

    const input = wrapper.find('input')
    expect(input.attributes('id')).toBe('test-id')
    expect(input.attributes('type')).toBe('email')
    expect(input.attributes('placeholder')).toBe('E-mailadres')
    expect(input.element.required).toBe(true)
    expect(input.element.disabled).toBe(true)
  })
})
