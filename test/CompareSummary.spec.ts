import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CompareSummary from '~/components/CompareSummary.vue'
import type { ComparisonCounts } from '~/services/diffDatasets'

function makeCounts(overrides: Partial<ComparisonCounts> = {}): ComparisonCounts {
  return { added: 128, removed: 54, changed: 312, unchanged: 900, ...overrides }
}

describe('CompareSummary', () => {
  it('renderiza as três contagens exatamente como recebidas via prop (UI-03)', () => {
    const wrapper = mount(CompareSummary, { props: { counts: makeCounts() } })

    expect(wrapper.get('.compare-summary__badge--added').text()).toBe('+128 adicionadas')
    expect(wrapper.get('.compare-summary__badge--removed').text()).toBe('−54 removidas')
    expect(wrapper.get('.compare-summary__badge--changed').text()).toBe('~312 alteradas')
  })

  it('não conta `unchanged` em nenhum dos três badges visíveis (UI-03 AC)', () => {
    const wrapper = mount(CompareSummary, {
      props: { counts: makeCounts({ unchanged: 999999 }) },
    })

    expect(wrapper.text()).not.toContain('999999')
    expect(wrapper.findAll('.compare-summary__badge')).toHaveLength(3)
  })

  it('reflete contagens zeradas sem quebrar o formato', () => {
    const wrapper = mount(CompareSummary, {
      props: { counts: { added: 0, removed: 0, changed: 0, unchanged: 0 } },
    })

    expect(wrapper.get('.compare-summary__badge--added').text()).toBe('+0 adicionadas')
    expect(wrapper.get('.compare-summary__badge--removed').text()).toBe('−0 removidas')
    expect(wrapper.get('.compare-summary__badge--changed').text()).toBe('~0 alteradas')
  })
})
