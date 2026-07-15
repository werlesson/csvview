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

/**
 * Dataset para ordenação: id (number), group (text), amount (number). O `amount`
 * `2/10/100` distingue comparação numérica de textual (lexical daria `10<100<2`).
 */
function makeSortDataset(): Dataset {
  return {
    header: ['id', 'group', 'amount'],
    rows: [
      ['1', 'b', '10'],
      ['2', 'a', '100'],
      ['3', 'a', '2'],
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

  describe('ordenação (máquina de estados + sortedRows)', () => {
    // RF-01 — clique simples: ciclo asc → desc → sem ordenação
    it('sort-single-cycle: 3 cliques em sortColumn ciclam asc, desc e ordem original', () => {
      const { sortColumn, sortedRows, sortKeys } = useViewer(() =>
        makeSortDataset(),
      )

      // Sem ordenação, sortedRows mantém a ordem original do dataset.
      expect(sortedRows.value.map((r) => r[0])).toEqual(['1', '2', '3'])
      expect(sortKeys.value).toEqual([])

      // 1º clique → ascendente (numérico: 2 < 10 < 100, não lexical).
      sortColumn(2)
      expect(sortKeys.value).toEqual([{ index: 2, direction: 'asc' }])
      expect(sortedRows.value.map((r) => r[0])).toEqual(['3', '1', '2'])

      // 2º clique → descendente.
      sortColumn(2)
      expect(sortKeys.value).toEqual([{ index: 2, direction: 'desc' }])
      expect(sortedRows.value.map((r) => r[0])).toEqual(['2', '1', '3'])

      // 3º clique → sem ordenação (volta à ordem original).
      sortColumn(2)
      expect(sortKeys.value).toEqual([])
      expect(sortedRows.value.map((r) => r[0])).toEqual(['1', '2', '3'])
    })

    // RF-02 — Shift+clique adiciona chave secundária com prioridade distinguível
    it('sort-additive-priority: sortColumnAdditive(A) então (B) ordena por A e, em empate, por B', () => {
      const { sortColumnAdditive, sortKeys, sortedRows } = useViewer(() =>
        makeSortDataset(),
      )

      sortColumnAdditive(1) // group (A) — prioridade 1
      sortColumnAdditive(2) // amount (B) — prioridade 2

      // A=1 (group asc), B=2 (amount asc em empate de group).
      expect(sortKeys.value).toEqual([
        { index: 1, direction: 'asc' },
        { index: 2, direction: 'asc' },
      ])
      // group a,a,b; dentro de "a", amount 2 antes de 100.
      expect(sortedRows.value.map((r) => r[0])).toEqual(['3', '2', '1'])
      expect(sortedRows.value.map((r) => r[1])).toEqual(['a', 'a', 'b'])
    })

    // RF-01 (2ª AC) — clique simples sobre multi-sort reduz a uma única chave
    it('sort-reduce-multi-to-single: um sortColumn após multi-sort reduz a uma só chave', () => {
      const { sortColumn, sortColumnAdditive, sortKeys, sortedRows } =
        useViewer(() => makeSortDataset())

      sortColumnAdditive(1) // group
      sortColumnAdditive(2) // amount
      expect(sortKeys.value).toHaveLength(2)

      // Clique simples em amount: descarta group, fica só amount asc.
      sortColumn(2)
      expect(sortKeys.value).toEqual([{ index: 2, direction: 'asc' }])
      // Ordenado só por amount: 2 < 10 < 100 → ids 3,1,2.
      expect(sortedRows.value.map((r) => r[0])).toEqual(['3', '1', '2'])
    })

    // RF-02 (2ª AC) — 3º toque em A a remove; B mantém-se e assume prioridade 1
    it('sort-additive-remove: o 3º sortColumnAdditive(A) remove A e B vira prioridade 1', () => {
      const { sortColumnAdditive, sortKeys, sortedRows } = useViewer(() =>
        makeSortDataset(),
      )

      sortColumnAdditive(1) // A (group) asc — toque 1
      sortColumnAdditive(2) // B (amount) asc
      sortColumnAdditive(1) // A → desc — toque 2
      expect(sortKeys.value).toEqual([
        { index: 1, direction: 'desc' },
        { index: 2, direction: 'asc' },
      ])

      sortColumnAdditive(1) // A → removida — toque 3
      // Só B permanece, agora prioridade 1.
      expect(sortKeys.value).toEqual([{ index: 2, direction: 'asc' }])
      expect(sortedRows.value.map((r) => r[0])).toEqual(['3', '1', '2'])
    })

    // RF-03 — vazios ao fim em qualquer direção (via makeComparator)
    it('sort-empties-last: células vazias vão ao fim em asc e em desc', () => {
      const { sortColumn, sortedRows } = useViewer(() => ({
        header: ['amount'],
        rows: [['10'], [''], ['2'], ['100']],
      }))

      sortColumn(0) // asc
      expect(sortedRows.value.map((r) => r[0])).toEqual(['2', '10', '100', ''])

      sortColumn(0) // desc — vazio continua ao fim
      expect(sortedRows.value.map((r) => r[0])).toEqual(['100', '10', '2', ''])
    })

    // RNF-02/derivação — sortedRows deriva de filteredRows (respeita a busca)
    it('sort-derives-from-search: sortedRows ordena apenas as linhas da busca ativa', () => {
      const { search, sortColumn, sortedRows } = useViewer(() =>
        makeSortDataset(),
      )

      // Busca casa apenas as linhas do group "a" (ids 2 e 3).
      search.value = 'a'
      expect(sortedRows.value.map((r) => r[0])).toEqual(['2', '3'])

      // Ordenar por amount asc reordena SÓ essas linhas: 2 (id3) antes de 100 (id2).
      sortColumn(2)
      expect(sortedRows.value.map((r) => r[0])).toEqual(['3', '2'])
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
