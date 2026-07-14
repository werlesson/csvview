import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Select from '~/components/Select.vue'

describe('Select', () => {
  it('renders options from string array', () => {
    const wrapper = mount(Select, { props: { options: ['a', 'b', 'c'] } })
    const options = wrapper.findAll('option')
    expect(options).toHaveLength(3)
    expect(options[0].text()).toBe('a')
    expect(options[0].attributes('value')).toBe('a')
  })

  it('renders options from { label, value } objects', () => {
    const wrapper = mount(Select, {
      props: {
        options: [
          { label: 'Igual a', value: 'equals' },
          { label: 'Entre', value: 'between' },
        ],
      },
    })
    const options = wrapper.findAll('option')
    expect(options[0].text()).toBe('Igual a')
    expect(options[0].attributes('value')).toBe('equals')
  })

  it('reflects the selected modelValue', () => {
    const wrapper = mount(Select, {
      props: { options: ['a', 'b'], modelValue: 'b' },
    })
    expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('b')
  })

  it('emits update:modelValue on change', async () => {
    const wrapper = mount(Select, { props: { options: ['a', 'b'] } })
    await wrapper.get('select').setValue('b')
    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])
  })

  it('renders a native select (keyboard accessible)', () => {
    const wrapper = mount(Select, { props: { options: ['a'] } })
    expect(wrapper.find('select').exists()).toBe(true)
  })

  it('forwards an aria-label to the control', () => {
    const wrapper = mount(Select, {
      props: { options: ['a'], ariaLabel: 'Operador' },
    })
    expect(wrapper.get('select').attributes('aria-label')).toBe('Operador')
  })
})
