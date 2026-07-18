import { computed, readonly, ref, watch, type Ref } from 'vue'
import { useCurrentDataset } from '~/composables/useCurrentDataset'
import {
  columnValues,
  inferColumnType,
  isBooleanValue,
  isDateValue,
  isEmailValue,
  isEmptyCell,
  isUrlValue,
  parseNumber,
  type ColumnType,
} from '~/services/columnStats'

/**
 * Composable de edição inline de célula, undo/redo e validação por tipo
 * (Fase 2 de `cell-editing`).
 *
 * Orquestra o ciclo `beginEdit` → `confirmEdit`/`cancelEdit` (RF-01 a RF-04) e
 * uma pilha de undo/redo em memória (RF-05 a RF-09), chaveada pelo
 * `DatasetMeta.id` do dataset atualmente carregado (CT-02): trocar de arquivo
 * zera as duas pilhas (RF-10). Usa `useCurrentDataset()` internamente —
 * `dataset`/`meta`/`updateCell` (T02) — mantendo o dataset `readonly` para os
 * demais consumidores.
 *
 * Estado em escopo de módulo (mesmo padrão de `useCurrentDataset`): permite
 * que `CsvCell`/`ViewerTable`/`ViewerToolbar` compartilhem a mesma sessão de
 * edição sem prop-drilling de estado mutável.
 *
 * Referência: `.spec/features/cell-editing/SPEC.md` (RF-01 a RF-10, CT-02,
 * RNF-01, RNF-03); `.spec/features/cell-editing/PLAN.md` (T03).
 */

/** Célula atualmente em modo de edição, ou `null` fora de edição (RF-01). */
export interface EditingCell {
  rowIndex: number
  columnIndex: number
  /** Valor da célula no momento em que a edição começou (pré-preenche o campo). */
  value: string
}

/** Uma entrada de histórico: célula afetada + valores anterior/novo (CT-02). */
export interface CellEditEntry {
  rowIndex: number
  columnIndex: number
  previousValue: string
  nextValue: string
}

/**
 * Uma entrada de histórico de reordenação de coluna (CT-01): snapshot
 * completo de `order`/`pinned` antes e depois de um gesto de arraste
 * concluído — nunca `from`/`to`, que ficariam frágeis contra um estado atual
 * possivelmente diferente do momento em que o gesto ocorreu.
 */
export interface ReorderHistoryEntry {
  kind: 'reorder'
  previousOrder: number[]
  previousPinned: number[]
  nextOrder: number[]
  nextPinned: number[]
}

/**
 * Entrada discriminada da pilha compartilhada de undo/redo (CT-01, CT-02):
 * edição de célula (`kind: 'cell'`, formato inalterado de `CellEditEntry`) ou
 * reordenação de coluna (`kind: 'reorder'`).
 */
export type HistoryEntry = ({ kind: 'cell' } & CellEditEntry) | ReorderHistoryEntry

const editingCell = ref<EditingCell | null>(null)
const validationError = ref<string | null>(null)
const undoStack = ref<HistoryEntry[]>([])
const redoStack = ref<HistoryEntry[]>([])
/**
 * `undoStack.length` no momento do último `markSaved()` — a "posição salva"
 * na linha do tempo de undo/redo. Ver {@link hasUnsavedChanges}.
 */
const savedPosition = ref(0)

/**
 * Ponteiros de módulo para os refs `order`/`pinned` da instância de
 * `useViewer()` renderizada em `viewer.vue` — ponto de integração explícito
 * de CT-02, atribuídos por {@link registerColumnOrderState}. `null` fora de
 * uma sessão de Viewer montada (ex.: antes do primeiro registro, ou após um
 * reset de dataset).
 */
let columnOrderRef: Ref<number[]> | null = null
let columnPinnedRef: Ref<Set<number>> | null = null

/**
 * Registra os refs mutáveis de `order`/`pinned` de `useViewer()` como o
 * destino de undo/redo de entradas `reorder` (CT-02). Chamado uma única vez
 * por `viewer.vue`, logo após instanciar `useViewer(...)` — os MESMOS refs
 * retornados por `useViewer`, nunca cópias, para que undo/redo mutem o
 * estado que a tabela efetivamente renderiza.
 */
