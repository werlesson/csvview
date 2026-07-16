import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CsvCell from '~/components/CsvCell.vue'

describe('CsvCell', () => {
  it('renders the provided value', () => {
    const wrapper = mount(CsvCell, { props: { value: 'hello' } })
    expect(wrapper.text()).toBe('hello')
    expect(wrapper.classes()).not.toContain('csv-cell--empty')
  })

  it('renders a hachured placeholder with the "empty" label for empty values', () => {
    const wrapper = mount(CsvCell, { props: { value: null } })
    expect(wrapper.text()).toBe('empty')
    expect(wrapper.text()).not.toBe('—')
    expect(wrapper.classes()).toContain('csv-cell--empty')
    expect(wrapper.find('.csv-cell__empty-label').exists()).toBe(true)
  })

  it.each([null, undefined, ''])(
    'treats %j as empty and never renders just "—"',
    (value) => {
      const wrapper = mount(CsvCell, { props: { value } })
      expect(wrapper.text()).toBe('empty')
      expect(wrapper.classes()).toContain('csv-cell--empty')
    },
  )

  it('keeps csv-cell--numeric on an empty cell in a numeric column', () => {
    const wrapper = mount(CsvCell, { props: { value: null, numeric: true } })
    expect(wrapper.classes()).toContain('csv-cell--numeric')
    expect(wrapper.classes()).toContain('csv-cell--empty')
    expect(wrapper.text()).toBe('empty')
  })

  it('keeps csv-cell--selected on an empty cell in a selected column', () => {
    const wrapper = mount(CsvCell, { props: { value: null, selected: true } })
    expect(wrapper.classes()).toContain('csv-cell--selected')
    expect(wrapper.classes()).toContain('csv-cell--empty')
    expect(wrapper.text()).toBe('empty')
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
