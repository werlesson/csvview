import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchInput from '~/components/SearchInput.vue'

describe('SearchInput', () => {
  it('uses the "Buscar em tudo…" placeholder by default', () => {
    const wrapper = mount(SearchInput)
    expect(wrapper.get('input').attributes('placeholder')).toBe('Buscar em tudo…')
  })

  it('renders the search icon', () => {
    const wrapper = mount(SearchInput)
    expect(wrapper.find('svg.search__icon').exists()).toBe(true)
  })

  it('reflects the modelValue', () => {
    const wrapper = mount(SearchInput, { props: { modelValue: 'foo' } })
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('foo')
  })

  it('emits the typed value via update:modelValue', async () => {
    const wrapper = mount(SearchInput)
    const input = wrapper.get('input')
    await input.setValue('receita')
    expect(wrapper.emitted('update:modelValue')).toEqual([['receita']])
  })

  it('exposes an accessible label', () => {
    const wrapper = mount(SearchInput)
    expect(wrapper.get('input').attributes('aria-label')).toBe('Buscar em tudo')
  })

  it('accepts a custom placeholder', () => {
    const wrapper = mount(SearchInput, { props: { placeholder: 'Filtrar…' } })
    expect(wrapper.get('input').attributes('placeholder')).toBe('Filtrar…')
  })
})
