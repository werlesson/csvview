import { computed, readonly, ref, watch } from 'vue'
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

const editingCell = ref<EditingCell | null>(null)
const validationError = ref<string | null>(null)
const undoStack = ref<CellEditEntry[]>([])
const redoStack = ref<CellEditEntry[]>([])
/**
 * `undoStack.length` no momento do último `markSaved()` — a "posição salva"
 * na linha do tempo de undo/redo. Ver {@link hasUnsavedChanges}.
 */
const savedPosition = ref(0)

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
      { rowIndex, columnIndex, previousValue, nextValue: value },
    ]
    redoStack.value = []
    validationError.value = null
    editingCell.value = null
    return true
  }

  /** Desfaz a edição confirmada mais recente (RF-06). Inerte sem entradas (RF-09). */
  function undo(): void {
    const entries = undoStack.value
    if (entries.length === 0) return
    const entry = entries[entries.length - 1]!
    undoStack.value = entries.slice(0, -1)
    updateCell(entry.rowIndex, entry.columnIndex, entry.previousValue)
    redoStack.value = [...redoStack.value, entry]
  }

  /** Refaz a edição desfeita mais recente (RF-07). Inerte sem entradas (RF-09). */
  function redo(): void {
    const entries = redoStack.value
    if (entries.length === 0) return
    const entry = entries[entries.length - 1]!
    redoStack.value = entries.slice(0, -1)
    updateCell(entry.rowIndex, entry.columnIndex, entry.nextValue)
    undoStack.value = [...undoStack.value, entry]
  }

  /** `true` quando a célula tem ao menos uma edição desfazível pendente (UI-03). */
  function isDirty(rowIndex: number, columnIndex: number): boolean {
    return undoStack.value.some(
      (entry) => entry.rowIndex === rowIndex && entry.columnIndex === columnIndex,
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
  }
}
