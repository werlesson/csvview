import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FilterChips from '~/components/FilterChips.vue'
import type { ViewerColumn } from '~/composables/useViewer'
import type { ColumnFilter } from '~/services/columnFilters'

function makeColumns(): ViewerColumn[] {
  return [
    { index: 0, label: 'id', type: 'number', visible: true, pinned: false, width: 180 },
    { index: 1, label: 'name', type: 'text', visible: true, pinned: false, width: 180 },
    { index: 2, label: 'amount', type: 'number', visible: false, pinned: false, width: 180 },
  ]
}

function mountChips(overrides: Record<string, unknown> = {}) {
  return mount(FilterChips, {
    props: {
      columns: makeColumns(),
      filters: [],
      ...overrides,
    },
  })
}

describe('FilterChips', () => {
  it('não renderiza nada sem filtros aplicados', () => {
    const wrapper = mountChips()
    expect(wrapper.find('.filter-chips').exists()).toBe(false)
  })

  it('renderiza um badge por filtro aplicado, com o rótulo "<coluna> <operador> <valor>"', () => {
    const filters: ColumnFilter[] = [
      { column: 1, operator: 'contem', value: 'ana' },
      { column: 0, operator: 'maiorQue', value: 100 },
    ]
    const wrapper = mountChips({ filters })

    const labels = wrapper.findAll('.filter-chips__label')
    expect(labels).toHaveLength(2)
    expect(labels[0]!.text()).toBe('name contém ana')
    expect(labels[1]!.text()).toBe('id maior que 100')
  })

  it('exibe o nome de uma coluna oculta no badge mesmo estando oculta', () => {
    const filters: ColumnFilter[] = [{ column: 2, operator: 'menorQue', value: 50 }]
    const wrapper = mountChips({ filters })

    expect(wrapper.get('.filter-chips__label').text()).toBe('amount menor que 50')
  })

  it('não inclui valor no rótulo para operadores sem valor (vazio/preenchido/verdadeiro/falso)', () => {
    const filters: ColumnFilter[] = [{ column: 1, operator: 'vazio' }]
    const wrapper = mountChips({ filters })

    expect(wrapper.get('.filter-chips__label').text()).toBe('name vazio')
  })

  it('clicar no "×" de um badge remove aquele filtro imediatamente (emite "remove" com o índice)', async () => {
    const filters: ColumnFilter[] = [
      { column: 0, operator: 'vazio' },
      { column: 1, operator: 'preenchido' },
    ]
    const wrapper = mountChips({ filters })

    await wrapper.findAll('.filter-chips__remove')[1]!.trigger('click')

    expect(wrapper.emitted('remove')).toEqual([[1]])
  })
})
