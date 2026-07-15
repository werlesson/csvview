import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ViewerTable from '~/components/ViewerTable.vue'
import type { ViewerColumn } from '~/composables/useViewer'

function makeColumns(): ViewerColumn[] {
  return [
    { index: 0, label: 'id', type: 'number', visible: true, pinned: false, width: 180 },
    { index: 1, label: 'name', type: 'text', visible: true, pinned: false, width: 180 },
    { index: 2, label: 'amount', type: 'number', visible: true, pinned: false, width: 180 },
  ]
}

const ROWS = [
  ['1', 'Ana', '100'],
  ['2', 'Bruno', '250'],
]

describe('ViewerTable', () => {
  it('renderiza um cabeçalho por coluna visível', () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })

    const headers = wrapper.findAll('.viewer-table__th')
    expect(headers.map((h) => h.text())).toEqual([
      'idnumber',
      'nametext',
      'amountnumber',
    ])
  })

  // columns-toggle → ocultar remove a coluna da tabela
  it('columns-toggle: uma coluna oculta não aparece no cabeçalho da tabela', () => {
    // Colunas visíveis sem "name" (index 1) — como useViewer entrega ao ocultar.
    const visible = makeColumns().filter((c) => c.index !== 1)
    const wrapper = mount(ViewerTable, {
      props: { columns: visible, rows: ROWS },
    })

    const labels = wrapper
      .findAll('.viewer-table__th-label')
      .map((h) => h.text())
    expect(labels).toEqual(['id', 'amount'])
    expect(labels).not.toContain('name')
  })

  it('alinha à direita em mono o cabeçalho das colunas numéricas', () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })

    const headers = wrapper.findAll('.viewer-table__th')
    // id/amount (number) → numeric; name (text) → não.
    expect(headers[0]!.classes()).toContain('viewer-table__th--numeric')
    expect(headers[1]!.classes()).not.toContain('viewer-table__th--numeric')
    expect(headers[2]!.classes()).toContain('viewer-table__th--numeric')
  })

  // RF-05: colunas inteira e decimal (ambas type === 'number') mantêm o
  // alinhamento à direita; text/date/boolean/email/url NÃO recebem. O
  // cabeçalho e a célula (CsvCell :numeric, ViewerTable.vue:119) compartilham
  // a mesma condição `column.type === 'number'`, logo o cabeçalho prova o
  // gating de ambos (paridade com o caso number acima).
  it('alinha à direita colunas inteira e decimal; demais tipos não', () => {
    // integer e decimal são ambos inferidos como `number` pelo motor (a
    // distinção vive em NumericStats.numericKind, não em ViewerColumn.type).
    const columns: ViewerColumn[] = [
      { index: 0, label: 'qtd', type: 'number', visible: true }, // inteira
      { index: 1, label: 'preco', type: 'number', visible: true }, // decimal
      { index: 2, label: 'name', type: 'text', visible: true },
      { index: 3, label: 'created', type: 'date', visible: true },
      { index: 4, label: 'ativo', type: 'boolean', visible: true },
      { index: 5, label: 'email', type: 'email', visible: true },
      { index: 6, label: 'site', type: 'url', visible: true },
    ]
    const rows = [
      ['1', '1.5', 'Ana', '2020-01-01', 'sim', 'a@b.com', 'https://x.io'],
      ['2', '2.75', 'Bruno', '2021-12-31', 'não', 'c@d.org', 'http://y.io/p'],
    ]

    const wrapper = mount(ViewerTable, { props: { columns, rows } })
    const headers = wrapper.findAll('.viewer-table__th')

    // Apenas inteira/decimal (type === 'number') alinhadas à direita.
    expect(headers[0]!.classes()).toContain('viewer-table__th--numeric') // inteira
    expect(headers[1]!.classes()).toContain('viewer-table__th--numeric') // decimal
    // text/date/boolean/email/url NÃO recebem alinhamento à direita.
    for (const i of [2, 3, 4, 5, 6]) {
      expect(headers[i]!.classes()).not.toContain('viewer-table__th--numeric')
    }
  })

  it('exibe o estado "nenhuma linha encontrada" quando não há linhas', () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: [] },
    })

    expect(wrapper.find('.viewer-table__empty').exists()).toBe(true)
    expect(wrapper.text()).toContain('Nenhuma linha encontrada')
    // Sem corpo de tabela quando vazio.
    expect(wrapper.find('.viewer-table__body').exists()).toBe(false)
  })

  it('mantém o corpo da tabela quando há linhas', () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })

    expect(wrapper.find('.viewer-table__empty').exists()).toBe(false)
    expect(wrapper.find('.viewer-table__body').exists()).toBe(true)
  })

  // stats-select-column → clicar no cabeçalho seleciona a coluna
  it('stats-select-column: clicar no cabeçalho emite select-column com o índice', async () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })

    // Clica no cabeçalho da terceira coluna (index 2, "amount").
    await wrapper.findAll('.viewer-table__th-button')[2]!.trigger('click')

    expect(wrapper.emitted('select-column')).toEqual([[2]])
  })

  it('marca o cabeçalho da coluna selecionada', () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS, selectedIndex: 2 },
    })

    const headers = wrapper.findAll('.viewer-table__th')
    expect(headers[0]!.classes()).not.toContain('viewer-table__th--selected')
    expect(headers[2]!.classes()).toContain('viewer-table__th--selected')
    expect(headers[2]!.attributes('aria-selected')).toBe('true')
  })
})
