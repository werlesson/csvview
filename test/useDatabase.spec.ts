import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DB_NAME,
  DB_VERSION,
  deleteDatabase,
  FILES_STORE,
  LAST_OPENED_INDEX,
  openDatabase,
  SESSIONS_STORE,
  SETTINGS_STORE,
} from '~/composables/useDatabase'

describe('idb-init', () => {
  beforeEach(async () => {
    await deleteDatabase()
  })

  afterEach(async () => {
    await deleteDatabase()
  })

  it('cria os stores files, settings e sessions e o índice esperado', async () => {
    const db = await openDatabase()

    expect(db.name).toBe(DB_NAME)
    expect(db.version).toBe(DB_VERSION)
    expect([...db.objectStoreNames]).toEqual(
      expect.arrayContaining([FILES_STORE, SETTINGS_STORE, SESSIONS_STORE]),
    )

    // O store `files` tem o índice por `last_opened_at`.
    const tx = db.transaction(FILES_STORE)
    expect([...tx.store.indexNames]).toContain(LAST_OPENED_INDEX)
    await tx.done

    // O store `settings` usa `key` como keyPath.
    const settingsTx = db.transaction(SETTINGS_STORE)
    expect(settingsTx.store.keyPath).toBe('key')
    await settingsTx.done

    // O store `sessions` usa `fileId` como keyPath.
    const sessionsTx = db.transaction(SESSIONS_STORE)
    expect(sessionsTx.store.keyPath).toBe('fileId')
    await sessionsTx.done
  })

  it('é idempotente: reabrir não recria nem duplica os stores', async () => {
    const first = await openDatabase()
    const second = await openDatabase()

    // Mesma conexão compartilhada (singleton de módulo).
    expect(second).toBe(first)
    expect([...second.objectStoreNames].sort()).toEqual(
      [FILES_STORE, SESSIONS_STORE, SETTINGS_STORE].sort(),
    )
    expect(second.version).toBe(DB_VERSION)
  })

  it('preserva dados pré-existentes ao migrar de um banco v1 (só files/settings)', async () => {
    // Simula um perfil de navegador com o schema anterior (DB_VERSION 1),
    // já com registros gravados em `files`/`settings`, sem o store `sessions`.
    const legacyDb = await openDB(DB_NAME, 1, {
      upgrade(db) {
        const files = db.createObjectStore(FILES_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        })
        files.createIndex(LAST_OPENED_INDEX, 'last_opened_at')
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' })
      },
    })
    const fileId = await legacyDb.add(FILES_STORE, {
      name: 'legacy.csv',
      delimiter: 'comma',
      size_bytes: 10,
      row_count: 1,
      column_count: 2,
      content: 'a,b\n1,2',
      created_at: 1,
      last_opened_at: 1,
    } as never)
    await legacyDb.put(SETTINGS_STORE, {
      key: 'theme',
      value: 'light',
      updated_at: 1,
    })
    legacyDb.close()

    // Reabre pela camada real (DB_VERSION 2) — deve migrar sem erro,
    // preservando os registros de `files`/`settings` e criando `sessions`.
    const db = await openDatabase()

    expect([...db.objectStoreNames].sort()).toEqual(
      [FILES_STORE, SESSIONS_STORE, SETTINGS_STORE].sort(),
    )
    expect(await db.get(FILES_STORE, fileId as number)).toMatchObject({
      name: 'legacy.csv',
    })
    expect(await db.get(SETTINGS_STORE, 'theme')).toMatchObject({
      value: 'light',
    })
  })
})
