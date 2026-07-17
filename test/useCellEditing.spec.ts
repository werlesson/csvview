import { beforeEach, describe, expect, it } from 'vitest'
import { useCellEditing } from '~/composables/useCellEditing'
import {
  useCurrentDataset,
  type Dataset,
  type DatasetMeta,
} from '~/composables/useCurrentDataset'

// Colunas: id (number, 0), name (text, 1), joined (date, 2), active
// (boolean, 3), email (email, 4), website (url, 5).
function makeDataset(): Dataset {
  return {
    header: ['id', 'name', 'joined', 'active', 'email', 'website'],
    rows: [
      ['1', 'Ana', '2024-01-01', 'true', 'ana@example.com', 'https://ana.example.com'],
      ['2', 'Bruno', '2024-02-01', 'false', 'bruno@example.com', 'https://bruno.example.com'],
      ['3', 'Carla', '2024-03-01', 'true', 'carla@example.com', 'https://carla.example.com'],
    ],
  }
}

let nextId = 1

function makeMeta(overrides: Partial<DatasetMeta> = {}): DatasetMeta {
  return {
    id: nextId++,
    name: 'people.csv',
    delimiter: 'comma',
    sizeBytes: 42,
    rowCount: 3,
    columnCount: 6,
    ...overrides,
  }
}

/** Carrega um dataset novo com `id` sempre distinto, forçando o reset (RF-10). */
function loadDataset(overrides: Partial<DatasetMeta> = {}): Dataset {
  const dataset = makeDataset()
  useCurrentDataset().setDataset(dataset, makeMeta(overrides))
  return dataset
}

describe('useCellEditing', () => {
  beforeEach(() => {
    loadDataset()
  })

  describe('RF-01: beginEdit entra em modo de edição', () => {
    it('pré-preenche editingCell com o valor atual da célula', () => {
      const { beginEdit, editingCell } = useCellEditing()

      beginEdit(0, 1)

      expect(editingCell.value).toEqual({ rowIndex: 0, columnIndex: 1, value: 'Ana' })
    })
  })

  describe('RF-02: confirmEdit com valor válido', () => {
    it('atualiza a célula exibida e sai do modo de edição', () => {
      const { beginEdit, confirmEdit, editingCell, dataset } = editingHandles()

      beginEdit(0, 1)
      const result = confirmEdit('Alice')

      expect(result).toBe(true)
      expect(dataset.value?.rows[0]?.[1]).toBe('Alice')
      expect(editingCell.value).toBeNull()
    })
  })

  describe('RF-03: cancelEdit restaura o valor original', () => {
    it('não altera a célula e não empilha entrada de histórico', () => {
      const { beginEdit, cancelEdit, undoStack, editingCell, dataset } = editingHandles()

      beginEdit(0, 1)
      cancelEdit()

      expect(editingCell.value).toBeNull()
      expect(dataset.value?.rows[0]?.[1]).toBe('Ana')
      expect(undoStack.value).toHaveLength(0)
    })
  })

  describe('RF-04: confirmEdit rejeita valor inválido para o tipo inferido', () => {
    it('mantém o valor original, sinaliza erro e não empilha', () => {
      const { beginEdit, confirmEdit, validationError, undoStack, dataset } =
        editingHandles()

      beginEdit(0, 0) // coluna "id", tipo number
      const result = confirmEdit('não-numérico')

      expect(result).toBe(false)
      expect(dataset.value?.rows[0]?.[0]).toBe('1')
      expect(validationError.value).not.toBeNull()
      expect(undoStack.value).toHaveLength(0)
    })

    it('aceita célula vazia independentemente do tipo inferido', () => {
      const { beginEdit, confirmEdit, dataset } = editingHandles()

      beginEdit(0, 0)
      const result = confirmEdit('')

      expect(result).toBe(true)
      expect(dataset.value?.rows[0]?.[0]).toBe('')
    })
  })

  describe('RF-05: cada confirmação válida soma exatamente 1 entrada', () => {
    it('undoStack cresce em exatamente 1 por edição confirmada', () => {
      const { beginEdit, confirmEdit, undoStack } = editingHandles()

      beginEdit(0, 1)
      confirmEdit('Alice')
      expect(undoStack.value).toHaveLength(1)

      beginEdit(1, 1)
      confirmEdit('Bru')
      expect(undoStack.value).toHaveLength(2)
    })
  })

  describe('RF-06/RF-07: undo/redo', () => {
    it('undo reverte a edição confirmada mais recente', () => {
      const { beginEdit, confirmEdit, undo, dataset } = editingHandles()

      beginEdit(0, 1)
      confirmEdit('Alice')
      undo()

      expect(dataset.value?.rows[0]?.[1]).toBe('Ana')
    })

    it('redo sem edição intermediária restaura o valor pré-undo', () => {
      const { beginEdit, confirmEdit, undo, redo, dataset } = editingHandles()

      beginEdit(0, 1)
      confirmEdit('Alice')
      undo()
      redo()

      expect(dataset.value?.rows[0]?.[1]).toBe('Alice')
    })
  })

  describe('RF-08: nova edição após undo descarta o redo pendente', () => {
    it('redoStack fica vazio imediatamente após a nova edição, redo não reaplica', () => {
      const { beginEdit, confirmEdit, undo, redo, redoStack, dataset } = editingHandles()

      beginEdit(0, 1)
      confirmEdit('Alice')
      undo()

      beginEdit(0, 1)
      confirmEdit('Alicia')

      expect(redoStack.value).toHaveLength(0)

      redo()
      expect(dataset.value?.rows[0]?.[1]).toBe('Alicia')
    })
  })

  describe('RF-09: undo/redo inertes sem entradas correspondentes', () => {
    it('canUndo/canRedo ficam false sem edições; undo/redo não alteram nenhuma célula', () => {
      const { canUndo, canRedo, undo, redo, dataset } = editingHandles()

      expect(canUndo.value).toBe(false)
      expect(canRedo.value).toBe(false)

      const before = JSON.parse(JSON.stringify(dataset.value))
      undo()
      redo()

      expect(dataset.value).toEqual(before)
    })

    it('canUndo/canRedo refletem o estado das pilhas após edições/undo/redo', () => {
      const { beginEdit, confirmEdit, undo, redo, canUndo, canRedo } = editingHandles()

      beginEdit(0, 1)
      confirmEdit('Alice')
      expect(canUndo.value).toBe(true)
      expect(canRedo.value).toBe(false)

      undo()
      expect(canUndo.value).toBe(false)
      expect(canRedo.value).toBe(true)

      redo()
      expect(canUndo.value).toBe(true)
      expect(canRedo.value).toBe(false)
    })
  })

  describe('RF-10: trocar meta.id zera as duas pilhas', () => {
    it('undo/redo/edições anteriores deixam de ser desfazíveis após trocar de dataset', () => {
      const { beginEdit, confirmEdit, undoStack, redoStack, canUndo, canRedo } =
        editingHandles()

      beginEdit(0, 1)
      confirmEdit('Alice')
      expect(undoStack.value).toHaveLength(1)

      // Simula reabrir outro arquivo: novo dataset, novo id.
      loadDataset()

      expect(undoStack.value).toHaveLength(0)
      expect(redoStack.value).toHaveLength(0)
      expect(canUndo.value).toBe(false)
      expect(canRedo.value).toBe(false)
    })
  })
})

/** Agrupa os handles usados em quase todo teste, incluindo `dataset` para asserts. */
function editingHandles() {
  return { ...useCellEditing(), dataset: useCurrentDataset().dataset }
}