export function registerColumnOrderState(
  order: Ref<number[]>,
  pinned: Ref<Set<number>>,
): void {
  columnOrderRef = order
  columnPinnedRef = pinned
}

/**
 * Reseta as pilhas e o estado de edição em andamento sempre que o objeto
 * `dataset` é trocado por um novo — abrir/reabrir um arquivo (RF-10, CT-02),
 * inclusive o mesmo arquivo, sempre reparseia e chama `setDataset` com uma
 * instância nova. Propositalmente **não** observa `meta.value.id`: "Salvar
 * como cópia" muda o `id` via `updateMeta` sem trocar o `dataset` (mesmas
 * linhas em memória) — undo/redo continuam disponíveis normalmente depois de
 * salvar. `flush: 'sync'` evita qualquer espera perceptível (RNF-01).
 */
watch(
  () => useCurrentDataset().dataset.value,
  () => {
    editingCell.value = null
    validationError.value = null
    undoStack.value = []
    redoStack.value = []
    savedPosition.value = 0
    columnOrderRef = null
    columnPinnedRef = null
  },
  { flush: 'sync' },
)

/**
 * Valida um valor confirmado contra o tipo inferido da coluna (RF-04),
 * reaproveitando os reconhecedores de `columnStats.ts`. Célula vazia é
 * sempre válida, espelhando `isEmptyCell` nunca invalidar um tipo em
 * `inferColumnType`.
 */
function isValidForType(type: ColumnType, value: string): boolean {
  if (isEmptyCell(value)) return true
  switch (type) {
    case 'number':
      return parseNumber(value) !== null
    case 'date':
      return isDateValue(value)
    case 'boolean':
      return isBooleanValue(value)
    case 'email':
      return isEmailValue(value)
    case 'url':
      return isUrlValue(value)
    default:
      return true
  }
}

