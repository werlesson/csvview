import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import type { Dataset } from '~/composables/useCurrentDataset'
import {
  columnValues,
  computeColumnStats,
  inferColumnType,
  makeComparator,
  type ColumnStats,
  type ColumnType,
} from '~/services/columnStats'

/**
 * Estado do **Viewer** (Fase 7): busca global, seleção de colunas e derivações
 * a partir do dataset carregado (tipos inferidos e estatísticas da Fase 5).
 *
 * Toda a lógica é pura e reativa, desacoplada da UI: a página e a tabela apenas
 * consomem o que este composable expõe. As duas invariantes-chave (US-2.3):
 *
 * - a **busca** casa o termo em *qualquer* coluna da linha — inclusive colunas
 *   ocultas — de modo que esconder uma coluna não altera os resultados;
 * - as **estatísticas** e a inferência de tipo são sempre calculadas sobre o
 *   dataset completo, independentemente da visibilidade das colunas.
 *
 * Referência: `.spec/init/project-phases.md` (Fase 7); US-2.1, US-2.2, US-2.3.
 */

/** Uma coluna do Viewer: índice, rótulo, tipo inferido e visibilidade. */
export interface ViewerColumn {
  /** Índice da coluna no cabeçalho/linha do dataset. */
  index: number
  /** Rótulo (nome) da coluna. */
  label: string
  /** Tipo inferido (Fase 5): `number` | `date` | `text`. */
  type: ColumnType
  /** Se a coluna está visível na tabela. */
  visible: boolean
}

/** Direção de ordenação de uma chave. */
export type SortDirection = 'asc' | 'desc'

/**
 * Uma chave de ordenação: coluna (por índice **original**, não pela posição
 * renderizada — sobrevive a ocultar/reexibir e reordenar) e direção. A ordem
 * das chaves no array é a prioridade decrescente (a primeira é a de maior
 * prioridade).
 */
export interface SortKey {
  /** Índice original da coluna no cabeçalho do dataset. */
  index: number
  /** Direção da comparação nesta coluna. */
  direction: SortDirection
}

const EMPTY_DATASET: Dataset = { header: [], rows: [] }

/** Largura mínima de coluna em pixels (RF-04) — sem largura máxima. */
const MIN_COLUMN_WIDTH = 48
/** Largura padrão de coluna quando não há largura definida. */
const DEFAULT_COLUMN_WIDTH = 180

