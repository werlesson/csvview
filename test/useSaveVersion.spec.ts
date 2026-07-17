import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSaveVersion } from '~/composables/useSaveVersion'
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
})
