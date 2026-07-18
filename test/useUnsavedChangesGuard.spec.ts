import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUnsavedChangesGuard } from '~/composables/useUnsavedChangesGuard'
import { useCellEditing } from '~/composables/useCellEditing'
import {
  useCurrentDataset,
  type Dataset,
  type DatasetMeta,
} from '~/composables/useCurrentDataset'
import { deleteDatabase } from '~/composables/useDatabase'
import { useFilesStore } from '~/composables/useFilesStore'

function makeDataset(): Dataset {
  return {
    header: ['id', 'name'],
    rows: [
      ['1', 'Ana'],
      ['2', 'Bruno'],
    ],
  }
}

let nextId = 1

function makeMeta(overrides: Partial<DatasetMeta> = {}): DatasetMeta {
  return {
    id: nextId++,
    name: 'people.csv',
    delimiter: 'comma',
    sizeBytes: 20,
    rowCount: 2,
    columnCount: 2,
    ...overrides,
  }
}

/** Carrega um dataset novo com `id` sempre distinto, forçando o reset do undoStack (RF-10). */
function loadDataset(overrides: Partial<DatasetMeta> = {}): void {
  useCurrentDataset().setDataset(makeDataset(), makeMeta(overrides))
}

/** Edita a célula (0,1) para deixar `canUndo` verdadeiro. */
function makeDirty(): void {
  const { beginEdit, confirmEdit } = useCellEditing()
  beginEdit(0, 1)
  confirmEdit('Alice')
}

