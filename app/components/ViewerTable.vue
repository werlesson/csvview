<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import CsvCell from '~/components/CsvCell.vue'
import HighlightLegend from '~/components/HighlightLegend.vue'
import { useCellEditing } from '~/composables/useCellEditing'
import { isDateLikeColumn, isDateValue, isEmptyCell, parseNumber } from '~/services/columnStats'
import type { SortDirection, SortKey, ViewerColumn } from '~/composables/useViewer'

/**
 * Tabela **virtualizada** do Viewer (Fase 7, US-2.1).
 *
 * Cabeçalho fixo e apenas as linhas visíveis (mais overscan) presentes no DOM,
 * via `@tanstack/vue-virtual` — para rolar de forma fluida datasets com ~1M
 * linhas sem materializar tudo. As células usam {@link CsvCell}; colunas
 * numéricas (tipo inferido na Fase 5) alinham à direita em fonte monoespaçada.
 *
 * Recebe apenas as colunas **visíveis** e as linhas **já filtradas/ordenadas**
 * pela busca e pela ordenação; quando não há linhas, exibe o estado "nenhuma
 * linha encontrada" (US-2.2).
 *
 * Clique simples no cabeçalho ordena (`sort`, RF-01); Shift+clique adiciona à
 * ordenação multi-coluna (`sort-additive`, RF-02). A seleção da coluna para o
 * painel de estatísticas é feita por um affordance dedicado no cabeçalho
 * (`select-column`, UI-06), separado do clique de ordenação.
 *
 * Uma faixa de ~6px na borda direita do cabeçalho é o handle de redimensionamento
 * (RF-04): arrastar com Pointer Events emite `resize` (índice original + nova
 * largura) a cada movimento, com cursor `col-resize` distinto do resto do
 * cabeçalho (UI-03). A largura de cada coluna (`column.width`) substitui a
 * largura uniforme anterior — `gridWidth` soma as larguras por coluna e cada
 * `<th>`/célula recebe `--col-w` individualmente.
 *
 * O corpo do `<th>` (o botão de ordenação) é arrastável via Drag and Drop
 * nativo (RF-05): soltar sobre outro cabeçalho emite `reorder(from, to)` com
 * as posições renderizadas (não o índice original — quem resolve para índice
 * original e aplica o limite de grupo fixado/não-fixado é `reorderColumn` em
 * `useViewer`). Durante o arraste, a coluna em movimento e o ponto de inserção
 * ganham destaque visual (UI-04). A zona de arraste é o botão de ordenação —
 * distinta do handle de resize (UI-03) e do botão de estatísticas (UI-06),
 * ambos não-arrastáveis.
 *
 * Colunas fixadas (pin, RF-06) chegam já agrupadas à esquerda em `columns`
 * (ordem de fixação, resolvida por `displayColumns` em `useViewer`) e são
 * renderizadas com `position: sticky; left: <offset>`, acumulando as larguras
 * das fixadas anteriores — tanto no `<th>` quanto na célula correspondente do
 * corpo virtualizado, para preservar o alinhamento (RF-07). Um botão de pin no
 * cabeçalho emite `toggle-pin(index)` (para `togglePin` em `useViewer`); o
 * mesmo estado é refletido com o visual "fixada" (UI-05a), distinto das
 * colunas não fixadas.
 *
 * Ref de design: `.spec/init/design/README.md#screen-2--visualizador-principal`.
 */
const props = withDefaults(
  defineProps<{
    /** Colunas visíveis, na ordem do cabeçalho (cada uma com seu índice original). */
    columns: ViewerColumn[]
    /** Linhas já filtradas/ordenadas pela busca e ordenação; cada linha é o array completo de células. */
    rows: string[][]
    /** Índice da coluna selecionada (para o painel de estatísticas), ou `null`. */
    selectedIndex?: number | null
    /** Chaves de ordenação ativas, em ordem de prioridade decrescente (RF-01, RF-02). */
    sortKeys?: SortKey[]
    /** Há filtros de coluna e/ou busca ativos (RF-06, UI-03) — muda a dica e a ação do estado vazio. */
    hasActiveFilters?: boolean
    /** Estado vazio calculado por `useViewer` (RF-06); quando omitido, cai para `rows.length === 0`. */
    noResults?: boolean
    /** Mapa valor→ocorrências por coluna (índice original), sobre o dataset completo (RF-02). */
    columnDuplicateCounts?: Map<string, number>[]
  }>(),
  { selectedIndex: null, sortKeys: () => [], hasActiveFilters: false, noResults: undefined },
)

