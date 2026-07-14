import { describe, expect, it } from 'vitest'
import { useViewer } from '~/composables/useViewer'
import type { Dataset } from '~/composables/useCurrentDataset'

/** Dataset de exemplo: id (number), name (text), amount (number). */
function makeDataset(): Dataset {
  return {
    header: ['id', 'name', 'amount'],
    rows: [
      ['1', 'Ana', '100'],
      ['2', 'Bruno', '250'],
      ['3', 'Carla', '-50'],
    ],
  }
}

describe('useViewer', () => {
  it('infere o tipo de cada coluna via Fase 5 (number vs text)', () => {
    const { columnTypes } = useViewer(() => makeDataset())
    expect(columnTypes.value).toEqual(['number', 'text', 'number'])
  })

  describe('busca global', () => {
    // search-any-column → casa em qualquer coluna
    it('search-any-column: casa o termo em qualquer coluna', () => {
      const { search, filteredRows } = useViewer(() => makeDataset())

      // Primeira coluna (id).
      search.value = '2'
      expect(filteredRows.value.map((r) => r[0])).toEqual(['2'])

      // Coluna do meio (name).
      search.value = 'Bruno'
      expect(filteredRows.value.map((r) => r[0])).toEqual(['2'])

      // Última coluna (amount) — prova o casamento fora da primeira coluna.
      search.value = '-50'
      expect(filteredRows.value.map((r) => r[0])).toEqual(['3'])
    })

    // search-clear-restores → limpar restaura
    it('search-clear-restores: limpar a busca restaura todas as linhas', () => {
      const { search, filteredRows } = useViewer(() => makeDataset())

      search.value = 'Carla'
      expect(filteredRows.value).toHaveLength(1)

      search.value = ''
      expect(filteredRows.value).toHaveLength(3)
    })

    it('search-clear-restores: clearSearch() também restaura o dataset', () => {
      const { search, filteredRows, clearSearch } = useViewer(() => makeDataset())

      search.value = 'Ana'
      expect(filteredRows.value).toHaveLength(1)

      clearSearch()
      expect(search.value).toBe('')
      expect(filteredRows.value).toHaveLength(3)
    })

    // search-case-insensitive → busca ignora caixa
    it('search-case-insensitive: a busca ignora a caixa', () => {
      const { search, filteredRows } = useViewer(() => makeDataset())

      search.value = 'ANA'
      expect(filteredRows.value.map((r) => r[1])).toEqual(['Ana'])

      search.value = 'bRuNo'
      expect(filteredRows.value.map((r) => r[1])).toEqual(['Bruno'])
    })

    it('sinaliza "nenhuma linha encontrada" quando a busca não casa', () => {
      const { search, filteredRows, noResults } = useViewer(() => makeDataset())

      expect(noResults.value).toBe(false)

      search.value = 'inexistente'
      expect(filteredRows.value).toHaveLength(0)
      expect(noResults.value).toBe(true)
    })
  })

  describe('seleção de colunas', () => {
    // columns-toggle → ocultar remove a coluna da tabela
    it('columns-toggle: ocultar remove a coluna das visíveis', () => {
      const { columns, visibleColumns, toggleColumn } = useViewer(() =>
        makeDataset(),
      )

      expect(visibleColumns.value.map((c) => c.label)).toEqual([
        'id',
        'name',
        'amount',
      ])

      toggleColumn(1) // oculta "name"
      expect(visibleColumns.value.map((c) => c.label)).toEqual(['id', 'amount'])
      expect(columns.value[1]!.visible).toBe(false)

      toggleColumn(1) // reexibe "name"
      expect(visibleColumns.value.map((c) => c.label)).toEqual([
        'id',
        'name',
        'amount',
      ])
    })

    // columns-hidden-stats-intact → busca/stats inalteradas com coluna oculta
    it('columns-hidden-stats-intact: busca e estatísticas permanecem corretas com coluna oculta', () => {
      const { search, filteredRows, columnStats, hideColumn } = useViewer(() =>
        makeDataset(),
      )

      const statsBefore = JSON.stringify(columnStats.value)

      hideColumn(1) // oculta "name"

      // Estatísticas inalteradas: continuam cobrindo todas as colunas.
      expect(columnStats.value).toHaveLength(3)
      expect(JSON.stringify(columnStats.value)).toBe(statsBefore)
      expect(columnStats.value[2]!.type).toBe('number')

      // Busca ainda casa em coluna oculta (a visibilidade não altera resultados).
      search.value = 'Ana'
      expect(filteredRows.value.map((r) => r[0])).toEqual(['1'])
    })
  })

  describe('seleção de coluna (painel de estatísticas)', () => {
    it('sem seleção, não há coluna nem estatísticas selecionadas', () => {
      const { selectedIndex, selectedColumn, selectedStats } = useViewer(() =>
        makeDataset(),
      )

      expect(selectedIndex.value).toBeNull()
      expect(selectedColumn.value).toBeNull()
      expect(selectedStats.value).toBeNull()
    })

    // stats-select-column → selecionar expõe as stats da coluna
    it('stats-select-column: selecionar uma coluna expõe suas estatísticas (Fase 5)', () => {
      const { selectColumn, selectedColumn, selectedStats } = useViewer(() =>
        makeDataset(),
      )

      selectColumn(2) // amount (number)

      expect(selectedColumn.value?.label).toBe('amount')
      expect(selectedStats.value?.type).toBe('number')
      // As métricas numéricas só existem para colunas numéricas.
      expect(selectedStats.value?.numeric).toBeDefined()
    })

    // stats-change-column → trocar de coluna atualiza o painel
    it('stats-change-column: trocar de coluna atualiza a seleção', () => {
      const { selectColumn, selectedColumn, selectedStats } = useViewer(() =>
        makeDataset(),
      )

      selectColumn(0) // id (number)
      expect(selectedColumn.value?.label).toBe('id')
      expect(selectedStats.value?.type).toBe('number')

      selectColumn(1) // name (text)
      expect(selectedColumn.value?.label).toBe('name')
      expect(selectedStats.value?.type).toBe('text')
      expect(selectedStats.value?.numeric).toBeUndefined()
    })

    it('selecionar null limpa a seleção', () => {
      const { selectColumn, selectedColumn, selectedStats } = useViewer(() =>
        makeDataset(),
      )

      selectColumn(1)
      expect(selectedColumn.value).not.toBeNull()

      selectColumn(null)
      expect(selectedColumn.value).toBeNull()
      expect(selectedStats.value).toBeNull()
    })

    it('a seleção independe da visibilidade da coluna', () => {
      const { selectColumn, hideColumn, selectedColumn, selectedStats } =
        useViewer(() => makeDataset())

      selectColumn(1) // name
      hideColumn(1) // oculta name

      // A coluna selecionada continua acessível, mesmo oculta.
      expect(selectedColumn.value?.label).toBe('name')
      expect(selectedColumn.value?.visible).toBe(false)
      expect(selectedStats.value?.type).toBe('text')
    })
  })
})
