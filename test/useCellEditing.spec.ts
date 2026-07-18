import { ref } from 'vue'
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

  describe('RF-10: trocar o dataset (abrir outro arquivo) zera as duas pilhas', () => {
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

    it('trocar só meta.id (ex.: "Salvar como cópia", via updateMeta) não reseta as pilhas — mesmo dataset em memória', () => {
      const { beginEdit, confirmEdit, undoStack, canUndo } = editingHandles()

      beginEdit(0, 1)
      confirmEdit('Alice')
      expect(undoStack.value).toHaveLength(1)

      // "Salvar como cópia" só troca meta.id/name (updateMeta), sem trocar o
      // objeto dataset — undo/redo continuam disponíveis após salvar.
      useCurrentDataset().updateMeta({ id: 999, name: 'people (cópia).csv' })

      expect(undoStack.value).toHaveLength(1)
      expect(canUndo.value).toBe(true)
    })
  })

  describe('reorder (CT-01/CT-02): pushReorderEntry, undo/redo, dispatch por kind', () => {
    it('pushReorderEntry empilha exatamente 1 entrada e esvazia redoStack', () => {
      const { pushReorderEntry, undo, undoStack, redoStack, registerColumnOrderState } =
        editingHandles()
      const orderRef = ref<number[]>([0, 1, 2, 3, 4, 5])
      const pinnedRef = ref<Set<number>>(new Set())
      registerColumnOrderState(orderRef, pinnedRef)

      // Cria uma entrada de redo pendente antes, pra garantir que é esvaziada.
      pushReorderEntry([0, 1, 2, 3, 4, 5], [], [1, 0, 2, 3, 4, 5], [])
      undo()
      expect(redoStack.value).toHaveLength(1)

      pushReorderEntry([0, 1, 2, 3, 4, 5], [], [2, 0, 1, 3, 4, 5], [])

      expect(undoStack.value).toHaveLength(1)
      expect(undoStack.value[0]).toEqual({
        kind: 'reorder',
        previousOrder: [0, 1, 2, 3, 4, 5],
        previousPinned: [],
        nextOrder: [2, 0, 1, 3, 4, 5],
        nextPinned: [],
      })
      expect(redoStack.value).toHaveLength(0)
    })

    it('undo() numa entrada reorder restaura previousOrder/previousPinned exatos nos refs registrados', () => {
      const { pushReorderEntry, undo, registerColumnOrderState } = editingHandles()
      const orderRef = ref<number[]>([0, 1, 2, 3, 4, 5])
      const pinnedRef = ref<Set<number>>(new Set([3, 1]))
      registerColumnOrderState(orderRef, pinnedRef)

      pushReorderEntry([0, 1, 2, 3, 4, 5], [3, 1], [5, 0, 1, 2, 3, 4], [1, 3])
      orderRef.value = [5, 0, 1, 2, 3, 4]
      pinnedRef.value = new Set([1, 3])

      undo()

      expect(orderRef.value).toEqual([0, 1, 2, 3, 4, 5])
      expect(Array.from(pinnedRef.value)).toEqual([3, 1])
    })

    it('redo() numa entrada reorder reaplica nextOrder/nextPinned exatos nos refs registrados', () => {
      const { pushReorderEntry, undo, redo, registerColumnOrderState } = editingHandles()
      const orderRef = ref<number[]>([0, 1, 2, 3, 4, 5])
      const pinnedRef = ref<Set<number>>(new Set([3, 1]))
      registerColumnOrderState(orderRef, pinnedRef)

      pushReorderEntry([0, 1, 2, 3, 4, 5], [3, 1], [5, 0, 1, 2, 3, 4], [1, 3])
      orderRef.value = [5, 0, 1, 2, 3, 4]
      pinnedRef.value = new Set([1, 3])

      undo()
      redo()

      expect(orderRef.value).toEqual([5, 0, 1, 2, 3, 4])
      expect(Array.from(pinnedRef.value)).toEqual([1, 3])
    })

    it('sequência intercalada edição→reorder→edição desfeita 3x reverte na ordem cronológica real, não agrupada por tipo', () => {
      const {
        beginEdit,
        confirmEdit,
        pushReorderEntry,
        undo,
        registerColumnOrderState,
        dataset,
      } = editingHandles()
      const orderRef = ref<number[]>([0, 1, 2, 3, 4, 5])
      const pinnedRef = ref<Set<number>>(new Set())
      registerColumnOrderState(orderRef, pinnedRef)

      // 1) edição de célula: name da linha 0, Ana -> Alice.
      beginEdit(0, 1)
      confirmEdit('Alice')

      // 2) reordenação: move a última coluna para o início.
      const previousOrder = [...orderRef.value]
      const nextOrder = [5, 0, 1, 2, 3, 4]
      orderRef.value = nextOrder
      pushReorderEntry(previousOrder, [], nextOrder, [])

      // 3) edição de célula: name da linha 1, Bruno -> Bru.
      beginEdit(1, 1)
      confirmEdit('Bru')

      expect(dataset.value?.rows[0]?.[1]).toBe('Alice')
      expect(orderRef.value).toEqual([5, 0, 1, 2, 3, 4])
      expect(dataset.value?.rows[1]?.[1]).toBe('Bru')

      // undo #1 reverte a edição mais recente (célula da linha 1).
      undo()
      expect(dataset.value?.rows[1]?.[1]).toBe('Bruno')
      expect(orderRef.value).toEqual([5, 0, 1, 2, 3, 4])
      expect(dataset.value?.rows[0]?.[1]).toBe('Alice')

      // undo #2 reverte a reordenação.
      undo()
      expect(orderRef.value).toEqual([0, 1, 2, 3, 4, 5])
      expect(dataset.value?.rows[0]?.[1]).toBe('Alice')

      // undo #3 reverte a edição mais antiga (célula da linha 0).
      undo()
      expect(dataset.value?.rows[0]?.[1]).toBe('Ana')
    })

    it('nova edição após undo de um reorder esvazia redoStack', () => {
      const {
        pushReorderEntry,
        beginEdit,
        confirmEdit,
        undo,
        redo,
        redoStack,
        registerColumnOrderState,
      } = editingHandles()
      const orderRef = ref<number[]>([0, 1, 2, 3, 4, 5])
      const pinnedRef = ref<Set<number>>(new Set())
      registerColumnOrderState(orderRef, pinnedRef)

      const previousOrder = [...orderRef.value]
      const nextOrder = [5, 0, 1, 2, 3, 4]
      orderRef.value = nextOrder
      pushReorderEntry(previousOrder, [], nextOrder, [])

      undo()
      expect(redoStack.value).toHaveLength(1)

      beginEdit(1, 1)
      confirmEdit('Bru')

      expect(redoStack.value).toHaveLength(0)

      redo()
      expect(orderRef.value).toEqual([0, 1, 2, 3, 4, 5])
    })

    it('novo pushReorderEntry após undo de uma edição de célula esvazia redoStack', () => {
      const { beginEdit, confirmEdit, undo, pushReorderEntry, redoStack, registerColumnOrderState } =
        editingHandles()
      const orderRef = ref<number[]>([0, 1, 2, 3, 4, 5])
      const pinnedRef = ref<Set<number>>(new Set())
      registerColumnOrderState(orderRef, pinnedRef)

      beginEdit(0, 1)
      confirmEdit('Alice')
      undo()
      expect(redoStack.value).toHaveLength(1)

      pushReorderEntry([0, 1, 2, 3, 4, 5], [], [1, 0, 2, 3, 4, 5], [])

      expect(redoStack.value).toHaveLength(0)
    })

    it('isDirty ignora entradas reorder (não lança nem falso-positiva)', () => {
      const { pushReorderEntry, isDirty, registerColumnOrderState } = editingHandles()
      const orderRef = ref<number[]>([0, 1, 2, 3, 4, 5])
      const pinnedRef = ref<Set<number>>(new Set())
      registerColumnOrderState(orderRef, pinnedRef)

      pushReorderEntry([0, 1, 2, 3, 4, 5], [], [1, 0, 2, 3, 4, 5], [])

      expect(() => isDirty(0, 1)).not.toThrow()
      expect(isDirty(0, 1)).toBe(false)
    })

    it('trocar de dataset zera undoStack/redoStack mistos e os ponteiros registrados (undo/redo pós-troca são no-op)', () => {
      const {
        beginEdit,
        confirmEdit,
        pushReorderEntry,
        registerColumnOrderState,
        undoStack,
        redoStack,
        undo,
        redo,
        columnOrder,
        columnPinned,
      } = editingHandles()
      const orderRef = ref<number[]>([0, 1, 2, 3, 4, 5])
      const pinnedRef = ref<Set<number>>(new Set())
      registerColumnOrderState(orderRef, pinnedRef)

      beginEdit(0, 1)
      confirmEdit('Alice')
      const previousOrder = [...orderRef.value]
      const nextOrder = [5, 0, 1, 2, 3, 4]
      orderRef.value = nextOrder
      pushReorderEntry(previousOrder, [], nextOrder, [])

      expect(undoStack.value).toHaveLength(2)

      loadDataset()

      expect(undoStack.value).toHaveLength(0)
      expect(redoStack.value).toHaveLength(0)
      expect(columnOrder.value).toEqual([])
      expect(columnPinned.value).toEqual(new Set())

      undo()
      redo()

      expect(undoStack.value).toHaveLength(0)
      expect(redoStack.value).toHaveLength(0)
      // Ponteiro registrado foi zerado: os refs originais não são mais tocados.
      expect(orderRef.value).toEqual(nextOrder)
    })
  })

  describe('markSaved/hasUnsavedChanges', () => {
    it('começa false sem edições', () => {
      const { hasUnsavedChanges } = editingHandles()
      expect(hasUnsavedChanges.value).toBe(false)
    })

    it('fica true após uma edição confirmada', () => {
      const { beginEdit, confirmEdit, hasUnsavedChanges } = editingHandles()
      beginEdit(0, 1)
      confirmEdit('Alice')
      expect(hasUnsavedChanges.value).toBe(true)
    })

    it('markSaved volta a false na posição atual, sem afetar canUndo/canRedo', () => {
      const { beginEdit, confirmEdit, markSaved, hasUnsavedChanges, canUndo, canRedo } =
        editingHandles()
      beginEdit(0, 1)
      confirmEdit('Alice')

      markSaved()

      expect(hasUnsavedChanges.value).toBe(false)
      expect(canUndo.value).toBe(true)
      expect(canRedo.value).toBe(false)
    })

    it('desfazer depois de salvar fica true; refazer de volta à posição salva fica false de novo', () => {
      const { beginEdit, confirmEdit, undo, redo, markSaved, hasUnsavedChanges } =
        editingHandles()
      beginEdit(0, 1)
      confirmEdit('Alice')
      markSaved()

      undo()
      expect(hasUnsavedChanges.value).toBe(true)

      redo()
      expect(hasUnsavedChanges.value).toBe(false)
    })

    it('uma nova edição após markSaved fica true de novo', () => {
      const { beginEdit, confirmEdit, markSaved, hasUnsavedChanges } = editingHandles()
      beginEdit(0, 1)
      confirmEdit('Alice')
      markSaved()

      beginEdit(1, 1)
      confirmEdit('Bruna')

      expect(hasUnsavedChanges.value).toBe(true)
    })

    it('fica true após um pushReorderEntry isolado e volta a false após markSaved()', () => {
      const { pushReorderEntry, markSaved, hasUnsavedChanges, registerColumnOrderState } =
        editingHandles()
      const orderRef = ref<number[]>([0, 1, 2, 3, 4, 5])
      const pinnedRef = ref<Set<number>>(new Set())
      registerColumnOrderState(orderRef, pinnedRef)

      expect(hasUnsavedChanges.value).toBe(false)

      pushReorderEntry([0, 1, 2, 3, 4, 5], [], [5, 0, 1, 2, 3, 4], [])
      expect(hasUnsavedChanges.value).toBe(true)

      markSaved()
      expect(hasUnsavedChanges.value).toBe(false)
    })

    it('trocar de dataset reseta a posição salva junto com as pilhas', () => {
      const { beginEdit, confirmEdit, markSaved, hasUnsavedChanges } = editingHandles()
      beginEdit(0, 1)
      confirmEdit('Alice')
      markSaved()
      expect(hasUnsavedChanges.value).toBe(false)

      loadDataset()

      expect(hasUnsavedChanges.value).toBe(false)
    })
  })
})

/** Agrupa os handles usados em quase todo teste, incluindo `dataset` para asserts. */
function editingHandles() {
  return { ...useCellEditing(), dataset: useCurrentDataset().dataset }
}