const emit = defineEmits<{
  /** Affordance dedicado de estatísticas acionado (abre/atualiza/fecha o painel de stats, UI-06). */
  (e: 'select-column', index: number | null): void
  /** Clique simples no cabeçalho: única chave de ordenação, avança asc → desc → sem ordenação (RF-01). */
  (e: 'sort', index: number): void
  /** Shift+clique no cabeçalho: adiciona/avança/remove a coluna nas chaves de ordenação (RF-02). */
  (e: 'sort-additive', index: number): void
  /** Arraste da borda direita do cabeçalho: nova largura em px para a coluna (índice original, RF-04). */
  (e: 'resize', index: number, width: number): void
  /** Soltura do arraste de reordenação: posições renderizadas de origem/destino (RF-05). */
  (e: 'reorder', from: number, to: number): void
  /** Botão de pin do cabeçalho acionado: alterna a fixação da coluna (índice original, RF-06). */
  (e: 'toggle-pin', index: number): void
  /** Ação "Limpar filtros" do estado vazio acionada (RF-06, UI-03). */
  (e: 'clear-filters'): void
}>()

/** Ação "Limpar filtros" do estado vazio (RF-06, UI-03). */
function onClearFilters(): void {
  emit('clear-filters')
}

/** Clique no cabeçalho: ordena (RF-01), ou adiciona à ordenação multi-coluna com Shift (RF-02). */
function onHeaderClick(index: number, event: MouseEvent): void {
  if (event.shiftKey) emit('sort-additive', index)
  else emit('sort', index)
}

/** Affordance dedicado (ícone) que seleciona a coluna para o painel de estatísticas; clicar de
 *  novo na coluna já selecionada fecha o painel (UI-06). */
function onSelectStats(index: number): void {
  emit('select-column', index === props.selectedIndex ? null : index)
}

/** Botão de pin do cabeçalho: alterna a fixação da coluna (RF-06). */
function onTogglePin(index: number): void {
  emit('toggle-pin', index)
}

/** A chave de ordenação ativa desta coluna (por índice original), ou `null`. */
function sortKeyFor(index: number): SortKey | null {
  return props.sortKeys.find((key) => key.index === index) ?? null
}

/** Direção de ordenação desta coluna, ou `null` quando não é chave de ordenação. */
function sortDirectionFor(index: number): SortDirection | null {
  return sortKeyFor(index)?.direction ?? null
}

/** Prioridade (1, 2, 3…) desta coluna em multi-sort, ou `null` quando não é chave (UI-02). */
function sortPriorityFor(index: number): number | null {
  const position = props.sortKeys.findIndex((key) => key.index === index)
  return position === -1 ? null : position + 1
}

/** `aria-sort` do cabeçalho, derivado da direção ativa. */
function ariaSortFor(index: number): 'ascending' | 'descending' | undefined {
  const direction = sortDirectionFor(index)
  if (direction === 'asc') return 'ascending'
  if (direction === 'desc') return 'descending'
  return undefined
}

/** Altura estimada de cada linha, em px (usada pela virtualização). */
const ROW_HEIGHT = 40

/** Largura padrão de uma coluna sem `width` definido (deve casar com `useViewer`). */
const DEFAULT_COL_WIDTH = 180

/** Largura mínima de uma coluna redimensionada, em px (RF-04; deve casar com `useViewer`). */
const MIN_COL_WIDTH = 48

/** Largura de uma coluna em px, com fallback ao padrão (RF-04). */
function widthFor(column: ViewerColumn): number {
  return column.width ?? DEFAULT_COL_WIDTH
}

/** Custom property `--col-w` desta coluna, para o `<th>`/célula correspondente. */
function colWidthStyle(column: ViewerColumn): Record<string, string> {
  return { '--col-w': `${widthFor(column)}px` }
}

/**
 * Offset `left` (em px) de cada coluna fixada, por índice original (RF-06):
 * acumula a largura das colunas fixadas anteriores. `columns` já chega com o
 * grupo fixado primeiro e na ordem de fixação (`displayColumns` em
 * `useViewer`), então basta somar as larguras na ordem em que aparecem.
 */
const pinnedOffsets = computed<Map<number, number>>(() => {
  const offsets = new Map<number, number>()
  let sum = 0
  for (const column of props.columns) {
    if (!column.pinned) continue
    offsets.set(column.index, sum)
    sum += widthFor(column)
  }
  return offsets
})

/** Offset `left` desta coluna fixada, ou `0` quando não fixada. */
function pinnedOffsetFor(index: number): number {
  return pinnedOffsets.value.get(index) ?? 0
}

