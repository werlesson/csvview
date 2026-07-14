import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CsvCell from '~/components/CsvCell.vue'

describe('CsvCell', () => {
  it('renders the provided value', () => {
    const wrapper = mount(CsvCell, { props: { value: 'hello' } })
    expect(wrapper.text()).toBe('hello')
    expect(wrapper.classes()).not.toContain('italic')
  })

  it('renders a placeholder for empty values', () => {
    const wrapper = mount(CsvCell, { props: { value: null } })
    expect(wrapper.text()).toBe('—')
    expect(wrapper.classes()).toContain('italic')
  })

  it('coerces numbers to text', () => {
    const wrapper = mount(CsvCell, { props: { value: 42 } })
    expect(wrapper.text()).toBe('42')
  })

  it('aligns numeric columns right in a monospace class', () => {
    const numeric = mount(CsvCell, { props: { value: '42', numeric: true } })
    expect(numeric.classes()).toContain('csv-cell--numeric')

    const text = mount(CsvCell, { props: { value: 'hello' } })
    expect(text.classes()).not.toContain('csv-cell--numeric')
  })
})
