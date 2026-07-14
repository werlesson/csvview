import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import type { Dataset } from '~/composables/useCurrentDataset'
import {
  columnValues,
  computeColumnStats,
  inferColumnType,
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

const EMPTY_DATASET: Dataset = { header: [], rows: [] }

export function useViewer(source: MaybeRefOrGetter<Dataset | null>) {
  /** Termo da busca global (US-2.2). */
  const search = ref('')
  /** Índices das colunas ocultas pelo seletor de colunas (US-2.3). */
  const hidden = ref<Set<number>>(new Set())

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

  return {
    search,
    columns,
    visibleColumns,
    columnTypes,
    columnStats,
    filteredRows,
    totalRows,
    visibleRowCount,
    isSearching,
    noResults,
    toggleColumn,
    hideColumn,
    showColumn,
    clearSearch,
  }
}