/**
 * Estilo do `<th>`: largura via `--col-w` e, quando fixada, `left` acumulado
 * (a posição `sticky` em si vive em `.viewer-table__th--pinned`, CSS estático).
 */
function thStyleFor(column: ViewerColumn): Record<string, string> {
  const style = colWidthStyle(column)
  if (column.pinned) style.left = `${pinnedOffsetFor(column.index)}px`
  return style
}

/**
 * Estilo da célula do corpo virtualizado: largura via `--col-w` e, quando
 * fixada, `position: sticky` + `left` acumulado + fundo opaco (para cobrir as
 * colunas não fixadas que rolam por baixo) — preserva o alinhamento com o
 * cabeçalho fixado (RF-07). O fundo é aplicado inline (maior prioridade que
 * `.csv-cell--selected`, cuja tinta é translúcida): quando a coluna também
 * está selecionada, a tinta accent entra como camada sobre o fundo opaco (em
 * vez de substituí-lo), para não deixar a coluna fixada transparente no
 * scroll horizontal.
 */
function cellStyleFor(column: ViewerColumn): Record<string, string> {
  const style = colWidthStyle(column)
  if (!column.pinned) return style
  const selected = column.index === props.selectedIndex
  return {
    ...style,
    position: 'sticky',
    left: `${pinnedOffsetFor(column.index)}px`,
    zIndex: '1',
    background: selected
      ? 'linear-gradient(var(--accent-soft), var(--accent-soft)), var(--bg-2)'
      : 'var(--bg-2)',
  }
}

/**
 * Largura definida da grade = soma da largura de cada coluna (RF-04).
 *
 * Precisa ser um valor *definido* (não `max-content`): com `table-layout: fixed`
 * o navegador só respeita as larguras fixas das colunas se a tabela tiver largura
 * definida. Com `max-content`, ele cai no layout automático e uma célula de texto
 * longo expande a coluna, desalinhando as linhas.
 */
const gridWidth = computed(
  () => `${props.columns.reduce((sum, column) => sum + widthFor(column), 0)}px`,
)

/** Índice original da coluna sendo redimensionada no momento, ou `null`. */
const resizingIndex = ref<number | null>(null)
let resizeStartX = 0
let resizeStartWidth = 0

/** Início do arraste de redimensionamento (RF-04): registra a posição/largura iniciais. */
function onResizePointerDown(index: number, width: number, event: PointerEvent): void {
  resizingIndex.value = index
  resizeStartX = event.clientX
  resizeStartWidth = width
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

/**
 * Arraste em andamento: emite `resize` com a largura acumulada, nunca abaixo
 * de {@link MIN_COL_WIDTH} (RF-04).
 */
function onResizePointerMove(event: PointerEvent): void {
  if (resizingIndex.value === null) return
  const delta = event.clientX - resizeStartX
  const width = Math.max(MIN_COL_WIDTH, resizeStartWidth + delta)
  emit('resize', resizingIndex.value, width)
}

/** Fim do arraste de redimensionamento (pointerup/pointercancel). */
function onResizePointerUp(event: PointerEvent): void {
  if (resizingIndex.value === null) return
  ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
  resizingIndex.value = null
}

/** Posição renderizada (dentro de `columns`) da coluna sendo arrastada para reordenar, ou `null`. */
const dragFromPos = ref<number | null>(null)
/** Posição renderizada sobre a qual o arraste está no momento (ponto de inserção), ou `null`. */
const dragOverPos = ref<number | null>(null)

/** Início do arraste de reordenação (RF-05): registra a posição de origem. */
function onHeaderDragStart(pos: number, event: DragEvent): void {
  dragFromPos.value = pos
  dragOverPos.value = pos
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(pos))
  }
}

/** Cabeçalho sobrevoado durante o arraste: atualiza o ponto de inserção (UI-04). */
function onHeaderDragOver(pos: number): void {
  if (dragFromPos.value === null) return
  dragOverPos.value = pos
}

/** Soltura sobre um cabeçalho: emite `reorder(from, to)` com as posições renderizadas (RF-05). */
function onHeaderDrop(pos: number): void {
  if (dragFromPos.value === null) return
  if (dragFromPos.value !== pos) emit('reorder', dragFromPos.value, pos)
  dragFromPos.value = null
  dragOverPos.value = null
}

/** Fim do arraste (`dragend`), inclusive quando solto fora de um cabeçalho válido. */
function onHeaderDragEnd(): void {
  dragFromPos.value = null
  dragOverPos.value = null
}

