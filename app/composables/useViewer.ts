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
import {
  isFilterInert,
  matchesFilters,
  type ColumnFilter,
} from '~/services/columnFilters'

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
  /** Se a coluna está fixada (pin) à esquerda (RF-06). */
  pinned: boolean
  /** Largura atual da coluna em pixels (RF-04). */
  width: number
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
  /**
   * Ordem de exibição das colunas NÃO fixadas, como posição → índice
   * **original** da coluna (RF-05) — sobrevive a ocultar/reexibir. Vazio (ou
   * de tamanho divergente do dataset atual) equivale à ordem identidade do
   * cabeçalho; ver `effectiveOrder`. Estado apenas em memória (RNF-04).
   */
  const order = ref<number[]>([])
  /**
   * Conjunto de colunas fixadas (pin) à esquerda, por índice **original**
   * (RF-06). A ordem de iteração de um `Set` é a ordem de inserção, o que
   * registra a **sequência de fixação** usada para ordenar o grupo fixado.
   * Estado apenas em memória (RNF-04).
   */
  const pinned = ref<Set<number>>(new Set())
  /**
   * Filtros de coluna ativos (RF-07): cada entrada é um `ColumnFilter` (chip
   * do painel de filtros), referenciando a coluna por índice **original** —
   * inclusive colunas ocultas. Estado apenas em memória de sessão; nada é
   * gravado em IndexedDB/localStorage.
   */
  const filters = ref<ColumnFilter[]>([])

  const dataset = computed<Dataset>(() => toValue(source) ?? EMPTY_DATASET)

  /**
   * `order` normalizado para o dataset atual: quando o estado guardado não
   * cobre todas as colunas (estado inicial ou dataset trocado), cai para a
   * ordem identidade do cabeçalho.
   */
  const effectiveOrder = computed<number[]>(() => {
    const count = dataset.value.header.length
    if (order.value.length === count) return order.value
    return dataset.value.header.map((_, index) => index)
  })

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

  /** Todas as colunas do dataset, com tipo, visibilidade, pin e largura atuais. */
  const columns = computed<ViewerColumn[]>(() =>
    dataset.value.header.map((label, index) => ({
      index,
      label,
      type: columnTypes.value[index] ?? 'text',
      visible: !hidden.value.has(index),
      pinned: pinned.value.has(index),
      width: widths.value.get(index) ?? DEFAULT_COLUMN_WIDTH,
    })),
  )

  /** Somente as colunas visíveis, na ordem do cabeçalho (o que a tabela mostra). */
  const visibleColumns = computed<ViewerColumn[]>(() =>
    columns.value.filter((column) => column.visible),
  )

  /** Há uma busca ativa (termo não vazio após aparar espaços). */
  const isSearching = computed(() => search.value.trim() !== '')

  /**
   * Filtros não-inertes (RF-05): só estes restringem `filteredRows`. Um filtro
   * cujo operador exige valor e ainda não o recebeu é ignorado até completar.
   */
  const activeFilters = computed<ColumnFilter[]>(() =>
    filters.value.filter((filter) => !isFilterInert(filter)),
  )

  /** Nº de filtros (chips) no painel, ativos ou não (UI-02). */
  const activeFilterCount = computed(() => filters.value.length)

  /**
   * Linhas que satisfazem a busca **e** todos os filtros de coluna ativos
   * (RF-03, RF-04): o termo casa (ignorando caixa) em qualquer célula da linha
   * — inclusive de colunas ocultas — e cada filtro é avaliado por
   * `matchesFilters` na mesma passagem O(N) (RNF-01). Sem termo nem filtros
   * ativos, devolve todas as linhas (limpar busca e filtros restaura o
   * dataset completo).
   */
  const filteredRows = computed<string[][]>(() => {
    const term = search.value.trim().toLowerCase()
    const activeFiltersList = activeFilters.value
    if (term === '' && activeFiltersList.length === 0) return dataset.value.rows

    const types = columnTypes.value
    return dataset.value.rows.filter((row) => {
      if (
        term !== '' &&
        !row.some(
          (cell) => cell != null && String(cell).toLowerCase().includes(term),
        )
      ) {
        return false
      }
      return matchesFilters(activeFiltersList, row, types)
    })
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
  /**
   * A busca e/ou os filtros ativos não retornaram nenhuma linha — dispara o
   * estado vazio (US-2.2, RF-06).
   */
  const noResults = computed(
    () =>
      (isSearching.value || activeFilters.value.length > 0) &&
      filteredRows.value.length === 0,
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

  /** Adiciona um novo filtro de coluna (chip) ao painel de filtros (RF-05). */
  function addFilter(filter: ColumnFilter): void {
    filters.value = [...filters.value, filter]
  }

  /**
   * Atualiza o filtro na posição `index` (coluna, operador e/ou valor) sem
   * afetar os demais; no-op se `index` estiver fora do intervalo (RF-05).
   */
  function updateFilter(index: number, patch: Partial<ColumnFilter>): void {
    const current = filters.value[index]
    if (current === undefined) return
    const next = [...filters.value]
    next[index] = { ...current, ...patch }
    filters.value = next
  }

  /** Remove o filtro na posição `index`, reampliando as linhas que ele excluía. */
  function removeFilter(index: number): void {
    filters.value = filters.value.filter((_, i) => i !== index)
  }

  /** Remove todos os filtros de coluna, restaurando o efeito só da busca. */
  function clearFilters(): void {
    filters.value = []
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

  /** Fixa uma coluna (por índice original) à esquerda; no-op se já fixada. */
  function pinColumn(index: number): void {
    if (pinned.value.has(index)) return
    const next = new Set(pinned.value)
    next.add(index)
    pinned.value = next
  }

  /** Desfixa uma coluna (por índice original); no-op se já não fixada. */
  function unpinColumn(index: number): void {
    if (!pinned.value.has(index)) return
    const next = new Set(pinned.value)
    next.delete(index)
    pinned.value = next
  }

  /** Alterna a fixação de uma coluna (por índice original). */
  function togglePin(index: number): void {
    if (pinned.value.has(index)) unpinColumn(index)
    else pinColumn(index)
  }

  /**
   * Colunas visíveis na ordem final de exibição (RF-05, RF-06): o grupo
   * fixado primeiro (na ordem de fixação), seguido do grupo não-fixado (na
   * ordem de `order`). Cada coluna é anotada com `pinned`/`width`.
   */
  const displayColumns = computed<ViewerColumn[]>(() => {
    const byIndex = new Map(columns.value.map((column) => [column.index, column]))
    const visibleSet = new Set(visibleColumns.value.map((column) => column.index))

    const pinnedList = [...pinned.value]
      .filter((index) => visibleSet.has(index))
      .map((index) => byIndex.get(index)!)

    const unpinnedList = effectiveOrder.value
      .filter((index) => visibleSet.has(index) && !pinned.value.has(index))
      .map((index) => byIndex.get(index)!)

    return [...pinnedList, ...unpinnedList]
  })

  /**
   * Reordena uma coluna (RF-05): `from`/`to` são posições dentro de
   * `displayColumns`. A reordenação opera DENTRO do grupo (fixado ou
   * não-fixado) da coluna arrastada — soltar fora do próprio grupo é
   * clampado para a borda do grupo (não cruza para o outro grupo). Estado
   * mantido por índice original (`order` para não-fixadas, sequência de
   * `pinned` para fixadas); O(colunas), sem cópia O(linhas) (RNF-03).
   */
  function reorderColumn(from: number, to: number): void {
    const list = displayColumns.value
    if (from < 0 || from >= list.length || to < 0 || to >= list.length) return
    if (from === to) return

    const movingColumn = list[from]!
    const pinnedCount = list.filter((column) => column.pinned).length
    const groupStart = movingColumn.pinned ? 0 : pinnedCount
    const groupEnd = movingColumn.pinned ? pinnedCount - 1 : list.length - 1
    const clampedTo = Math.min(Math.max(to, groupStart), groupEnd)
    if (clampedTo === from) return

    if (movingColumn.pinned) {
      const pinnedIndices = list
        .filter((column) => column.pinned)
        .map((column) => column.index)
      const fromPos = pinnedIndices.indexOf(movingColumn.index)
      pinnedIndices.splice(fromPos, 1)
      pinnedIndices.splice(clampedTo, 0, movingColumn.index)
      pinned.value = new Set(pinnedIndices)
      return
    }

    const isVisible = (index: number): boolean =>
      visibleColumns.value.some((column) => column.index === index)
    const unpinnedVisible = effectiveOrder.value.filter(
      (index) => isVisible(index) && !pinned.value.has(index),
    )
    const fromPos = unpinnedVisible.indexOf(movingColumn.index)
    const toPos = clampedTo - pinnedCount
    unpinnedVisible.splice(fromPos, 1)
    unpinnedVisible.splice(toPos, 0, movingColumn.index)

    let cursor = 0
    order.value = effectiveOrder.value.map((index) => {
      if (isVisible(index) && !pinned.value.has(index)) {
        return unpinnedVisible[cursor++]!
      }
      return index
    })
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
    filters,
    activeFilters,
    activeFilterCount,
    addFilter,
    updateFilter,
    removeFilter,
    clearFilters,
    sortKeys,
    sortedRows,
    sortColumn,
    sortColumnAdditive,
    widths,
    resizeColumn,
    columnWidth,
    order,
    pinned,
    pinColumn,
    unpinColumn,
    togglePin,
    reorderColumn,
    displayColumns,
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
