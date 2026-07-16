import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HighlightLegend from '~/components/HighlightLegend.vue'

describe('HighlightLegend', () => {
  it('renders exactly 4 swatch+label pairs', () => {
    const wrapper = mount(HighlightLegend)

    const items = wrapper.findAll('.highlight-legend__item')
    expect(items).toHaveLength(4)

    for (const item of items) {
      expect(item.find('.highlight-legend__swatch').exists()).toBe(true)
      expect(item.find('.highlight-legend__label').exists()).toBe(true)
    }
  })

  it('labels the 4 highlight types: vazio, duplicado, negativo, data inválida', () => {
    const wrapper = mount(HighlightLegend)

    const labels = wrapper
      .findAll('.highlight-legend__label')
      .map((label) => label.text())

    expect(labels).toEqual(['vazio', 'duplicado', 'negativo', 'data inválida'])
  })
})
