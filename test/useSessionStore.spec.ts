import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteDatabase, type SessionRecord } from '~/composables/useDatabase'
import { useSessionStore } from '~/composables/useSessionStore'

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    fileId: 1,
    columnCount: 2,
    filters: [],
    sortKeys: [{ index: 0, direction: 'asc' }],
    hidden: [1],
    widths: [[0, 200]],
    order: [1, 0],
    pinned: [0],
    updated_at: 1_000,
    ...overrides,
  }
}

describe('session store', () => {
  beforeEach(async () => {
    await deleteDatabase()
  })

  afterEach(async () => {
    await deleteDatabase()
  })

  describe('sessions-crud', () => {
    it('salvar/recuperar preserva os campos', async () => {
      const { saveSession, getSession } = useSessionStore()
      const session = makeSession()

      await saveSession(session)

      expect(await getSession(session.fileId)).toEqual(session)
    })

    it('deleteSession remove o registro', async () => {
      const { saveSession, deleteSession, getSession } = useSessionStore()
      const session = makeSession()
      await saveSession(session)

      await deleteSession(session.fileId)

      expect(await getSession(session.fileId)).toBeUndefined()
    })

    it('getSession de fileId inexistente retorna undefined', async () => {
      const { getSession } = useSessionStore()

      expect(await getSession(999)).toBeUndefined()
    })

    it('sobrescrever o mesmo fileId substitui o registro anterior', async () => {
      const { saveSession, getSession } = useSessionStore()
      await saveSession(makeSession({ hidden: [0], updated_at: 1_000 }))

      const updated = makeSession({ hidden: [1, 2], updated_at: 2_000 })
      await saveSession(updated)

      const stored = await getSession(updated.fileId)
      expect(stored).toEqual(updated)
    })
  })
})
