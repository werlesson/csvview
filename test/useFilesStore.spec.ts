import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteDatabase, type SessionRecord } from '~/composables/useDatabase'
import {
  MAX_RECENT_FILES,
  useFilesStore,
  type NewFile,
} from '~/composables/useFilesStore'
import { useSessionStore } from '~/composables/useSessionStore'

function makeSession(fileId: number): SessionRecord {
  return {
    fileId,
    columnCount: 2,
    filters: [],
    sortKeys: [],
    hidden: [],
    widths: [],
    order: [],
    pinned: [],
    updated_at: 1_000,
  }
}

function makeFile(overrides: Partial<NewFile> = {}): NewFile {
  return {
    name: 'people.csv',
    delimiter: 'comma',
    size_bytes: 42,
    row_count: 2,
    column_count: 2,
    content: 'id,name\n1,Ana\n2,Bruno\n',
    created_at: 1_000,
    last_opened_at: 1_000,
    ...overrides,
  }
}

describe('files store', () => {
  beforeEach(async () => {
    await deleteDatabase()
  })

  afterEach(async () => {
    await deleteDatabase()
  })

  describe('files-crud', () => {
    it('salvar/recuperar preserva os campos', async () => {
      const { saveFile, getFile } = useFilesStore()
      const file = makeFile()

      const id = await saveFile(file)
      expect(typeof id).toBe('number')

      const stored = await getFile(id)
      expect(stored).toEqual({ id, ...file })
    })

    it('deleta um arquivo por id', async () => {
      const { saveFile, getFile, deleteFile } = useFilesStore()
      const id = await saveFile(makeFile())

      await deleteFile(id)

      expect(await getFile(id)).toBeUndefined()
    })
  })

  describe('files-list-order', () => {
    it('lista do mais recente ao mais antigo por last_opened_at', async () => {
      const { saveFile, listFiles } = useFilesStore()

      await saveFile(makeFile({ name: 'old.csv', last_opened_at: 100 }))
      await saveFile(makeFile({ name: 'new.csv', last_opened_at: 300 }))
      await saveFile(makeFile({ name: 'mid.csv', last_opened_at: 200 }))

      const files = await listFiles()
      expect(files.map((f) => f.name)).toEqual([
        'new.csv',
        'mid.csv',
        'old.csv',
      ])
    })
  })

  describe('files-lru-evict', () => {
    it('a 11ª inserção remove exatamente o mais antigo', async () => {
      const { saveFile, listFiles, getFile } = useFilesStore()

      // Insere MAX_RECENT_FILES (10) arquivos com `last_opened_at` crescente.
      const ids: number[] = []
      for (let i = 0; i < MAX_RECENT_FILES; i += 1) {
        ids.push(
          await saveFile(
            makeFile({ name: `file-${i}.csv`, last_opened_at: 100 + i }),
          ),
        )
      }

      // O 11º arquivo é o mais recente de todos.
      const newestId = await saveFile(
        makeFile({ name: 'file-11.csv', last_opened_at: 999 }),
      )

      const files = await listFiles()
      expect(files).toHaveLength(MAX_RECENT_FILES)

      // O mais antigo (file-0) foi removido; o novo permanece.
      expect(await getFile(ids[0]!)).toBeUndefined()
      expect(await getFile(newestId)).toBeDefined()
      expect(files.map((f) => f.name)).not.toContain('file-0.csv')
      expect(files.map((f) => f.name)).toContain('file-11.csv')
    })
  })

  describe('files-session-cascade-delete', () => {
    it('excluir manualmente um arquivo com sessão salva remove ambos', async () => {
      const { saveFile, deleteFile, getFile } = useFilesStore()
      const { saveSession, getSession } = useSessionStore()

      const id = await saveFile(makeFile())
      await saveSession(makeSession(id))

      await deleteFile(id)

      expect(await getFile(id)).toBeUndefined()
      expect(await getSession(id)).toBeUndefined()
    })

    it('a 11ª inserção evictando o mais antigo remove também a sessão do evictado', async () => {
      const { saveFile, listFiles } = useFilesStore()
      const { saveSession, getSession } = useSessionStore()

      const ids: number[] = []
      for (let i = 0; i < MAX_RECENT_FILES; i += 1) {
        const id = await saveFile(
          makeFile({ name: `file-${i}.csv`, last_opened_at: 100 + i }),
        )
        ids.push(id)
        await saveSession(makeSession(id))
      }

      await saveFile(makeFile({ name: 'file-11.csv', last_opened_at: 999 }))

      const files = await listFiles()
      expect(files).toHaveLength(MAX_RECENT_FILES)
      // O mais antigo (file-0, ids[0]) foi evictado — sua sessão some junto.
      expect(await getSession(ids[0]!)).toBeUndefined()
      // As demais sessões permanecem intactas.
      expect(await getSession(ids[1]!)).toBeDefined()
    })

    it('consultar a sessão de um id já excluído não retorna registro', async () => {
      const { saveFile, deleteFile } = useFilesStore()
      const { saveSession, getSession } = useSessionStore()

      const id = await saveFile(makeFile())
      await saveSession(makeSession(id))
      await deleteFile(id)

      expect(await getSession(id)).toBeUndefined()
    })
  })

  describe('files-lru-touch', () => {
    it('reabrir um arquivo o move para o topo dos recentes', async () => {
      const { saveFile, touchFile, listFiles } = useFilesStore()

      const oldId = await saveFile(
        makeFile({ name: 'old.csv', last_opened_at: 100 }),
      )
      await saveFile(makeFile({ name: 'mid.csv', last_opened_at: 200 }))
      await saveFile(makeFile({ name: 'new.csv', last_opened_at: 300 }))

      // Antes de reabrir, `old.csv` está no fim da lista.
      let files = await listFiles()
      expect(files.map((f) => f.name)).toEqual(['new.csv', 'mid.csv', 'old.csv'])

      // Reabre `old.csv`: atualiza `last_opened_at` para o mais recente.
      const touched = await touchFile(oldId, 400)
      expect(touched?.last_opened_at).toBe(400)

      files = await listFiles()
      expect(files.map((f) => f.name)).toEqual(['old.csv', 'new.csv', 'mid.csv'])
    })
  })
})
