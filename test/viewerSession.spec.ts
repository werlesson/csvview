import { describe, expect, it } from 'vitest'
import {
  deserializeViewerSession,
  serializeViewerSession,
  type ViewerSessionSnapshot,
} from '~/services/viewerSession'
import type { SessionRecord } from '~/composables/useDatabase'

/** Snapshot de exemplo cobrindo os seis aspectos, para um dataset de 4 colunas. */
function makeSnapshot(): ViewerSessionSnapshot {
  return {
    filters: [{ column: 1, operator: 'igual', value: 'Ana' }],
    sortKeys: [
      { index: 2, direction: 'asc' },
      { index: 0, direction: 'desc' },
    ],
    hidden: new Set([3]),
    widths: new Map([
      [0, 120],
      [2, 240],
    ]),
    order: [2, 0, 1, 3],
    pinned: new Set([1, 0]),
  }
}

function toRecord(
  snapshot: ViewerSessionSnapshot,
  columnCount: number,
): SessionRecord {
  return {
    fileId: 1,
    updated_at: Date.now(),
    ...serializeViewerSession(snapshot, columnCount),
  }
}

describe('viewerSession', () => {
  describe('roundtrip', () => {
    it('serialize→deserialize preserva os seis aspectos', () => {
      const snapshot = makeSnapshot()
      const record = toRecord(snapshot, 4)

      const restored = deserializeViewerSession(record, 4)

      expect(restored).toEqual(snapshot)
    })

    it('serializeViewerSession converte Set/Map para formas serializáveis', () => {
      const snapshot = makeSnapshot()
      const payload = serializeViewerSession(snapshot, 4)

      expect(payload.columnCount).toBe(4)
      expect(payload.hidden).toEqual([3])
      expect(payload.widths).toEqual([
        [0, 120],
        [2, 240],
      ])
      expect(payload.order).toEqual([2, 0, 1, 3])
      // Ordem de inserção preservada (sequência de fixação).
      expect(payload.pinned).toEqual([1, 0])
      expect(payload.filters).toEqual(snapshot.filters)
      expect(payload.sortKeys).toEqual(snapshot.sortKeys)
    })
  })

  describe('mismatch de columnCount (RF-06)', () => {
    it('columnCount divergente descarta o registro inteiro (null)', () => {
      const record = toRecord(makeSnapshot(), 4)

      expect(deserializeViewerSession(record, 5)).toBeNull()
      expect(deserializeViewerSession(record, 3)).toBeNull()
    })
  })

  describe('sanitização por campo (RNF-03)', () => {
    it('remove índices fora de [0, columnCount) individualmente por campo', () => {
      const record: SessionRecord = {
        fileId: 1,
        updated_at: Date.now(),
        columnCount: 3,
        filters: [
          { column: 1, operator: 'igual', value: 'x' },
          { column: 5, operator: 'igual', value: 'fora' },
          { column: -1, operator: 'igual', value: 'negativo' },
        ],
        sortKeys: [
          { index: 0, direction: 'asc' },
          { index: 9, direction: 'desc' },
        ],
        hidden: [0, 3, -2],
        widths: [
          [1, 150],
          [4, 999],
        ],
        order: [2, 0, 1, 7],
        pinned: [0, 3],
      }

      const restored = deserializeViewerSession(record, 3)

      expect(restored).not.toBeNull()
      expect(restored!.filters).toEqual([
        { column: 1, operator: 'igual', value: 'x' },
      ])
      expect(restored!.sortKeys).toEqual([{ index: 0, direction: 'asc' }])
      expect(restored!.hidden).toEqual(new Set([0]))
      expect(restored!.widths).toEqual(new Map([[1, 150]]))
      expect(restored!.order).toEqual([2, 0, 1])
      expect(restored!.pinned).toEqual(new Set([0]))
    })
  })

  describe('entrada malformada (RNF-03)', () => {
    it('degrada campos ausentes/tipo errado/undefined para vazio, sem lançar', () => {
      const malformed = {
        fileId: 1,
        updated_at: Date.now(),
        columnCount: 3,
        filters: undefined,
        sortKeys: 'not-an-array',
        hidden: null,
        widths: { not: 'an-array' },
        order: 42,
        // pinned ausente por completo
      } as unknown as SessionRecord

      let restored: ViewerSessionSnapshot | null = null
      expect(() => {
        restored = deserializeViewerSession(malformed, 3)
      }).not.toThrow()

      expect(restored).toEqual({
        filters: [],
        sortKeys: [],
        hidden: new Set(),
        widths: new Map(),
        order: [],
        pinned: new Set(),
      })
    })

    it('entradas individuais malformadas dentro de arrays válidos são descartadas', () => {
      const record = {
        fileId: 1,
        updated_at: Date.now(),
        columnCount: 3,
        filters: [null, { column: 1, operator: 'igual', value: 'ok' }, 'x'],
        sortKeys: [{ index: 1 }, { index: 0, direction: 'asc' }],
        hidden: ['a', 1, null],
        widths: [[1, 'not-a-number'], [0, 100], 'x'],
        order: [1, 'x', 2],
        pinned: [1, {}],
      } as unknown as SessionRecord

      const restored = deserializeViewerSession(record, 3)

      expect(restored).not.toBeNull()
      expect(restored!.filters).toEqual([
        { column: 1, operator: 'igual', value: 'ok' },
      ])
      expect(restored!.sortKeys).toEqual([{ index: 0, direction: 'asc' }])
      expect(restored!.hidden).toEqual(new Set([1]))
      expect(restored!.widths).toEqual(new Map([[0, 100]]))
      expect(restored!.order).toEqual([1, 2])
      expect(restored!.pinned).toEqual(new Set([1]))
    })

    it('não lança quando o próprio record é null/undefined', () => {
      expect(deserializeViewerSession(null as unknown as SessionRecord, 3)).toBeNull()
      expect(
        deserializeViewerSession(undefined as unknown as SessionRecord, 3),
      ).toBeNull()
    })
  })
})
