import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSaveVersion } from '~/composables/useSaveVersion'
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
      ['2', 'Alice'],
    ],
  }
}

function makeMeta(overrides: Partial<DatasetMeta> = {}): DatasetMeta {
  return {
    name: 'people.csv',
    delimiter: 'comma',
    sizeBytes: 42,
    rowCount: 2,
    columnCount: 2,
    ...overrides,
  }
}

describe('useSaveVersion', () => {
  beforeEach(async () => {
    await deleteDatabase()
    useCurrentDataset().clearDataset()
  })

  afterEach(async () => {
    await deleteDatabase()
  })

  describe('saveNewVersion', () => {
    it('cria um registro novo cujo content reflete as edições', async () => {
      const filesStore = useFilesStore()
      const originalId = await filesStore.saveFile({
        name: 'people.csv',
        delimiter: 'comma',
        size_bytes: 20,
        row_count: 2,
        column_count: 2,
        content: 'id,name\n1,Ana\n2,Bruno\n',
      })

      const dataset = makeDataset() // segunda linha já "editada" para Alice
      useCurrentDataset().setDataset(dataset, makeMeta({ id: originalId }))

      const { saveNewVersion, error } = useSaveVersion()
      const ok = await saveNewVersion()

      expect(ok).toBe(true)
      expect(error.value).toBeNull()

      const files = await filesStore.listFiles()
      expect(files).toHaveLength(2)

      const newRecord = files.find((f) => f.id !== originalId)
      expect(newRecord?.content).toBe('id,name\n1,Ana\n2,Alice')
    })

    it('preserva o registro original intacto', async () => {
      const filesStore = useFilesStore()
      const original = {
        name: 'people.csv',
        delimiter: 'comma',
        size_bytes: 20,
        row_count: 2,
        column_count: 2,
        content: 'id,name\n1,Ana\n2,Bruno\n',
      }
      const originalId = await filesStore.saveFile(original)
      const beforeSave = await filesStore.getFile(originalId)

      useCurrentDataset().setDataset(makeDataset(), makeMeta({ id: originalId }))
      await useSaveVersion().saveNewVersion()

      const stored = await filesStore.getFile(originalId)
      expect(stored).toEqual(beforeSave)
    })

    it('grava o novo registro com o sufixo "(cópia)" no nome, para diferenciar do original', async () => {
      const filesStore = useFilesStore()
      const originalId = await filesStore.saveFile({
        name: 'people.csv',
        delimiter: 'comma',
        size_bytes: 20,
        row_count: 2,
        column_count: 2,
        content: 'id,name\n1,Ana\n2,Bruno\n',
      })

      useCurrentDataset().setDataset(makeDataset(), makeMeta({ id: originalId, name: 'people.csv' }))
      await useSaveVersion().saveNewVersion()

      const files = await filesStore.listFiles()
      const newRecord = files.find((f) => f.id !== originalId)
      expect(newRecord?.name).toBe('people (cópia).csv')
      const original = await filesStore.getFile(originalId)
      expect(original?.name).toBe('people.csv')
    })

    it('com customName informado, usa esse nome em vez do sufixo "(cópia)"', async () => {
      const filesStore = useFilesStore()
      const originalId = await filesStore.saveFile({
        name: 'people.csv',
        delimiter: 'comma',
        size_bytes: 20,
        row_count: 2,
        column_count: 2,
        content: 'id,name\n1,Ana\n2,Bruno\n',
      })

      useCurrentDataset().setDataset(makeDataset(), makeMeta({ id: originalId, name: 'people.csv' }))
      await useSaveVersion().saveNewVersion('relatório final.csv')

      const files = await filesStore.listFiles()
      const newRecord = files.find((f) => f.id !== originalId)
      expect(newRecord?.name).toBe('relatório final.csv')
    })

    it('com customName igual ao nome original, cria a cópia com o mesmo nome (sem exigir unicidade)', async () => {
      const filesStore = useFilesStore()
      const originalId = await filesStore.saveFile({
        name: 'people.csv',
        delimiter: 'comma',
        size_bytes: 20,
        row_count: 2,
        column_count: 2,
        content: 'id,name\n1,Ana\n2,Bruno\n',
      })

      useCurrentDataset().setDataset(makeDataset(), makeMeta({ id: originalId, name: 'people.csv' }))
      const ok = await useSaveVersion().saveNewVersion('people.csv')

      expect(ok).toBe(true)
      const files = await filesStore.listFiles()
      expect(files).toHaveLength(2)
      expect(files.filter((f) => f.name === 'people.csv')).toHaveLength(2)
    })

    it('com customName em branco (só espaços), cai no sufixo "(cópia)" default', async () => {
      const filesStore = useFilesStore()
      const originalId = await filesStore.saveFile({
        name: 'people.csv',
        delimiter: 'comma',
        size_bytes: 20,
        row_count: 2,
        column_count: 2,
        content: 'id,name\n1,Ana\n2,Bruno\n',
      })

      useCurrentDataset().setDataset(makeDataset(), makeMeta({ id: originalId, name: 'people.csv' }))
      await useSaveVersion().saveNewVersion('   ')

      const files = await filesStore.listFiles()
      const newRecord = files.find((f) => f.id !== originalId)
      expect(newRecord?.name).toBe('people (cópia).csv')
    })

    it('atualiza a visualização atual (meta) para apontar ao novo registro — id e nome da cópia', async () => {
      const filesStore = useFilesStore()
      const originalId = await filesStore.saveFile({
        name: 'people.csv',
        delimiter: 'comma',
        size_bytes: 20,
        row_count: 2,
        column_count: 2,
        content: 'id,name\n1,Ana\n2,Bruno\n',
      })
      useCurrentDataset().setDataset(makeDataset(), makeMeta({ id: originalId, name: 'people.csv' }))

      await useSaveVersion().saveNewVersion()

      const files = await filesStore.listFiles()
      const newRecord = files.find((f) => f.id !== originalId)
      expect(useCurrentDataset().meta.value?.id).toBe(newRecord?.id)
      expect(useCurrentDataset().meta.value?.name).toBe('people (cópia).csv')
    })

    it('um "Sobrescrever original" subsequente afeta a cópia recém-salva, não o registro original', async () => {
      const filesStore = useFilesStore()
      const originalId = await filesStore.saveFile({
        name: 'people.csv',
        delimiter: 'comma',
        size_bytes: 20,
        row_count: 2,
        column_count: 2,
        content: 'id,name\n1,Ana\n2,Bruno\n',
      })
      useCurrentDataset().setDataset(makeDataset(), makeMeta({ id: originalId, name: 'people.csv' }))
      const { saveNewVersion, overwriteOriginal } = useSaveVersion()
      await saveNewVersion()

      useCurrentDataset().updateCell(1, 1, 'Alicia')
      await overwriteOriginal()

      const files = await filesStore.listFiles()
      expect(files).toHaveLength(2)
      const original = files.find((f) => f.id === originalId)!
      const copy = files.find((f) => f.id !== originalId)!
      expect(original.content).toBe('id,name\n1,Ana\n2,Bruno\n')
      expect(copy.content).toContain('Alicia')
    })

    it('nunca chama overwriteFile', async () => {
      const overwriteFile = vi.fn()
      const saveFile = vi.fn().mockResolvedValue(1)
      useCurrentDataset().setDataset(makeDataset(), makeMeta({ id: 1 }))

      const { saveNewVersion } = useSaveVersion({
        currentDataset: useCurrentDataset(),
        filesStore: { saveFile, overwriteFile },
      })
      await saveNewVersion()

      expect(saveFile).toHaveBeenCalledTimes(1)
      expect(overwriteFile).not.toHaveBeenCalled()
    })

    it('evicta o mais antigo por last_opened_at quando já há 10 registros', async () => {
      const filesStore = useFilesStore()
      const ids: number[] = []
      for (let i = 0; i < 10; i += 1) {
        ids.push(
          await filesStore.saveFile({
            name: `file-${i}.csv`,
            delimiter: 'comma',
            size_bytes: 10,
            row_count: 1,
            column_count: 2,
            content: 'a,b\n1,2',
            last_opened_at: 100 + i,
          }),
        )
      }

      useCurrentDataset().setDataset(makeDataset(), makeMeta())
      await useSaveVersion().saveNewVersion()

      const files = await filesStore.listFiles()
      expect(files).toHaveLength(10)
      expect(await filesStore.getFile(ids[0]!)).toBeUndefined()
    })

    it('falha simulada retorna false, popula error e não descarta o dataset em memória', async () => {
      const dataset = makeDataset()
      useCurrentDataset().setDataset(dataset, makeMeta({ id: 1 }))

      const { saveNewVersion, error } = useSaveVersion({
        currentDataset: useCurrentDataset(),
        filesStore: {
          saveFile: vi.fn().mockRejectedValue(new Error('quota excedida')),
          overwriteFile: vi.fn(),
        },
      })

      const ok = await saveNewVersion()

      expect(ok).toBe(false)
      expect(error.value).not.toBeNull()
      expect(useCurrentDataset().dataset.value).toEqual(dataset)
    })
  })

  describe('overwriteOriginal', () => {
    it('substitui content do mesmo id sem criar registro adicional', async () => {
      const filesStore = useFilesStore()
      const id = await filesStore.saveFile({
        name: 'people.csv',
        delimiter: 'comma',
        size_bytes: 20,
        row_count: 2,
        column_count: 2,
        content: 'id,name\n1,Ana\n2,Bruno\n',
      })

      useCurrentDataset().setDataset(makeDataset(), makeMeta({ id }))
      const { overwriteOriginal, error } = useSaveVersion()
      const ok = await overwriteOriginal()

      expect(ok).toBe(true)
      expect(error.value).toBeNull()

      const files = await filesStore.listFiles()
      expect(files).toHaveLength(1)
      expect(files[0]?.id).toBe(id)
      expect(files[0]?.content).toBe('id,name\n1,Ana\n2,Alice')
    })

    it('falha simulada retorna false, popula error e não descarta o dataset em memória', async () => {
      const dataset = makeDataset()
      useCurrentDataset().setDataset(dataset, makeMeta({ id: 1 }))

      const { overwriteOriginal, error } = useSaveVersion({
        currentDataset: useCurrentDataset(),
        filesStore: {
          saveFile: vi.fn(),
          overwriteFile: vi.fn().mockRejectedValue(new Error('quota excedida')),
        },
      })

      const ok = await overwriteOriginal()

      expect(ok).toBe(false)
      expect(error.value).not.toBeNull()
      expect(useCurrentDataset().dataset.value).toEqual(dataset)
    })

    it('sem id definido retorna false e não chama overwriteFile', async () => {
      const overwriteFile = vi.fn()
      useCurrentDataset().setDataset(makeDataset(), makeMeta())

      const { overwriteOriginal, error } = useSaveVersion({
        currentDataset: useCurrentDataset(),
        filesStore: { saveFile: vi.fn(), overwriteFile },
      })
      const ok = await overwriteOriginal()

      expect(ok).toBe(false)
      expect(error.value).not.toBeNull()
      expect(overwriteFile).not.toHaveBeenCalled()
    })
  })

  describe('integração com useCellEditing (markSaved)', () => {
    /** Edita a célula (0,1) via useCellEditing, deixando hasUnsavedChanges/canUndo verdadeiros. */
    function makeDirty(): void {
      const { beginEdit, confirmEdit } = useCellEditing()
      beginEdit(0, 1)
      confirmEdit('Bruna')
    }

    it('saveNewVersion bem-sucedido zera hasUnsavedChanges, mas preserva canUndo (undo/redo continuam disponíveis)', async () => {
      useCurrentDataset().setDataset(makeDataset(), makeMeta())
      makeDirty()
      const { hasUnsavedChanges, canUndo } = useCellEditing()
      expect(hasUnsavedChanges.value).toBe(true)

      await useSaveVersion().saveNewVersion()

      expect(hasUnsavedChanges.value).toBe(false)
      expect(canUndo.value).toBe(true)
    })

    it('overwriteOriginal bem-sucedido zera hasUnsavedChanges, mas preserva canUndo', async () => {
      const filesStore = useFilesStore()
      const id = await filesStore.saveFile({
        name: 'people.csv',
        delimiter: 'comma',
        size_bytes: 20,
        row_count: 2,
        column_count: 2,
        content: 'id,name\n1,Ana\n2,Bruno\n',
      })
      useCurrentDataset().setDataset(makeDataset(), makeMeta({ id }))
      makeDirty()
      const { hasUnsavedChanges, canUndo } = useCellEditing()

      await useSaveVersion().overwriteOriginal()

      expect(hasUnsavedChanges.value).toBe(false)
      expect(canUndo.value).toBe(true)
    })

    it('uma gravação que falha não chama markSaved — hasUnsavedChanges continua true', async () => {
      useCurrentDataset().setDataset(makeDataset(), makeMeta({ id: 1 }))
      makeDirty()
      const { hasUnsavedChanges } = useCellEditing()

      const { saveNewVersion } = useSaveVersion({
        currentDataset: useCurrentDataset(),
        filesStore: {
          saveFile: vi.fn().mockRejectedValue(new Error('quota excedida')),
          overwriteFile: vi.fn(),
        },
      })
      await saveNewVersion()

      expect(hasUnsavedChanges.value).toBe(true)
    })
  })

  describe('projeção pela ordem de colunas vigente (T03, CT-03)', () => {
    /** Dataset de 4 colunas para exercitar reordenação + fixação. */
    function makeWideDataset(): Dataset {
      return {
        header: ['id', 'name', 'city', 'age'],
        rows: [
          ['1', 'Ana', 'SP', '30'],
          ['2', 'Bruno', 'RJ', '25'],
        ],
      }
    }

    it('saveNewVersion() serializa header e cada linha na ordem reordenada (sem fixação)', async () => {
      useCurrentDataset().setDataset(makeWideDataset(), makeMeta({ columnCount: 4 }))
      // ordem vigente: age, id, name, city (índices 3,0,1,2), sem fixação
      const cellEditing = {
        markSaved: vi.fn(),
        columnOrder: ref([3, 0, 1, 2]),
        columnPinned: ref(new Set<number>()),
      }

      const { saveNewVersion } = useSaveVersion({
        currentDataset: useCurrentDataset(),
        cellEditing,
      })
      await saveNewVersion()

      const filesStore = useFilesStore()
      const files = await filesStore.listFiles()
      expect(files[0]?.content).toBe(
        'age,id,name,city\n30,1,Ana,SP\n25,2,Bruno,RJ',
      )
    })

    it('overwriteOriginal() serializa header e cada linha na ordem reordenada', async () => {
      const filesStore = useFilesStore()
      const id = await filesStore.saveFile({
        name: 'people.csv',
        delimiter: 'comma',
        size_bytes: 20,
        row_count: 2,
        column_count: 4,
        content: 'id,name,city,age\n1,Ana,SP,30\n2,Bruno,RJ,25',
      })
      useCurrentDataset().setDataset(makeWideDataset(), makeMeta({ id, columnCount: 4 }))
      const cellEditing = {
        markSaved: vi.fn(),
        columnOrder: ref([3, 0, 1, 2]),
        columnPinned: ref(new Set<number>()),
      }

      const { overwriteOriginal } = useSaveVersion({
        currentDataset: useCurrentDataset(),
        cellEditing,
      })
      await overwriteOriginal()

      const stored = await filesStore.getFile(id)
      expect(stored?.content).toBe('age,id,name,city\n30,1,Ana,SP\n25,2,Bruno,RJ')
    })

    it('grupo fixado aparece primeiro, na sequência de fixação, seguido do grupo não-fixado', async () => {
      useCurrentDataset().setDataset(makeWideDataset(), makeMeta({ columnCount: 4 }))
      // fixadas: city (2), id (0), nessa sequência; não-fixadas seguem `order`: name(1), age(3)
      const cellEditing = {
        markSaved: vi.fn(),
        columnOrder: ref([0, 1, 2, 3]),
        columnPinned: ref(new Set<number>([2, 0])),
      }

      const { saveNewVersion } = useSaveVersion({
        currentDataset: useCurrentDataset(),
        cellEditing,
      })
      await saveNewVersion()

      const filesStore = useFilesStore()
      const files = await filesStore.listFiles()
      expect(files[0]?.content).toBe(
        'city,id,name,age\nSP,1,Ana,30\nRJ,2,Bruno,25',
      )
    })

    it('sem reordenação (columnOrder/columnPinned vazios), content é idêntico ao comportamento anterior', async () => {
      useCurrentDataset().setDataset(makeWideDataset(), makeMeta({ columnCount: 4 }))
      const cellEditing = {
        markSaved: vi.fn(),
        columnOrder: ref<number[]>([]),
        columnPinned: ref(new Set<number>()),
      }

      const { saveNewVersion } = useSaveVersion({
        currentDataset: useCurrentDataset(),
        cellEditing,
      })
      await saveNewVersion()

      const filesStore = useFilesStore()
      const files = await filesStore.listFiles()
      expect(files[0]?.content).toBe('id,name,city,age\n1,Ana,SP,30\n2,Bruno,RJ,25')
    })
  })
})