/**
 * Lado do indicador de inserção (UI-04) para o cabeçalho na posição `pos`,
 * ou `null` quando não é o ponto de inserção corrente. O lado (antes/depois)
 * segue a direção do arraste em relação à origem.
 */
function dropIndicatorFor(pos: number): 'before' | 'after' | null {
  if (dragFromPos.value === null) return null
  if (dragOverPos.value !== pos || dragFromPos.value === pos) return null
  return dragOverPos.value < dragFromPos.value ? 'before' : 'after'
}

const scroller = ref<HTMLElement | null>(null)

/**
 * Legenda fixa (T07, UI-01): `<thead>` ajusta seu `top` sticky para a altura
 * medida da legenda, evitando sobreposição entre as duas faixas sticky.
 */
const legend = ref<{ $el: HTMLElement } | null>(null)
const legendHeight = ref(0)

onMounted(() => {
  legendHeight.value = legend.value?.$el?.offsetHeight ?? 0
})

const rowVirtualizer = useVirtualizer(
  computed(() => ({
    count: props.rows.length,
    getScrollElement: () => scroller.value,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })),
)

/** Apenas as linhas atualmente visíveis (mais overscan). */
const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())
/** Altura total da lista, para dimensionar a área de rolagem. */
const totalSize = computed(() => rowVirtualizer.value.getTotalSize())

/** Sem nenhuma linha para exibir (busca sem resultados ou dataset vazio). */
const isEmpty = computed(() => props.noResults ?? props.rows.length === 0)

/** Nº de ocorrências do valor desta célula na sua coluna (RF-02), ou `undefined` sem o mapa. */
function dupCountFor(column: ViewerColumn, value: string | undefined): number | undefined {
  return props.columnDuplicateCounts?.[column.index]?.get(String(value ?? '').trim())
}

/** Coluna `number` com valor preenchido `< 0` (RF-04). */
function negativeFor(column: ViewerColumn, value: string | undefined): boolean {
  if (column.type !== 'number') return false
  const parsed = parseNumber(value)
  return parsed !== null && parsed < 0
}

/**
 * Coluna "parece data" (`isDateLikeColumn`, RF-05 v1.2), pré-calculada uma vez
 * por coluna a partir das linhas recebidas — não recomputada por célula
 * renderizada. Substitui o gate `column.type === 'date'`, inatingível com
 * dados reais: `inferColumnType` só tipa `date` quando 100% das células
 * preenchidas são válidas, o que impede a própria célula inválida que RF-05
 * precisa detectar de existir numa coluna `date` (ver `SPEC.md` § Amendments
 * v1.2).
 */
const dateLikeColumns = computed<Map<number, boolean>>(() => {
  const result = new Map<number, boolean>()
  for (const column of props.columns) {
    const values = props.rows.map((row) => row[column.index])
    result.set(column.index, isDateLikeColumn(values))
  }
  return result
})

/** Coluna "parece data" (`isDateLikeColumn`) cujo valor preenchido não satisfaz `isDateValue` (RF-05). */
function invalidDateFor(column: ViewerColumn, value: string | undefined): boolean {
  return (dateLikeColumns.value.get(column.index) ?? false) && !isEmptyCell(value) && !isDateValue(value)
}

/**
 * Edição inline por linha visível (`cell-editing`, T07): consome
 * `useCellEditing()` (T03) e repassa `editable`/`editing`/`invalid-edit`/
 * `dirty` a cada `CsvCell` (T06), chamando `beginEdit`/`confirmEdit`/
 * `cancelEdit` a partir dos emits `edit-start`/`edit-confirm`/`edit-cancel`.
 * `useCellEditing`/`useCurrentDataset` indexam célula por posição no dataset
 * **completo** (CT-02, `dataset.value.rows[rowIndex]`), mas `virtualRow.index`
 * é a posição dentro de `rows` (prop já filtrada/ordenada por `useViewer`) —
 * as duas só coincidem sem filtro/ordenação ativos. `trueRowIndex` resolve
 * `virtualRow.index` para o índice real no dataset completo via identidade
 * de referência da linha (`filter`/`sort` preservam a mesma referência
 * `string[]`, nunca clonam linhas), para que uma edição sob filtro/ordenação
 * ativos (RF-13) sempre afete a linha realmente clicada, nunca a linha na
 * mesma posição do dataset completo. Nenhum emit/prop de multi-seleção,
 * paste ou estrutura é adicionado (RF-14).
 */
const { dataset: editingDataset, editingCell, validationError, beginEdit, confirmEdit, cancelEdit, isDirty } =
  useCellEditing()