export function useCellEditing() {
  const { dataset, meta, updateCell } = useCurrentDataset()

  function cellValue(rowIndex: number, columnIndex: number): string {
    return dataset.value?.rows[rowIndex]?.[columnIndex] ?? ''
  }

  /** Entra em modo de edição para a célula indicada (RF-01). No-op fora dos limites. */
  function beginEdit(rowIndex: number, columnIndex: number): void {
    const row = dataset.value?.rows[rowIndex]
    if (!row || columnIndex < 0 || columnIndex >= row.length) return
    editingCell.value = { rowIndex, columnIndex, value: row[columnIndex] ?? '' }
    validationError.value = null
  }

  /** Cancela a edição em andamento, sem tocar no histórico (RF-03). */
  function cancelEdit(): void {
    editingCell.value = null
    validationError.value = null
  }

  /**
   * Confirma o valor da célula em edição (RF-02). Recalcula
   * `inferColumnType` a cada chamada — nunca cacheado entre edições
   * (RNF-01) — e valida o `value` contra o tipo resultante (RF-04).
   *
   * Valor inválido: seta `validationError`, não muta o dataset, não
   * empilha nada, mantém `editingCell` (permite corrigir) e retorna `false`.
   *
   * Valor válido: aplica via `updateCell`, empilha exatamente 1 entrada em
   * `undoStack`, esvazia `redoStack` (RF-08), sai do modo de edição e
   * retorna `true`.
   */
  function confirmEdit(value: string): boolean {
    const editing = editingCell.value
    if (!editing || !dataset.value) return false

    const { rowIndex, columnIndex } = editing
    const type = inferColumnType(columnValues(dataset.value.rows, columnIndex))

    if (!isValidForType(type, value)) {
      validationError.value = `Valor inválido para o tipo "${type}" desta coluna.`
      return false
    }

    const previousValue = cellValue(rowIndex, columnIndex)
    updateCell(rowIndex, columnIndex, value)
    undoStack.value = [
      ...undoStack.value,
      { kind: 'cell', rowIndex, columnIndex, previousValue, nextValue: value },
    ]
    redoStack.value = []
    validationError.value = null
    editingCell.value = null
    return true
  }

  /**
   * Empilha uma entrada de reordenação de coluna (RF-01, CT-01), com o
   * snapshot completo de `order`/`pinned` antes/depois de um gesto de
   * arraste concluído, e esvazia `redoStack` (RF-04) — mesmo padrão de
   * `confirmEdit`. Chamado pelo ponto de integração de `viewer.vue` (T04)
   * após comparar que a ordem resultante difere da anterior.
   */
  function pushReorderEntry(
    previousOrder: number[],
    previousPinned: number[],
    nextOrder: number[],
    nextPinned: number[],
  ): void {
    undoStack.value = [
      ...undoStack.value,
      { kind: 'reorder', previousOrder, previousPinned, nextOrder, nextPinned },
    ]
    redoStack.value = []
  }

  /** Desfaz a ação confirmada mais recente (RF-06, RF-02). Inerte sem entradas (RF-09). */
  function undo(): void {
    const entries = undoStack.value
    if (entries.length === 0) return
    const entry = entries[entries.length - 1]!
    undoStack.value = entries.slice(0, -1)
    if (entry.kind === 'cell') {
      updateCell(entry.rowIndex, entry.columnIndex, entry.previousValue)
    } else if (columnOrderRef && columnPinnedRef) {
      columnOrderRef.value = entry.previousOrder
      columnPinnedRef.value = new Set(entry.previousPinned)
    }
    redoStack.value = [...redoStack.value, entry]
  }

  /** Refaz a ação desfeita mais recente (RF-07, RF-03). Inerte sem entradas (RF-09). */
  function redo(): void {
    const entries = redoStack.value
    if (entries.length === 0) return
    const entry = entries[entries.length - 1]!
    redoStack.value = entries.slice(0, -1)
    if (entry.kind === 'cell') {
      updateCell(entry.rowIndex, entry.columnIndex, entry.nextValue)
    } else if (columnOrderRef && columnPinnedRef) {
      columnOrderRef.value = entry.nextOrder
      columnPinnedRef.value = new Set(entry.nextPinned)
    }
    undoStack.value = [...undoStack.value, entry]
  }

  /** `true` quando a célula tem ao menos uma edição desfazível pendente (UI-03). */
  function isDirty(rowIndex: number, columnIndex: number): boolean {
    return undoStack.value.some(
      (entry) =>
        entry.kind === 'cell' &&
        entry.rowIndex === rowIndex &&
        entry.columnIndex === columnIndex,
    )
  }

  /**
   * Marca a posição atual da linha do tempo de undo/redo (`undoStack.length`)
   * como salva — chamado por `useSaveVersion` após "Salvar como cópia"/
   * "Sobrescrever original" bem-sucedidos. Ver {@link hasUnsavedChanges}.
   */
  function markSaved(): void {
    savedPosition.value = undoStack.value.length
  }

  return {
    dataset,
    meta,
    editingCell: readonly(editingCell),
    validationError: readonly(validationError),
    undoStack: computed(() => undoStack.value),
    redoStack: computed(() => redoStack.value),
    canUndo: computed(() => undoStack.value.length > 0),
    canRedo: computed(() => redoStack.value.length > 0),
    /**
     * `true` quando a posição atual (`undoStack.length`) diverge da última
     * `markSaved()` — independente de `canUndo`/`canRedo`, que refletem só a
     * existência de histórico (não se ele já foi salvo). Ex.: editar → salvar
     * → desfazer → refazer volta a `false` (mesma posição salva); editar duas
     * vezes → salvar → desfazer uma vez fica `true` (posição diverge).
     */
    hasUnsavedChanges: computed(() => undoStack.value.length !== savedPosition.value),
    beginEdit,
    confirmEdit,
    cancelEdit,
    undo,
    redo,
    isDirty,
    markSaved,
    registerColumnOrderState,
    pushReorderEntry,
    columnOrder: computed(() => columnOrderRef?.value ?? []),
    columnPinned: computed(() => columnPinnedRef?.value ?? new Set<number>()),
  }
}
