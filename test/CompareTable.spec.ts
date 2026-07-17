import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CompareTable, { type CompareTableColumn } from '~/components/CompareTable.vue'
import type { ComparisonRecord } from '~/services/diffDatasets'

function makeColumns(): CompareTableColumn[] {
  return [
    { name: 'id', type: 'number', indexA: 0, indexB: 0 },
    { name: 'name', type: 'text', indexA: 1, indexB: 1 },
    { name: 'amount', type: 'number', indexA: 2, indexB: 2 },
    { name: 'city', type: 'text', indexA: 3, indexB: 3 },
    { name: 'status', type: 'text', indexA: 4, indexB: 4 },
  ]
}

function makeRecord(overrides: Partial<ComparisonRecord> = {}): ComparisonRecord {
  return {
    status: 'unchanged',
    indexA: 0,
    indexB: 0,
    rowA: ['1', 'Ana', '100', 'SP', 'ok'],
    rowB: ['1', 'Ana', '100', 'SP', 'ok'],
    diffColumns: [],
    ...overrides,
  }
}

// Ver memória do projeto (viewertable-virtualizer-no-body-rows-jsdom): sob
// happy-dom, `@tanstack/vue-virtual` mede `offsetHeight` do scroller como 0
// por padrão e não renderiza nenhuma linha de corpo. Estufar o stub + esperar
// dois `nextTick()` (1º assenta o template ref do scroller, 2º aplica a
// medição) dá linhas de corpo reais para testar.
async function mountWithRows(props: Record<string, unknown>) {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400)
  const wrapper = mount(CompareTable, { props })
  await nextTick()
  await nextTick()
  return wrapper
}

describe('CompareTable', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('UI-02 — marcação exata das células divergentes', () => {
    it('um registro `changed` com 2 de 5 colunas divergentes marca exatamente essas 2 células', async () => {
      const record = makeRecord({
        status: 'changed',
        rowB: ['1', 'Ana', '150', 'RJ', 'ok'],
        diffColumns: ['amount', 'city'],
      })
      const wrapper = await mountWithRows({ commonColumns: makeColumns(), records: [record] })

      const row = wrapper.find('.compare-table__body .compare-table__row')
      const cells = row.findAll('.compare-table__cell')
      // cells[0] é a coluna de status; colunas de dado começam em 1.
      const dataCells = cells.slice(1)

      expect(dataCells[0]!.classes()).not.toContain('compare-table__cell--diff') // id
      expect(dataCells[1]!.classes()).not.toContain('compare-table__cell--diff') // name
      expect(dataCells[2]!.classes()).toContain('compare-table__cell--diff') // amount
      expect(dataCells[3]!.classes()).toContain('compare-table__cell--diff') // city
      expect(dataCells[4]!.classes()).not.toContain('compare-table__cell--diff') // status
    })

    it('registros `added`/`removed` renderizam sem indicador de diff de célula', async () => {
      const added = makeRecord({
        status: 'added',
        indexA: null,
        rowA: null,
        rowB: ['2', 'Bruno', '200', 'RJ', 'ok'],
      })
      const removed = makeRecord({
        status: 'removed',
        indexB: null,
        rowB: null,
        rowA: ['3', 'Carla', '300', 'MG', 'ok'],
      })
      const wrapper = await mountWithRows({
        commonColumns: makeColumns(),
        records: [added, removed],
      })

      const rows = wrapper.findAll('.compare-table__body .compare-table__row')
      for (const row of rows) {
        const diffCells = row.findAll('.compare-table__cell--diff')
        expect(diffCells).toHaveLength(0)
      }
    })

    it('exibe o status de cada linha via Badge', async () => {
      const wrapper = await mountWithRows({
        commonColumns: makeColumns(),
        records: [makeRecord({ status: 'changed', diffColumns: ['amount'] })],
      })

      const row = wrapper.find('.compare-table__body .compare-table__row')
      expect(row.text()).toContain('Alterado')
    })
  })

  describe('UI-04 — estado vazio', () => {
    it('`noResults` mostra o estado vazio', () => {
      const wrapper = mount(CompareTable, {
        props: { commonColumns: makeColumns(), records: [], noResults: true },
      })

      expect(wrapper.find('.compare-table__empty').exists()).toBe(true)
      expect(wrapper.find('.compare-table__body').exists()).toBe(false)
    })

    it('sem registros e sem `noResults` explícito também cai no estado vazio', () => {
      const wrapper = mount(CompareTable, {
        props: { commonColumns: makeColumns(), records: [] },
      })

      expect(wrapper.find('.compare-table__empty').exists()).toBe(true)
    })

    it('com registros e `noResults` false, não mostra o estado vazio', async () => {
      const wrapper = await mountWithRows({
        commonColumns: makeColumns(),
        records: [makeRecord()],
        noResults: false,
      })

      expect(wrapper.find('.compare-table__empty').exists()).toBe(false)
    })
  })
})