export function useViewer(source: MaybeRefOrGetter<Dataset | null>) {
  /** Termo da busca global (US-2.2). */
  const search = ref('')
  /** Índices das colunas ocultas pelo seletor de colunas (US-2.3). */
  const hidden = ref<Set<number>>(new Set())
  /** Índice da coluna selecionada para o painel de estatísticas (US-3.1). */
  const selectedIndex = ref<number | null>(null)
  /**
   * Chaves de ordenação ativas, por índice **original** da coluna e em ordem de
   * prioridade decrescente (RF-01, RF-02). Vazio = ordem original do dataset.
   * Estado apenas em memória de sessão — nada é gravado em IndexedDB (RNF-04).
   */
  const sortKeys = ref<SortKey[]>([])
  /**
   * Larguras de coluna definidas pelo usuário, por índice **original** da
   * coluna (RF-04) — sobrevive a ocultar/reexibir e reordenar. Colunas sem
   * entrada usam a largura padrão (`columnWidth`). Estado apenas em memória de
   * sessão — nada é gravado em IndexedDB (RNF-04); ajustes são O(1), sem
   * re-parse nem cópia de linhas (RNF-03).
   */
  const widths = ref<Map<number, number>>(new Map())

  const dataset = computed<Dataset>(() => toValue(source) ?? EMPTY_DATASET)

  /**
   * Tipo inferido por coluna (Fase 5), sobre o dataset completo. Independe da
   * visibilidade — esconder uma coluna não muda os tipos das demais.
   */
  const columnTypes = computed<ColumnType[]>(() =>
    dataset.value.header.map((_, index) =>
      inferColumnType(columnValues(dataset.value.rows, index)),
    ),
  )

  /**
   * Estatísticas por coluna (Fase 5), sempre sobre o dataset completo. Colunas
   * ocultas continuam com estatísticas corretas (US-2.3).
   */
  const columnStats = computed<ColumnStats[]>(() =>
    dataset.value.header.map((_, index) =>
      computeColumnStats(columnValues(dataset.value.rows, index)),
    ),
  )

  /** Todas as colunas do dataset, com tipo e visibilidade atual. */
  const columns = computed<ViewerColumn[]>(() =>
    dataset.value.header.map((label, index) => ({
      index,
      label,
      type: columnTypes.value[index] ?? 'text',
      visible: !hidden.value.has(index),
    })),
  )

  /** Somente as colunas visíveis, na ordem do cabeçalho (o que a tabela mostra). */
  const visibleColumns = computed<ViewerColumn[]>(() =>
    columns.value.filter((column) => column.visible),
  )

  /** Há uma busca ativa (termo não vazio após aparar espaços). */
  const isSearching = computed(() => search.value.trim() !== '')

  /**
   * Linhas que satisfazem a busca. O termo casa (ignorando caixa) em qualquer
   * célula da linha — inclusive de colunas ocultas. Sem termo, devolve todas as
   * linhas (limpar a busca restaura o dataset completo).
   */
  const filteredRows = computed<string[][]>(() => {
    const term = search.value.trim().toLowerCase()
    if (term === '') return dataset.value.rows
    return dataset.value.rows.filter((row) =>
      row.some(
        (cell) => cell != null && String(cell).toLowerCase().includes(term),
      ),
    )
  })

  /**
   * Linhas exibidas já ordenadas (RF-01, RF-02, RF-03). Deriva de
   * `filteredRows`, preservando a invariante da busca (a busca casa em qualquer
   * coluna). Sem chaves ativas, devolve `filteredRows` intacto (ordem original);
   * com chaves, ordena uma **cópia** aplicando `makeComparator` (por tipo
   * inferido) em prioridade decrescente. Como o `sort` do V8 é estável, empates
   * preservam a ordem, viabilizando a ordenação multi-chave incremental.
   *
   * A ordenação é **síncrona** neste `computed` (sem Web Worker nem chunking),
   * conforme RNF-02; só copia ao ordenar, não a cada interação de coluna.
   */
  const sortedRows = computed<string[][]>(() => {
    const keys = sortKeys.value
    const rows = filteredRows.value
    if (keys.length === 0) return rows

    const types = columnTypes.value
    const comparators = keys.map((key) => ({
      index: key.index,
      compare: makeComparator(types[key.index] ?? 'text', key.direction),
    }))

    return [...rows].sort((rowA, rowB) => {
      for (const { index, compare } of comparators) {
        const result = compare(rowA[index], rowB[index])
        if (result !== 0) return result
      }
      return 0
    })
  })

  /** Total de linhas do dataset (sem filtro). */
  const totalRows = computed(() => dataset.value.rows.length)
  /** Nº de linhas atualmente exibidas (após a busca). */
  const visibleRowCount = computed(() => filteredRows.value.length)
  /** A busca não retornou nenhuma linha — dispara o estado vazio (US-2.2). */
  const noResults = computed(
    () => isSearching.value && filteredRows.value.length === 0,
  )

  /** Alterna a visibilidade de uma coluna (mostrar/ocultar). */
  function toggleColumn(index: number): void {
    const next = new Set(hidden.value)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    hidden.value = next
  }

  /** Oculta uma coluna, se ainda visível. */
  function hideColumn(index: number): void {
    if (!hidden.value.has(index)) toggleColumn(index)
  }

  /** Reexibe uma coluna, se estiver oculta. */
  function showColumn(index: number): void {
    if (hidden.value.has(index)) toggleColumn(index)
  }

  /** Limpa a busca, restaurando o dataset completo. */
  function clearSearch(): void {
    search.value = ''
  }

  /**
   * Ordenação por **clique simples** (sem Shift) num cabeçalho (RF-01): trata a
   * coluna como a única chave, descartando quaisquer outras, e avança o ciclo
   * `asc → desc → sem ordenação`. Partindo de "sem ordenação" (ou de uma chave
   * diferente / multi-coluna), reinicia em `asc`; se a coluna já for a única
   * chave, avança `asc → desc` e, de `desc`, esvazia (volta à ordem original).
   */
  function sortColumn(index: number): void {
    const keys = sortKeys.value
    const isSoleKey = keys.length === 1 && keys[0]!.index === index
    if (isSoleKey) {
      sortKeys.value =
        keys[0]!.direction === 'asc' ? [{ index, direction: 'desc' }] : []
    } else {
      sortKeys.value = [{ index, direction: 'asc' }]
    }
  }

  /**
   * Ordenação por **Shift+clique** num cabeçalho (RF-02): adiciona a coluna às
   * chaves ativas sem descartar as anteriores, ao fim (menor prioridade). Se a
   * coluna já é chave, avança seu ciclo `asc → desc → sem ordenação`; ao chegar
   * em "sem ordenação" a coluna é REMOVIDA, e as demais mantêm a ordem relativa
   * de prioridade.
   */
  function sortColumnAdditive(index: number): void {
    const keys = sortKeys.value
    const existing = keys.find((key) => key.index === index)
    if (existing === undefined) {
      sortKeys.value = [...keys, { index, direction: 'asc' }]
    } else if (existing.direction === 'asc') {
      sortKeys.value = keys.map((key) =>
        key.index === index ? { index, direction: 'desc' } : key,
      )
    } else {
      sortKeys.value = keys.filter((key) => key.index !== index)
    }
  }

  /**
   * Redimensiona uma coluna (por índice **original**, RF-04): aplica a nova
   * largura clampada a um mínimo de 48px (sem máximo). O(1), sem re-parse nem
   * cópia de linhas (RNF-03); apenas em memória (RNF-04).
   */
  function resizeColumn(index: number, width: number): void {
    const next = new Map(widths.value)
    next.set(index, Math.max(MIN_COLUMN_WIDTH, width))
    widths.value = next
  }

  /**
   * Largura atual de uma coluna (por índice original), ou o padrão de 180px
   * quando nenhuma largura foi definida.
   */
  function columnWidth(index: number): number {
    return widths.value.get(index) ?? DEFAULT_COLUMN_WIDTH
  }

  /**
   * A coluna atualmente selecionada (para o painel de estatísticas), ou `null`
   * quando nenhuma está selecionada ou o índice caiu fora do dataset atual
   * (ex.: dataset trocado). Independe da visibilidade da coluna.
   */
  const selectedColumn = computed<ViewerColumn | null>(() => {
    const index = selectedIndex.value
    if (index === null) return null
    return columns.value[index] ?? null
  })

  /**
   * Estatísticas (Fase 5) da coluna selecionada, ou `null` quando não há
   * seleção. Trocar a seleção atualiza este valor — é o que alimenta o painel.
   */
  const selectedStats = computed<ColumnStats | null>(() => {
    const index = selectedIndex.value
    if (index === null) return null
    return columnStats.value[index] ?? null
  })

  /**
   * Seleciona uma coluna (por índice) para o painel de estatísticas; `null`
   * limpa a seleção e fecha o painel (US-3.1).
   */
  function selectColumn(index: number | null): void {
    selectedIndex.value = index
  }

  return {
    search,
    columns,
    visibleColumns,
    columnTypes,
    columnStats,
    filteredRows,
    sortKeys,
    sortedRows,
    sortColumn,
    sortColumnAdditive,
    widths,
    resizeColumn,
    columnWidth,
    totalRows,
    visibleRowCount,
    isSearching,
    noResults,
    selectedIndex,
    selectedColumn,
    selectedStats,
    toggleColumn,
    hideColumn,
    showColumn,
    clearSearch,
    selectColumn,
  }
}