/** Referência de linha (`string[]`) → índice real no dataset completo (CT-02). */
const trueRowIndexByRow = computed<Map<string[], number>>(() => {
  const map = new Map<string[], number>()
  editingDataset.value?.rows.forEach((row, index) => map.set(row, index))
  return map
})

/** Resolve a posição de uma linha visível (`virtualRow.index`, em `rows`) para seu índice real no dataset completo. */
function trueRowIndex(virtualIndex: number): number {
  const row = props.rows[virtualIndex]
  if (row === undefined) return virtualIndex
  return trueRowIndexByRow.value.get(row) ?? virtualIndex
}

/** A célula na linha/coluna indicadas está em modo de edição (RF-01). */
function isEditingCell(rowIndex: number, columnIndex: number): boolean {
  const editing = editingCell.value
  return editing !== null && editing.rowIndex === rowIndex && editing.columnIndex === columnIndex
}

/** A célula em edição teve sua última confirmação rejeitada por validação de tipo (RF-04, UI-02). */
function isInvalidEditCell(rowIndex: number, columnIndex: number): boolean {
  return isEditingCell(rowIndex, columnIndex) && validationError.value !== null
}

/** `edit-start` (RF-01): entra em modo de edição só na célula clicada. */
function onEditStart(rowIndex: number, columnIndex: number): void {
  beginEdit(rowIndex, columnIndex)
}

/** `edit-confirm` (RF-02/RF-04): confirma o valor digitado na célula em edição. */
function onEditConfirm(value: string): void {
  confirmEdit(value)
}

/** `edit-cancel` (RF-03): cancela a edição em andamento, sem tocar no histórico. */
function onEditCancel(): void {
  cancelEdit()
}
</script>

