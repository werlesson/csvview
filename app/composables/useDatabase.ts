import {
  deleteDB,
  openDB,
  type DBSchema,
  type IDBPDatabase,
} from 'idb'
import type { ColumnFilter } from '~/services/columnFilters'

/**
 * Camada de persistência client-side (IndexedDB) do CSV View.
 *
 * Não há banco de servidor: os arquivos abertos, as preferências do usuário e
 * o estado de sessão do Viewer vivem inteiramente no navegador. Este módulo
 * inicializa o banco com os três object stores (`files`, `settings` e
 * `sessions`) e o índice por `last_opened_at` usado para listar os arquivos
 * recentes.
 *
 * Referência: `.spec/init/database-schema.md` (US-4.1).
 */

/** Nome do banco IndexedDB. */
export const DB_NAME = 'csvview'

/** Versão do schema. Incrementar quando os stores/índices mudarem. */
export const DB_VERSION = 2

/** Object store dos arquivos abertos/persistidos. */
export const FILES_STORE = 'files'

/** Object store das preferências chave/valor. */
export const SETTINGS_STORE = 'settings'

/** Object store do estado de sessão do Viewer, por `FileRecord.id`. */
export const SESSIONS_STORE = 'sessions'

/** Índice de `files` por `last_opened_at` (ordena os recentes). */
export const LAST_OPENED_INDEX = 'last_opened_at'

/**
 * Registro do store `files`: conteúdo bruto do arquivo + metadados.
 * Timestamps são epoch em milissegundos. Espelha o schema `files`.
 */
export interface FileRecord {
  /** Chave do object store (auto-incremento). */
  id: number
  /** Nome original do arquivo. */
  name: string
  /** Delimitador inferido: `comma` | `tab` | `semicolon`. */
  delimiter: string
  /** Tamanho do conteúdo original, em bytes. */
  size_bytes: number
  /** Nº de linhas de dados (sem o cabeçalho). */
  row_count: number
  /** Nº de colunas do cabeçalho. */
  column_count: number
  /** Conteúdo bruto do arquivo (re-parseado ao abrir). */
  content: string
  /** Quando foi aberto pela primeira vez (epoch ms). */
  created_at: number
  /** Última reabertura (epoch ms) — ordena a lista de recentes. */
  last_opened_at: number
}

/** Registro do store `settings`: preferência chave/valor. */
export interface SettingRecord {
  /** Chave da preferência, ex.: `"theme"`. */
  key: string
  /** Valor da preferência, ex.: `"dark"`. */
  value: string
  /** Última atualização (epoch ms). */
  updated_at: number
}

/** Chave de ordenação persistida (equivalente serializável de `SortKey`). */
export interface SessionSortKey {
  /** Índice original da coluna no cabeçalho do dataset. */
  index: number
  /** Direção da comparação nesta coluna. */
  direction: 'asc' | 'desc'
}

/**
 * Registro do store `sessions`: estado de sessão do Viewer persistido por
 * `FileRecord.id` (chave `fileId`). Todos os índices de coluna são
 * **originais** (não a posição renderizada), conforme `domain_rules.md`.
 */
export interface SessionRecord {
  /** Chave do object store — `FileRecord.id` do arquivo associado. */
  fileId: number
  /** `FileRecord.column_count` no momento da gravação (detecção de RF-06). */
  columnCount: number
  /** Filtros de coluna ativos (`ColumnFilter[]`). */
  filters: ColumnFilter[]
  /** Chaves de ordenação ativas, em ordem de prioridade decrescente. */
  sortKeys: SessionSortKey[]
  /** Índices de coluna ocultos. */
  hidden: number[]
  /** Larguras de coluna, como pares `[índice, largura em pixels]`. */
  widths: [number, number][]
  /** Ordem de exibição das colunas não fixadas (índices originais). */
  order: number[]
  /** Índices de coluna fixados, na ordem de fixação. */
  pinned: number[]
  /** Última atualização (epoch ms). */
  updated_at: number
}

interface CsvViewDBSchema extends DBSchema {
  files: {
    key: number
    value: FileRecord
    indexes: { last_opened_at: number }
  }
  settings: {
    key: string
    value: SettingRecord
  }
  sessions: {
    key: number
    value: SessionRecord
  }
}

/** Handle tipado do banco do CSV View. */
export type CsvViewDatabase = IDBPDatabase<CsvViewDBSchema>

// Singleton de módulo: uma única conexão compartilhada. A abertura é
// idempotente — reabrir devolve a mesma promessa sem recriar stores.
let dbPromise: Promise<CsvViewDatabase> | null = null

/**
 * Abre (e, na primeira vez, cria) o banco IndexedDB com os stores `files`,
 * `settings` e `sessions` e o índice de `last_opened_at`. Chamadas
 * subsequentes reutilizam a mesma conexão, então reabrir não recria nem
 * duplica os stores.
 */
export function openDatabase(): Promise<CsvViewDatabase> {
  if (!dbPromise) {
    dbPromise = openDB<CsvViewDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(FILES_STORE)) {
          const files = db.createObjectStore(FILES_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          })
          files.createIndex(LAST_OPENED_INDEX, 'last_opened_at')
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          db.createObjectStore(SESSIONS_STORE, { keyPath: 'fileId' })
        }
      },
    })
  }
  return dbPromise
}

/**
 * Fecha a conexão atual e esquece o singleton. A próxima chamada a
 * {@link openDatabase} abre uma conexão nova — usado para simular um
 * recarregamento da página nos testes.
 */
export async function closeDatabase(): Promise<void> {
  if (dbPromise) {
    const pending = dbPromise
    dbPromise = null
    const db = await pending
    db.close()
  }
}

/**
 * Fecha e apaga o banco por completo. Usado em testes para isolar cada caso.
 */
export async function deleteDatabase(): Promise<void> {
  await closeDatabase()
  await deleteDB(DB_NAME)
}
