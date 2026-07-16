import {
  openDatabase,
  SESSIONS_STORE,
  type SessionRecord,
} from '~/composables/useDatabase'

/**
 * Acesso ao store `sessions`: CRUD do estado de sessão do Viewer persistido
 * por `FileRecord.id` (chave `fileId`). Sem lógica de domínio (validação e
 * serialização ficam em `app/services/viewerSession.ts`).
 */
export function useSessionStore() {
  /** Recupera a sessão de um arquivo, ou `undefined` se não existir. */
  async function getSession(
    fileId: number,
  ): Promise<SessionRecord | undefined> {
    const db = await openDatabase()
    return db.get(SESSIONS_STORE, fileId)
  }

  /** Salva (ou substitui) a sessão de um arquivo. */
  async function saveSession(record: SessionRecord): Promise<void> {
    const db = await openDatabase()
    await db.put(SESSIONS_STORE, record)
  }

  /** Remove a sessão de um arquivo pelo `fileId`. */
  async function deleteSession(fileId: number): Promise<void> {
    const db = await openDatabase()
    await db.delete(SESSIONS_STORE, fileId)
  }

  return {
    getSession,
    saveSession,
    deleteSession,
  }
}
