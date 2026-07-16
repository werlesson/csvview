import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FilterPanel from '~/components/FilterPanel.vue'
import type { ViewerColumn } from '~/composables/useViewer'
import type { ColumnFilter } from '~/services/columnFilters'

function makeColumns(): ViewerColumn[] {
  return [
    { index: 0, label: 'id', type: 'number', visible: true, pinned: false, width: 180 },
    { index: 1, label: 'name', type: 'text', visible: true, pinned: false, width: 180 },
    { index: 2, label: 'amount', type: 'number', visible: false, pinned: false, width: 180 },
  ]
}

function mountPanel(overrides: Record<string, unknown> = {}) {
  return mount(FilterPanel, {
    props: {
      columns: makeColumns(),
      filters: [],
      ...overrides,
    },
  })
}

describe('FilterPanel', () => {
  it('renderiza um chip por filtro com o rótulo "<coluna> <operador> <valor>"', () => {
    const filters: ColumnFilter[] = [
      { column: 1, operator: 'contem', value: 'ana' },
      { column: 0, operator: 'maiorQue', value: 100 },
    ]
    const wrapper = mountPanel({ filters })

    const labels = wrapper.findAll('.filter-panel__chip-label')
    expect(labels).toHaveLength(2)
    expect(labels[0]!.text()).toBe('name contém ana')
    expect(labels[1]!.text()).toBe('id maior que 100')
  })

  it('exibe o nome de uma coluna oculta no chip mesmo estando oculta', () => {
    const filters: ColumnFilter[] = [{ column: 2, operator: 'menorQue', value: 50 }]
    const wrapper = mountPanel({ filters })

    expect(wrapper.find('.filter-panel__chip-label').text()).toBe('amount menor que 50')
  })

  it('não inclui valor no rótulo para operadores sem valor (vazio/preenchido/verdadeiro/falso)', () => {
    const filters: ColumnFilter[] = [{ column: 1, operator: 'vazio' }]
    const wrapper = mountPanel({ filters })

    expect(wrapper.find('.filter-panel__chip-label').text()).toBe('name vazio')
  })

  it('coluna oculta aparece no seletor de coluna do editor', async () => {
    const wrapper = mountPanel()
    await wrapper.find('.dropdown__trigger').trigger('click')

    const columnOptions = wrapper
      .find('select[aria-label="Coluna do filtro"]')
      .findAll('option')
      .map((option) => option.text())
    expect(columnOptions).toContain('amount')
  })

  it('coluna number oferece "maior que"/"entre" e não "contém"', async () => {
    const wrapper = mountPanel()
    await wrapper.find('.dropdown__trigger').trigger('click')

    // Coluna padrão do rascunho é a primeira (index 0, "id", number).
    const operatorLabels = wrapper
      .find('select[aria-label="Operador do filtro"]')
      .findAll('option')
      .map((option) => option.text())

    expect(operatorLabels).toContain('maior que')
    expect(operatorLabels).toContain('entre')
    expect(operatorLabels).not.toContain('contém')
  })

  it('coluna text oferece "contém" e não "entre"', async () => {
    const wrapper = mountPanel()
    await wrapper.find('.dropdown__trigger').trigger('click')

    await wrapper.find('select[aria-label="Coluna do filtro"]').setValue('1')

    const operatorLabels = wrapper
      .find('select[aria-label="Operador do filtro"]')
      .findAll('option')
      .map((option) => option.text())

    expect(operatorLabels).toContain('contém')
    expect(operatorLabels).not.toContain('entre')
  })

  it('"Adicionar filtro" abre o editor e submeter emite "add" com o filtro montado', async () => {
    const wrapper = mountPanel()
    await wrapper.find('.dropdown__trigger').trigger('click')

    await wrapper.find('select[aria-label="Coluna do filtro"]').setValue('1')
    await wrapper.find('select[aria-label="Operador do filtro"]').setValue('contem')
    await wrapper.find('input[aria-label="Valor do filtro"]').setValue('ana')

    await wrapper.find('.filter-panel__submit').trigger('submit')

    expect(wrapper.emitted('add')).toEqual([[{ column: 1, operator: 'contem', value: 'ana' }]])
  })

  it('operador de intervalo ("entre") mostra os campos "De"/"Até" e emite valor {from,to}', async () => {
    const wrapper = mountPanel()
    await wrapper.find('.dropdown__trigger').trigger('click')

    await wrapper.find('select[aria-label="Operador do filtro"]').setValue('entre')
    await wrapper.find('input[aria-label="Valor inicial"]').setValue('10')
    await wrapper.find('input[aria-label="Valor final"]').setValue('20')

    await wrapper.find('.filter-panel__submit').trigger('submit')

    expect(wrapper.emitted('add')).toEqual([
      [{ column: 0, operator: 'entre', value: { from: '10', to: '20' } }],
    ])
  })

  it('operadores sem valor (ex.: "vazio") não exibem campo de valor e emitem "add" sem `value`', async () => {
    const wrapper = mountPanel()
    await wrapper.find('.dropdown__trigger').trigger('click')

    await wrapper.find('select[aria-label="Operador do filtro"]').setValue('vazio')
    expect(wrapper.find('input[aria-label="Valor do filtro"]').exists()).toBe(false)

    await wrapper.find('.filter-panel__submit').trigger('submit')

    expect(wrapper.emitted('add')).toEqual([[{ column: 0, operator: 'vazio' }]])
  })

  it('remover um chip emite "remove" com o índice do filtro', async () => {
    const filters: ColumnFilter[] = [
      { column: 0, operator: 'vazio' },
      { column: 1, operator: 'preenchido' },
    ]
    const wrapper = mountPanel({ filters })

    await wrapper.findAll('.filter-panel__chip-remove')[1]!.trigger('click')

    expect(wrapper.emitted('remove')).toEqual([[1]])
  })

  it('"Limpar" emite "clear"', async () => {
    const filters: ColumnFilter[] = [{ column: 0, operator: 'vazio' }]
    const wrapper = mountPanel({ filters })

    await wrapper.find('.filter-panel__clear').trigger('click')

    expect(wrapper.emitted('clear')).toEqual([[]])
  })

  it('não renderiza nenhum controle de filtro dentro de <th> (responsabilidade da tabela permanece intacta)', () => {
    const wrapper = mountPanel({ filters: [{ column: 0, operator: 'vazio' }] })
    expect(wrapper.findAll('th')).toHaveLength(0)
  })
})