<template>
  <div
    ref="scroller"
    class="viewer-table"
    :class="{
      'viewer-table--resizing': resizingIndex !== null,
      'viewer-table--reordering': dragFromPos !== null,
    }"
    role="region"
    aria-label="Tabela de dados"
  >
    <HighlightLegend ref="legend" class="viewer-table__legend" />

    <table class="viewer-table__grid">
      <thead class="viewer-table__head" :style="{ top: `${legendHeight}px` }">
        <tr class="viewer-table__row" :style="{ width: gridWidth }">
          <th
            v-for="(column, pos) in columns"
            :key="column.index"
            class="viewer-table__th"
            :class="{
              'viewer-table__th--numeric': column.type === 'number',
              'viewer-table__th--selected': column.index === selectedIndex,
              'viewer-table__th--sorted': sortDirectionFor(column.index) !== null,
              'viewer-table__th--dragging': dragFromPos === pos,
              'viewer-table__th--drop-before': dropIndicatorFor(pos) === 'before',
              'viewer-table__th--drop-after': dropIndicatorFor(pos) === 'after',
              'viewer-table__th--pinned': column.pinned,
            }"
            :style="thStyleFor(column)"
            scope="col"
            :aria-selected="column.index === selectedIndex"
            :aria-sort="ariaSortFor(column.index)"
            @dragover.prevent="onHeaderDragOver(pos)"
            @drop.prevent="onHeaderDrop(pos)"
          >
            <div class="viewer-table__th-inner">
              <button
                type="button"
                class="viewer-table__th-button"
                draggable="true"
                @click="onHeaderClick(column.index, $event)"
                @dragstart="onHeaderDragStart(pos, $event)"
                @dragend="onHeaderDragEnd"
              >
                <span class="viewer-table__th-label">{{ column.label }}</span>
                <span class="viewer-table__th-type">{{ column.type }}</span>
                <svg
                  v-if="sortDirectionFor(column.index)"
                  class="viewer-table__th-sort-icon"
                  :class="`viewer-table__th-sort-icon--${sortDirectionFor(column.index)}`"
                  viewBox="0 0 10 10"
                  width="10"
                  height="10"
                  aria-hidden="true"
                >
                  <path
                    v-if="sortDirectionFor(column.index) === 'asc'"
                    d="M5 2 L9 8 L1 8 Z"
                    fill="currentColor"
                  />
                  <path v-else d="M5 8 L1 2 L9 2 Z" fill="currentColor" />
                </svg>
                <span
                  v-if="sortPriorityFor(column.index) !== null"
                  class="viewer-table__th-priority"
                >{{ sortPriorityFor(column.index) }}</span>
              </button>
              <button
                type="button"
                class="viewer-table__th-stats"
                draggable="false"
                :aria-label="`Ver estatísticas de ${column.label}`"
                @click="onSelectStats(column.index)"
              >
                <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                  <rect x="1" y="6" width="2.5" height="5" fill="currentColor" />
                  <rect x="5" y="3" width="2.5" height="8" fill="currentColor" />
                  <rect x="9" y="1" width="2.5" height="10" fill="currentColor" />
                </svg>
              </button>
              <button
                type="button"
                class="viewer-table__th-pin"
                :class="{ 'viewer-table__th-pin--active': column.pinned }"
                draggable="false"
                :aria-pressed="column.pinned"
                :aria-label="column.pinned ? `Desfixar coluna ${column.label}` : `Fixar coluna ${column.label}`"
                @click="onTogglePin(column.index)"
              >
                <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                  <path
                    d="M4 1.5 H8 L7.4 5 L9.5 6.8 H6.5 L5.8 10.5 H5.2 L4.5 6.8 H1.5 L3.6 5 Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
            <div
              class="viewer-table__th-resize"
              :class="{ 'viewer-table__th-resize--active': resizingIndex === column.index }"
              role="separator"
              aria-orientation="vertical"
              :aria-label="`Redimensionar coluna ${column.label}`"
              @pointerdown="onResizePointerDown(column.index, widthFor(column), $event)"
              @pointermove="onResizePointerMove"
              @pointerup="onResizePointerUp"
              @pointercancel="onResizePointerUp"
            />
          </th>
        </tr>
      </thead>
      <tbody
        v-if="!isEmpty"
        class="viewer-table__body"
        :style="{ height: `${totalSize}px` }"
      >
        <tr
          v-for="virtualRow in virtualRows"
          :key="virtualRow.key"
          class="viewer-table__row"
          :style="{ width: gridWidth, transform: `translateY(${virtualRow.start}px)` }"
        >
          <CsvCell
            v-for="column in columns"
            :key="column.index"
            :style="cellStyleFor(column)"
            :value="rows[virtualRow.index]?.[column.index]"
            :numeric="column.type === 'number'"
            :selected="column.index === selectedIndex"
            :dup-count="dupCountFor(column, rows[virtualRow.index]?.[column.index])"
            :negative="negativeFor(column, rows[virtualRow.index]?.[column.index])"
            :invalid-date="invalidDateFor(column, rows[virtualRow.index]?.[column.index])"
            editable
            :editing="isEditingCell(trueRowIndex(virtualRow.index), column.index)"
            :invalid-edit="isInvalidEditCell(trueRowIndex(virtualRow.index), column.index)"
            :dirty="isDirty(trueRowIndex(virtualRow.index), column.index)"
            @edit-start="onEditStart(trueRowIndex(virtualRow.index), column.index)"
            @edit-confirm="onEditConfirm"
            @edit-cancel="onEditCancel"
          />
        </tr>
      </tbody>
    </table>

    <div v-if="isEmpty" class="viewer-table__empty" role="status">
      <p class="viewer-table__empty-title">Nenhuma linha encontrada</p>
      <p v-if="hasActiveFilters" class="viewer-table__empty-hint">
        Nenhuma linha casa com a busca e/ou os filtros aplicados. Ajuste os critérios ou limpe os filtros.
      </p>
      <p v-else class="viewer-table__empty-hint">
        Nenhuma linha casa com a busca. Ajuste o termo ou limpe o campo.
      </p>
      <button
        v-if="hasActiveFilters"
        type="button"
        class="viewer-table__empty-clear"
        @click="onClearFilters"
      >
        Limpar filtros
      </button>
    </div>
  </div>
</template>

<style scoped>
.viewer-table {
  /* Largura de cada coluna. Custom property herda para o CsvCell (filho),
     mantendo cabeçalho e células alinhados mesmo com estilos scoped. */
  --col-w: 180px;
  position: relative;
  /* Sem card próprio: a tabela é parte da superfície unificada do Viewer e
     preenche a altura do body. Esta é a única área de scroll da tela. */
  height: 100%;
  overflow: auto;
  background: var(--bg-1);
}

/* Legenda fixa (T07, UI-01): mesma técnica de sticky do cabeçalho
   (`.viewer-table__head`), permanecendo visível acima dele durante o scroll
   vertical — `z-index` maior para ficar por cima do cabeçalho quando ambos
   colidem no topo do scroller. `left: 0` (além de `top: 0`) é necessário
   porque a legenda é irmã da `<table>` larga dentro do MESMO scroller
   (`.viewer-table`, `overflow: auto` nos dois eixos): sem `left`, o sticky só
   vale no eixo vertical e a legenda rola para fora de vista no scroll
   horizontal (achado em uso real) — `left: 0` prende também a borda esquerda
   da legenda à borda visível do scroller, como um canto sticky. */
.viewer-table__legend {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 2;
}

