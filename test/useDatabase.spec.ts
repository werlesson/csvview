import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DB_NAME,
  DB_VERSION,
  deleteDatabase,
  FILES_STORE,
  LAST_OPENED_INDEX,
  openDatabase,
  SETTINGS_STORE,
} from '~/composables/useDatabase'

describe('idb-init', () => {
  beforeEach(async () => {
    await deleteDatabase()
  })

  afterEach(async () => {
    await deleteDatabase()
  })

  it('cria os stores files e settings e o índice esperado', async () => {
    const db = await openDatabase()

    expect(db.name).toBe(DB_NAME)
    expect(db.version).toBe(DB_VERSION)
    expect([...db.objectStoreNames]).toEqual(
      expect.arrayContaining([FILES_STORE, SETTINGS_STORE]),
    )

    // O store `files` tem o índice por `last_opened_at`.
    const tx = db.transaction(FILES_STORE)
    expect([...tx.store.indexNames]).toContain(LAST_OPENED_INDEX)
    await tx.done

    // O store `settings` usa `key` como keyPath.
    const settingsTx = db.transaction(SETTINGS_STORE)
    expect(settingsTx.store.keyPath).toBe('key')
    await settingsTx.done
  })

  it('é idempotente: reabrir não recria nem duplica os stores', async () => {
    const first = await openDatabase()
    const second = await openDatabase()

    // Mesma conexão compartilhada (singleton de módulo).
    expect(second).toBe(first)
    expect([...second.objectStoreNames].sort()).toEqual(
      [FILES_STORE, SETTINGS_STORE].sort(),
    )
    expect(second.version).toBe(DB_VERSION)
  })
})
