import {
  FILES_STORE,
  LAST_OPENED_INDEX,
  openDatabase,
  type FileRecord,
} from '~/composables/useDatabase'

/**
 * Acesso ao store `files`: CRUD dos arquivos abertos + política LRU dos
 * recentes. A lista de recentes é o próprio store ordenado por
 * `last_opened_at` decrescente (US-4.1).
 */

/**
 * Máximo de arquivos mantidos em cache. Ao exceder, o mais antigo por
 * `last_opened_at` é removido (política LRU / quota do navegador).
 */
export const MAX_RECENT_FILES = 10

/**
 * Campos fornecidos ao salvar um arquivo. `id` é gerado pelo store; os
 * timestamps são opcionais e assumem "agora" quando omitidos.
 */
export interface NewFile {
  name: string
  delimiter: string
  size_bytes: number
  row_count: number
  column_count: number
  content: string
  created_at?: number
  last_opened_at?: number
}

/**
 * Store `files`. Todas as operações abrem uma conexão compartilhada e
 * respeitam a política LRU dos recentes.
 */
export function useFilesStore() {
  /**
   * Salva um novo arquivo e retorna o id gerado. Aplica a política LRU: se
   * ultrapassar {@link MAX_RECENT_FILES}, remove o(s) mais antigo(s).
   */
  async function saveFile(file: NewFile): Promise<number> {
    const db = await openDatabase()
    const now = Date.now()
    const record: Omit<FileRecord, 'id'> = {
      name: file.name,
      delimiter: file.delimiter,
      size_bytes: file.size_bytes,
      row_count: file.row_count,
      column_count: file.column_count,
      content: file.content,
      created_at: file.created_at ?? now,
      last_opened_at: file.last_opened_at ?? now,
    }

    const tx = db.transaction(FILES_STORE, 'readwrite')
    // `add` gera a chave auto-incremento; o keyPath é `id`.
    const id = (await tx.store.add(record as FileRecord)) as number

    // Política LRU: se ultrapassar o limite, remove o(s) mais antigo(s) por
    // `last_opened_at`, percorrendo o índice em ordem ascendente.
    let excess = (await tx.store.count()) - MAX_RECENT_FILES
    let cursor = await tx.store.index(LAST_OPENED_INDEX).openCursor()
    while (cursor && excess > 0) {
      await cursor.delete()
      excess -= 1
      cursor = await cursor.continue()
    }

    await tx.done
    return id
  }

  /** Recupera um arquivo pelo id, ou `undefined` se não existir. */
  async function getFile(id: number): Promise<FileRecord | undefined> {
    const db = await openDatabase()
    return db.get(FILES_STORE, id)
  }

  /**
   * Lista os arquivos do mais recente ao mais antigo (por `last_opened_at`).
   */
  async function listFiles(): Promise<FileRecord[]> {
    const db = await openDatabase()
    // O índice devolve em ordem ascendente; invertemos para desc.
    const ascending = await db.getAllFromIndex(FILES_STORE, LAST_OPENED_INDEX)
    return ascending.reverse()
  }

  /** Remove um arquivo pelo id. */
  async function deleteFile(id: number): Promise<void> {
    const db = await openDatabase()
    await db.delete(FILES_STORE, id)
  }

  /**
   * Marca um arquivo como reaberto: atualiza `last_opened_at`, movendo-o para
   * o topo da lista de recentes. Retorna o registro atualizado, ou
   * `undefined` se o id não existir.
   */
  async function touchFile(
    id: number,
    lastOpenedAt: number = Date.now(),
  ): Promise<FileRecord | undefined> {
    const db = await openDatabase()
    const tx = db.transaction(FILES_STORE, 'readwrite')
    const record = await tx.store.get(id)
    if (!record) {
      await tx.done
      return undefined
    }
    const updated: FileRecord = { ...record, last_opened_at: lastOpenedAt }
    await tx.store.put(updated)
    await tx.done
    return updated
  }

  /**
   * Substitui `content`/`delimiter`/`size_bytes`/`row_count`/`column_count`
   * do registro existente, preservando `id`/`created_at` e atualizando
   * `last_opened_at` (RF-15, CT-04). Mesmo padrão de transação de
   * {@link touchFile}. Retorna `undefined` sem lançar quando `id` não existe.
   */
  async function overwriteFile(
    id: number,
    patch: {
      content: string
      delimiter: string
      size_bytes: number
      row_count: number
      column_count: number
    },
    lastOpenedAt: number = Date.now(),
  ): Promise<FileRecord | undefined> {
    const db = await openDatabase()
    const tx = db.transaction(FILES_STORE, 'readwrite')
    const record = await tx.store.get(id)
    if (!record) {
      await tx.done
      return undefined
    }
    const updated: FileRecord = {
      ...record,
      content: patch.content,
      delimiter: patch.delimiter,
      size_bytes: patch.size_bytes,
      row_count: patch.row_count,
      column_count: patch.column_count,
      last_opened_at: lastOpenedAt,
    }
    await tx.store.put(updated)
    await tx.done
    return updated
  }

  return {
    saveFile,
    getFile,
    listFiles,
    deleteFile,
    touchFile,
    overwriteFile,
  }
}