.viewer-table__grid {
  display: block;
  width: 100%;
  border-collapse: collapse;
}

.viewer-table__head {
  /* `display: block` (como o tbody) para que o `min-width: 100%` da linha do
     cabeçalho resolva contra a mesma largura do scroller que as linhas do corpo.
     Sem isso, o thead (table-header-group) encolhe para a largura natural e, com
     a grade esticada (poucas colunas), as colunas do cabeçalho desalinham das do
     corpo. */
  display: block;
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bg-1);
}

/* Cabeçalho e linhas são tabelas de largura fixa, para alinhar as colunas.
   A largura é *definida* via style inline (nº de colunas × --col-w) — condição
   para o `table-layout: fixed` respeitar as larguras das colunas e truncar texto
   longo (com `max-content`/`auto` o navegador cai no layout automático e uma
   célula longa expande a coluna, desalinhando as linhas). A grade pode crescer
   além do container (scroll horizontal, ex.: 70 colunas); `min-width: 100%`
   evita encolher quando há poucas colunas. */
.viewer-table__head .viewer-table__row,
.viewer-table__body .viewer-table__row {
  display: table;
  min-width: 100%;
  table-layout: fixed;
}

.viewer-table__body {
  display: block;
  position: relative;
}

.viewer-table__body .viewer-table__row {
  position: absolute;
  top: 0;
  left: 0;
}

.viewer-table__th {
  position: relative;
  width: var(--col-w);
  /* `table-cell` explícito (não o `flex` que os filhos precisam): o `<th>` é
     célula real dentro da linha `display: table` (table-layout: fixed) — um
     `display: flex` aqui escaparia do contexto de tabela e empilharia os
     cabeçalhos verticalmente. O layout flex do conteúdo vive em
     `.viewer-table__th-inner`. */
  display: table-cell;
  vertical-align: middle;
  padding: 10px 12px;
  font-family: var(--font);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-3);
  border-bottom: 1px solid var(--border);
  /* Divisor vertical entre colunas (cara de grade, fiel ao design). */
  border-right: 1px solid var(--border);
  /* Destaque animado ao trocar a coluna selecionada (RF-06b, UI-03): a
     transição vive na base do th (não só em --selected) para animar também
     a saída, quando a classe é removida. */
  transition: background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.viewer-table__th-inner {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

/* Handle de redimensionamento (RF-04): faixa fina na borda direita do cabeçalho,
   com affordance de cursor `col-resize` distinto do resto do cabeçalho — que é
   clicável para ordenar (RF-01) ou arrastável para reordenar (RF-05), UI-03. */
.viewer-table__th-resize {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  touch-action: none;
  z-index: 2;
}

.viewer-table__th-resize:hover,
.viewer-table__th-resize--active {
  background: var(--accent);
  opacity: 0.5;
}

/* Durante o arraste, o cursor de resize se aplica à tabela inteira (o ponteiro
   pode passar por cima de outras células enquanto arrasta) e o texto não deve
   ser selecionado. */
.viewer-table--resizing,
.viewer-table--resizing * {
  cursor: col-resize !important;
  user-select: none;
}

/* Durante o arraste de reordenação (RF-05), o cursor reflete o gesto de
   arrastar em toda a tabela. */
.viewer-table--reordering,
.viewer-table--reordering * {
  cursor: grabbing !important;
  user-select: none;
}

/* Feedback visual da coluna em movimento (UI-04): esmaece o cabeçalho de
   origem enquanto o arraste está em andamento. */
.viewer-table__th--dragging {
  opacity: 0.4;
}

/* Feedback visual do ponto de inserção (UI-04): uma borda de destaque no lado
   por onde a coluna arrastada entraria ao ser solta. */
.viewer-table__th--drop-before {
  box-shadow: inset 3px 0 0 var(--accent);
}

.viewer-table__th--drop-after {
  box-shadow: inset -3px 0 0 var(--accent);
}

/* Colunas numéricas: cabeçalho à direita em mono, alinhado às células. */
.viewer-table__th--numeric {
  font-family: var(--mono);
}

.viewer-table__th--numeric .viewer-table__th-button {
  justify-content: flex-end;
}

.viewer-table__th--numeric .viewer-table__th-label {
  text-align: right;
}

/* Cabeçalho ordenado: rótulo ganha destaque (o ícone de direção já indica o
   estado — cor não é o único sinal, UI-01). */
.viewer-table__th--sorted .viewer-table__th-label {
  color: var(--text);
}

/* Coluna fixada (pin, UI-05a): permanece na borda esquerda durante o scroll
   horizontal (`left` acumulado vem do estilo inline, `thStyleFor`); estado
   visual distinto das não fixadas — fundo próprio (opaco, cobre as colunas
   que rolam por baixo) e borda accent, ecoando `chip--pinned` de ColumnChip.
   `z-index` acima das colunas comuns e do cabeçalho comum (sticky top),
   para permanecer visível na interseção de ambos os eixos de scroll. */
.viewer-table__th--pinned {
  position: sticky;
  z-index: 2;
  background: var(--bg-2);
  border-right-color: var(--accent);
}

/* Coluna selecionada: destaque do cabeçalho enquanto o painel de stats está
   aberto. Faixa accent (borda inferior + laterais) para virar uma coluna
   realçada de ponta a ponta, fiel ao design. */
.viewer-table__th--selected {
  background: var(--accent-soft);
  box-shadow: inset 0 -2px 0 var(--accent);
  border-right-color: var(--accent);
  border-left: 1px solid var(--accent);
}

.viewer-table__th--selected .viewer-table__th-label {
  color: var(--accent);
}

/* Fixada + selecionada ao mesmo tempo: `--selected` sozinho troca o fundo
   opaco de `--pinned` por um tom translúcido (`--accent-soft`), deixando as
   colunas que rolam por baixo aparecerem através do cabeçalho fixado. A
   camada translúcida some sobre o fundo opaco (`--bg-2`) para manter a coluna
   fixada legível durante o scroll horizontal. */
.viewer-table__th--pinned.viewer-table__th--selected {
  background: linear-gradient(var(--accent-soft), var(--accent-soft)), var(--bg-2);
}

@media (prefers-reduced-motion: reduce) {
  .viewer-table__th {
    transition-duration: 0s;
  }
}

/* Hover de linha: realça a linha inteira sob o cursor (fiel ao design).
   --bg-2 (não --bg-hover): a linha repousa em --bg-1 (.viewer-table), e
   --bg-hover é calibrado para reusar de --bg-2 — usá-lo aqui escureceria a
   linha no hover em vez de acender (mesmo ajuste de RecentFiles.vue). */
.viewer-table__body .viewer-table__row:hover :deep(.csv-cell) {
  background: var(--bg-2);
}

.viewer-table__th-button {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
  padding: 0;
  margin: 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
}

.viewer-table__th-button:hover .viewer-table__th-label {
  color: var(--text);
}

.viewer-table__th-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-2);
}

