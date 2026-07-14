import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StatsHistogram from '~/components/StatsHistogram.vue'
import type { HistogramBin } from '~/services/columnStats'

/** Bins de exemplo, no formato do motor da Fase 5. */
function makeBins(): HistogramBin[] {
  return [
    { start: 0, end: 10, count: 2 },
    { start: 10, end: 20, count: 4 },
    { start: 20, end: 30, count: 0 },
    { start: 30, end: 40, count: 1 },
  ]
}

describe('StatsHistogram', () => {
  it('renderiza uma barra por bin da Fase 5', () => {
    const wrapper = mount(StatsHistogram, { props: { bins: makeBins() } })

    const bars = wrapper.findAll('.histogram__bar')
    expect(bars).toHaveLength(4)
    // Cada barra carrega o count do bin correspondente.
    expect(bars.map((b) => b.attributes('data-count'))).toEqual([
      '2',
      '4',
      '0',
      '1',
    ])
  })

  it('dá 100% de altura ao bin de maior contagem e 0% aos vazios', () => {
    const wrapper = mount(StatsHistogram, { props: { bins: makeBins() } })

    const bars = wrapper.findAll('.histogram__bar')
    // count 4 é o máximo → 100%.
    expect(bars[1]!.attributes('style')).toContain('height: 100%')
    // count 0 → 0%.
    expect(bars[2]!.attributes('style')).toContain('height: 0%')
  })

  it('não renderiza barras quando não há bins', () => {
    const wrapper = mount(StatsHistogram, { props: { bins: [] } })
    expect(wrapper.findAll('.histogram__bar')).toHaveLength(0)
  })
})
