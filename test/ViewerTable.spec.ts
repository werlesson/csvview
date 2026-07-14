import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ViewerTable from '~/components/ViewerTable.vue'
import type { ViewerColumn } from '~/composables/useViewer'

function makeColumns(): ViewerColumn[] {
  return [
    { index: 0, label: 'id', type: 'number', visible: true },
    { index: 1, label: 'name', type: 'text', visible: true },
    { index: 2, label: 'amount', type: 'number', visible: true },
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
})