describe('useUnsavedChangesGuard', () => {
  beforeEach(async () => {
    await deleteDatabase()
    useUnsavedChangesGuard().cancel()
  })

  afterEach(async () => {
    await deleteDatabase()
    useCurrentDataset().clearDataset()
    vi.restoreAllMocks()
  })

  it('sem edição pendente, guardNavigation navega direto sem abrir o modal', () => {
    loadDataset()
    const navigateToSpy = vi
      .spyOn(globalThis as unknown as { navigateTo: (path: string) => void }, 'navigateTo')
      .mockImplementation(() => {})
    const { isOpen, guardNavigation } = useUnsavedChangesGuard()

    guardNavigation('/compare')

    expect(navigateToSpy).toHaveBeenCalledWith('/compare')
    expect(isOpen.value).toBe(false)
  })

  it('com edição pendente, guardNavigation abre o modal e não navega', () => {
    loadDataset()
    makeDirty()
    const navigateToSpy = vi
      .spyOn(globalThis as unknown as { navigateTo: (path: string) => void }, 'navigateTo')
      .mockImplementation(() => {})
    const { isOpen, guardNavigation } = useUnsavedChangesGuard()

    guardNavigation('/compare')

    expect(navigateToSpy).not.toHaveBeenCalled()
    expect(isOpen.value).toBe(true)
  })

  it('cancel fecha o modal sem navegar', () => {
    loadDataset()
    makeDirty()
    const navigateToSpy = vi
      .spyOn(globalThis as unknown as { navigateTo: (path: string) => void }, 'navigateTo')
      .mockImplementation(() => {})
    const { isOpen, guardNavigation, cancel } = useUnsavedChangesGuard()
    guardNavigation('/compare')

    cancel()

    expect(isOpen.value).toBe(false)
    expect(navigateToSpy).not.toHaveBeenCalled()
  })

  it('discard navega para o destino pendente sem persistir nada', async () => {
    loadDataset()
    makeDirty()
    const filesStore = useFilesStore()
    const navigateToSpy = vi
      .spyOn(globalThis as unknown as { navigateTo: (path: string) => void }, 'navigateTo')
      .mockImplementation(() => {})
    const { isOpen, guardNavigation, discard } = useUnsavedChangesGuard()
    guardNavigation('/')

    discard()

    expect(isOpen.value).toBe(false)
    expect(navigateToSpy).toHaveBeenCalledWith('/')
    expect(await filesStore.listFiles()).toHaveLength(0)
  })

  it('confirmSaveCopy persiste uma cópia e então navega para o destino pendente', async () => {
    loadDataset()
    makeDirty()
    const filesStore = useFilesStore()
    const navigateToSpy = vi
      .spyOn(globalThis as unknown as { navigateTo: (path: string) => void }, 'navigateTo')
      .mockImplementation(() => {})
    const { isOpen, guardNavigation, confirmSaveCopy } = useUnsavedChangesGuard()
    guardNavigation('/compare')

    await confirmSaveCopy()

    expect(isOpen.value).toBe(false)
    expect(navigateToSpy).toHaveBeenCalledWith('/compare')
    expect(await filesStore.listFiles()).toHaveLength(1)
  })

  it('confirmSaveCopy com nome customizado persiste a cópia com esse nome, inclusive repetindo o nome do original', async () => {
    loadDataset({ name: 'people.csv' })
    makeDirty()
    const filesStore = useFilesStore()
    vi.spyOn(
      globalThis as unknown as { navigateTo: (path: string) => void },
      'navigateTo',
    ).mockImplementation(() => {})
    const { guardNavigation, confirmSaveCopy } = useUnsavedChangesGuard()
    guardNavigation('/compare')

    await confirmSaveCopy('people.csv')

    const files = await filesStore.listFiles()
    expect(files).toHaveLength(1)
    expect(files[0]?.name).toBe('people.csv')
  })

  it('openSaveCopyModal troca o modal de alterações não salvas pelo de nomeação, sem salvar nem navegar ainda', () => {
    loadDataset()
    makeDirty()
    const navigateToSpy = vi
      .spyOn(globalThis as unknown as { navigateTo: (path: string) => void }, 'navigateTo')
      .mockImplementation(() => {})
    const { isOpen, showSaveCopyModal, guardNavigation, openSaveCopyModal } =
      useUnsavedChangesGuard()
    guardNavigation('/compare')

    openSaveCopyModal()

    expect(isOpen.value).toBe(false)
    expect(showSaveCopyModal.value).toBe(true)
    expect(navigateToSpy).not.toHaveBeenCalled()
  })

  it('cancelSaveCopyModal fecha o modal de nomeação sem salvar nem navegar', () => {
    loadDataset()
    makeDirty()
    const navigateToSpy = vi
      .spyOn(globalThis as unknown as { navigateTo: (path: string) => void }, 'navigateTo')
      .mockImplementation(() => {})
    const { showSaveCopyModal, guardNavigation, openSaveCopyModal, cancelSaveCopyModal } =
      useUnsavedChangesGuard()
    guardNavigation('/compare')
    openSaveCopyModal()

    cancelSaveCopyModal()

    expect(showSaveCopyModal.value).toBe(false)
    expect(navigateToSpy).not.toHaveBeenCalled()
  })

  it('suggestedCopyName reflete nextCopyName do dataset atual', () => {
    loadDataset({ name: 'vendas.csv' })
    expect(useUnsavedChangesGuard().suggestedCopyName.value).toBe('vendas (cópia).csv')
  })

  it('confirmOverwrite sobrescreve o registro original e então navega para o destino pendente', async () => {
    const filesStore = useFilesStore()
    const originalId = await filesStore.saveFile({
      name: 'people.csv',
      delimiter: 'comma',
      size_bytes: 20,
      row_count: 2,
      column_count: 2,
      content: 'id,name\n1,Ana\n2,Bruno',
    })
    loadDataset({ id: originalId })
    makeDirty()
    const navigateToSpy = vi
      .spyOn(globalThis as unknown as { navigateTo: (path: string) => void }, 'navigateTo')
      .mockImplementation(() => {})
    const { isOpen, guardNavigation, confirmOverwrite } = useUnsavedChangesGuard()
    guardNavigation('/')

    await confirmOverwrite()

    expect(isOpen.value).toBe(false)
    expect(navigateToSpy).toHaveBeenCalledWith('/')
    const files = await filesStore.listFiles()
    expect(files).toHaveLength(1)
    expect(files[0]?.content).toContain('Alice')
  })

  it('canOverwrite reflete se o dataset atual já tem id persistido', () => {
    loadDataset({ id: undefined })
    expect(useUnsavedChangesGuard().canOverwrite.value).toBe(false)

    loadDataset({ id: 42 })
    expect(useUnsavedChangesGuard().canOverwrite.value).toBe(true)
  })

  it('fileName reflete o nome do dataset atual', () => {
    loadDataset({ name: 'vendas.csv' })
    expect(useUnsavedChangesGuard().fileName.value).toBe('vendas.csv')
  })
})
