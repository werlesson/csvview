import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ColumnChip from '~/components/ColumnChip.vue'

describe('ColumnChip', () => {
  it('shows the column label and type', () => {
    const wrapper = mount(ColumnChip, {
      props: { label: 'date', type: 'date' },
    })
    expect(wrapper.get('.chip__label').text()).toBe('date')
    expect(wrapper.get('.chip__type').text()).toBe('date')
  })

  it('renders the amount type', () => {
    const wrapper = mount(ColumnChip, {
      props: { label: 'amount', type: 'amount' },
    })
    expect(wrapper.get('.chip__type').text()).toBe('amount')
  })

  it('defaults the type to text', () => {
    const wrapper = mount(ColumnChip, { props: { label: 'description' } })
    expect(wrapper.get('.chip__type').text()).toBe('text')
  })

  it('marks a pinned column (e.g. id · pinned)', () => {
    const wrapper = mount(ColumnChip, {
      props: { label: 'id', type: 'id', pinned: true },
    })
    expect(wrapper.classes()).toContain('chip--pinned')
    expect(wrapper.get('.chip__pin').text()).toBe('pinned')
  })

  it('does not render the pin marker when not pinned', () => {
    const wrapper = mount(ColumnChip, { props: { label: 'id', type: 'id' } })
    expect(wrapper.find('.chip__pin').exists()).toBe(false)
  })
})