/* Indicador de direção (UI-01): forma distinta por asc/desc (triângulo para
   cima/para baixo), não dependente apenas de cor. */
.viewer-table__th-sort-icon {
  flex: none;
  color: var(--accent);
}

/* Número de prioridade em multi-sort (UI-02). */
.viewer-table__th-priority {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 7px;
  background: var(--accent);
  color: var(--bg-1);
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  text-transform: none;
  letter-spacing: normal;
}

/* Affordance dedicado do painel de estatísticas (UI-06): distinto do clique
   de ordenação — botão próprio, fora da área clicável de `.viewer-table__th-button`. */
.viewer-table__th-stats {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--text-3);
  cursor: pointer;
}

.viewer-table__th-stats:hover {
  color: var(--accent);
  background: var(--accent-soft);
}

/* Botão de pin do cabeçalho (UI-05): alterna a fixação da coluna à esquerda
   (RF-06) — mesmo estado do controle equivalente no menu "Colunas" do
   ViewerToolbar. Ativo (coluna fixada) ganha a cor accent, ecoando
   `chip--pinned` de ColumnChip. */
.viewer-table__th-pin {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--text-3);
  cursor: pointer;
}

.viewer-table__th-pin:hover {
  color: var(--accent);
  background: var(--accent-soft);
}

.viewer-table__th-pin--active {
  color: var(--accent);
}

/* O tipo da coluna não aparece no cabeçalho (fiel ao design da Screen 2): fica
   só no leitor de tela / DOM. O tipo é exibido no painel de estatísticas ao
   selecionar a coluna. */
.viewer-table__th-type {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.viewer-table__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 48px 24px;
  text-align: center;
}

.viewer-table__empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}

.viewer-table__empty-hint {
  font-size: 13px;
  color: var(--text-3);
}

/* Ação de limpar filtros no estado vazio (RF-06, UI-03): visível apenas
   quando há filtros ativos, restaura o dataset ao acionar `clear-filters`. */
.viewer-table__empty-clear {
  margin-top: 4px;
  padding: 8px 12px;
  background: var(--accent);
  color: var(--bg-1);
  border: none;
  border-radius: var(--radius-sm);
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
</style>
