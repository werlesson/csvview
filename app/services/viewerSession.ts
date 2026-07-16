/**
 * Serialização/validação pura da sessão do Viewer (feature `sessions`).
 *
 * Funções puras, sem import de Vue/composables — apenas tipos (`import type`,
 * erasado em tempo de compilação) — seguindo a convenção de `app/services/`.
 *
 * Referência: `.spec/features/sessions/SPEC.md` (CT-01, RF-06, RNF-03);
 * `.spec/features/sessions/PLAN.md` (T05).
 */

import type { ColumnFilter } from '~/services/columnFilters'
import type { SessionRecord, SessionSortKey } from '~/composables/useDatabase'

/**
 * Recorte do estado do Viewer (`useViewer.ts`) relevante para a sessão:
 * os seis aspectos persistidos, na forma em memória (Set/Map).
 */
export interface ViewerSessionSnapshot {
  filters: ColumnFilter[]
  sortKeys: SessionSortKey[]
  hidden: Set<number>
  widths: Map<number, number>
  order: number[]
  pinned: Set<number>
}

/**
 * Forma serializável de {@link ViewerSessionSnapshot}, pronta para gravação
 * no store `sessions` (falta apenas `fileId`/`updated_at`, que o chamador
 * acrescenta — esta função não conhece o `FileRecord.id`).
 */
export type SessionPayload = Pick<
  SessionRecord,
  'columnCount' | 'filters' | 'sortKeys' | 'hidden' | 'widths' | 'order' | 'pinned'
>

/**
 * Converte o snapshot em memória do Viewer para a forma serializável do
 * `SessionRecord` (CT-01): `Set`/`Map` viram arrays/pares, preservando a
 * ordem de iteração (relevante para `pinned`, que registra a sequência de
 * fixação).
 */
export function serializeViewerSession(
  snapshot: ViewerSessionSnapshot,
  columnCount: number,
): SessionPayload {
  return {
    columnCount,
    filters: [...snapshot.filters],
    sortKeys: [...snapshot.sortKeys],
    hidden: [...snapshot.hidden],
    widths: [...snapshot.widths.entries()],
    order: [...snapshot.order],
    pinned: [...snapshot.pinned],
  }
}

function toSafeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function isValidIndex(value: unknown, columnCount: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < columnCount
  )
}

/**
 * Reconstrói o snapshot em memória a partir de um `SessionRecord` persistido.
 *
 * RF-06: se `record.columnCount` divergir do `columnCount` atual, o registro
 * inteiro é descartado (`null`) — nenhum índice potencialmente obsoleto é
 * aplicado.
 *
 * RNF-03 (defesa adicional, com `columnCount` igual): cada um dos seis
 * campos é sanitizado individualmente — índices fora de `[0, columnCount)`
 * são removidos, e campos ausentes/malformados (tipo errado, não-array)
 * degradam para vazio. Nunca lança.
 */
export function deserializeViewerSession(
  record: SessionRecord,
  columnCount: number,
): ViewerSessionSnapshot | null {
  if (record == null || typeof record !== 'object') return null
  if (record.columnCount !== columnCount) return null

  const hidden = new Set(
    toSafeArray<number>(record.hidden).filter((index) =>
      isValidIndex(index, columnCount),
    ),
  )

  const widths = new Map(
    toSafeArray<[number, number]>(record.widths).filter(
      (pair): pair is [number, number] =>
        Array.isArray(pair) &&
        pair.length === 2 &&
        isValidIndex(pair[0], columnCount) &&
        typeof pair[1] === 'number' &&
        Number.isFinite(pair[1]),
    ),
  )

  const order = toSafeArray<number>(record.order).filter((index) =>
    isValidIndex(index, columnCount),
  )

  const pinned = new Set(
    toSafeArray<number>(record.pinned).filter((index) =>
      isValidIndex(index, columnCount),
    ),
  )

  const filters = toSafeArray<ColumnFilter>(record.filters).filter(
    (filter): filter is ColumnFilter =>
      filter != null &&
      typeof filter === 'object' &&
      isValidIndex((filter as ColumnFilter).column, columnCount),
  )

  const sortKeys = toSafeArray<SessionSortKey>(record.sortKeys).filter(
    (key): key is SessionSortKey =>
      key != null &&
      typeof key === 'object' &&
      isValidIndex((key as SessionSortKey).index, columnCount) &&
      (key.direction === 'asc' || key.direction === 'desc'),
  )

  return { filters, sortKeys, hidden, widths, order, pinned }
}
