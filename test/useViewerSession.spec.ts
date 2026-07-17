import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { DatasetMeta } from '~/composables/useCurrentDataset'
import {
  useViewerSession,
  type ViewerSessionRefs,
} from '~/composables/useViewerSession'
import type { SessionRecord } from '~/composables/useDatabase'

const DEBOUNCE_MS = 300

/** Mock do `useSessionStore` (T02), injetável via `options.sessionStore`. */
function makeSessionStore() {
  return {
    getSession: vi.fn<
      (fileId: number) => Promise<SessionRecord | undefined>
    >(async () => undefined),
    saveSession: vi.fn<(record: SessionRecord) => Promise<void>>(
      async () => {},
    ),
    deleteSession: vi.fn<(fileId: number) => Promise<void>>(async () => {}),
  }
}

/** Refs em branco do subconjunto de `useViewer` relevante para a sessão. */
function makeViewerRefs(): ViewerSessionRefs {
  return {
    filters: ref([]),
    sortKeys: ref([]),
    hidden: ref(new Set()),
    widths: ref(new Map()),
    order: ref([]),
    pinned: ref(new Set()),
  }
}

function makeMeta(overrides: Partial<DatasetMeta> = {}): DatasetMeta {
  return {
    name: 'people.csv',
    delimiter: 'comma',
    sizeBytes: 42,
    rowCount: 2,
    columnCount: 3,
    ...overrides,
  }
}

/** Muta os seis aspectos persistidos, cada um com um valor diferente do default. */
function mutateAllAspects(viewer: ViewerSessionRefs): void {
  viewer.filters.value = [{ column: 0, operator: 'igual', value: 'Ana' }]
  viewer.sortKeys.value = [{ index: 1, direction: 'asc' }]
  viewer.hidden.value = new Set([2])
  viewer.widths.value = new Map([[0, 240]])
  viewer.order.value = [2, 1, 0]
  viewer.pinned.value = new Set([1])
}

describe('useViewerSession', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('sem id (RF-05)', () => {
    it('mutar os seis aspectos e avançar os timers não chama saveSession', async () => {
      const sessionStore = makeSessionStore()
      const viewer = makeViewerRefs()
      const meta = ref<DatasetMeta | null>(makeMeta({ id: undefined }))

      useViewerSession(viewer, meta, { sessionStore, debounceMs: DEBOUNCE_MS })
      await flushPromises()

      mutateAllAspects(viewer)
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

      expect(sessionStore.getSession).not.toHaveBeenCalled()
      expect(sessionStore.saveSession).not.toHaveBeenCalled()
    })
  })

  describe('com id: escrita debounced (RF-01)', () => {
    it('mutações dentro da janela de debounce coalescem numa única saveSession', async () => {
      const sessionStore = makeSessionStore()
      const viewer = makeViewerRefs()
      const meta = ref<DatasetMeta | null>(makeMeta({ id: 7 }))

      useViewerSession(viewer, meta, { sessionStore, debounceMs: DEBOUNCE_MS })
      await flushPromises()

      viewer.hidden.value = new Set([1])
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS / 2)
      mutateAllAspects(viewer)
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
      await flushPromises()

      expect(sessionStore.saveSession).toHaveBeenCalledTimes(1)
      expect(sessionStore.saveSession).toHaveBeenCalledWith({
        fileId: 7,
        columnCount: 3,
        filters: [{ column: 0, operator: 'igual', value: 'Ana' }],
        sortKeys: [{ index: 1, direction: 'asc' }],
        hidden: [2],
        widths: [[0, 240]],
        order: [2, 1, 0],
        pinned: [1],
        updated_at: expect.any(Number),
      })
    })
  })

  describe('restauração (RF-02, RF-03)', () => {
    it('um registro válido pré-semeado restaura os refs do viewer', async () => {
      const record: SessionRecord = {
        fileId: 9,
        columnCount: 3,
        filters: [{ column: 2, operator: 'igual', value: 'Bruno' }],
        sortKeys: [{ index: 0, direction: 'desc' }],
        hidden: [1],
        widths: [[2, 300]],
        order: [1, 0, 2],
        pinned: [0],
        updated_at: 1_000,
      }
      const sessionStore = makeSessionStore()
      sessionStore.getSession.mockResolvedValue(record)
      const viewer = makeViewerRefs()
      const meta = ref<DatasetMeta | null>(makeMeta({ id: 9 }))

      useViewerSession(viewer, meta, { sessionStore, debounceMs: DEBOUNCE_MS })
      await flushPromises()

      expect(sessionStore.getSession).toHaveBeenCalledWith(9)
      expect(viewer.filters.value).toEqual(record.filters)
      expect(viewer.sortKeys.value).toEqual(record.sortKeys)
      expect(viewer.hidden.value).toEqual(new Set([1]))
      expect(viewer.widths.value).toEqual(new Map([[2, 300]]))
      expect(viewer.order.value).toEqual([1, 0, 2])
      expect(viewer.pinned.value).toEqual(new Set([0]))
    })
  })

  describe('schema divergente (RF-06)', () => {
    it('um registro com columnCount divergente não é aplicado e é deletado', async () => {
      const record: SessionRecord = {
        fileId: 11,
        columnCount: 5,
        filters: [{ column: 4, operator: 'igual', value: 'x' }],
        sortKeys: [],
        hidden: [],
        widths: [],
        order: [],
        pinned: [],
        updated_at: 1_000,
      }
      const sessionStore = makeSessionStore()
      sessionStore.getSession.mockResolvedValue(record)
      const viewer = makeViewerRefs()
      const meta = ref<DatasetMeta | null>(makeMeta({ id: 11, columnCount: 3 }))

      useViewerSession(viewer, meta, { sessionStore, debounceMs: DEBOUNCE_MS })
      await flushPromises()

      expect(viewer.filters.value).toEqual([])
      expect(viewer.sortKeys.value).toEqual([])
      expect(viewer.hidden.value).toEqual(new Set())
      expect(viewer.widths.value).toEqual(new Map())
      expect(viewer.order.value).toEqual([])
      expect(viewer.pinned.value).toEqual(new Set())
      expect(sessionStore.deleteSession).toHaveBeenCalledWith(11)
    })
  })

  describe('falha de escrita (RNF-01)', () => {
    it('uma falha em saveSession não propaga exceção e é apenas logada', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const sessionStore = makeSessionStore()
      sessionStore.saveSession.mockRejectedValueOnce(new Error('quota excedida'))
      const viewer = makeViewerRefs()
      const meta = ref<DatasetMeta | null>(makeMeta({ id: 3 }))

      useViewerSession(viewer, meta, { sessionStore, debounceMs: DEBOUNCE_MS })
      await flushPromises()

      viewer.hidden.value = new Set([0])
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
      await flushPromises()

      expect(sessionStore.saveSession).toHaveBeenCalledTimes(1)
      expect(consoleError).toHaveBeenCalled()

      // Mutação subsequente continua funcionando normalmente.
      viewer.hidden.value = new Set([0, 1])
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
      await flushPromises()

      expect(sessionStore.saveSession).toHaveBeenCalledTimes(2)

      consoleError.mockRestore()
    })
  })

  describe('transição de id indefinido → definido (RF-05 AC2)', () => {
    it('mutações antes da transição nunca são salvas retroativamente', async () => {
      const sessionStore = makeSessionStore()
      const viewer = makeViewerRefs()
      const meta = ref<DatasetMeta | null>(makeMeta({ id: undefined }))

      useViewerSession(viewer, meta, { sessionStore, debounceMs: DEBOUNCE_MS })
      await flushPromises()

      // Muta com `id` indefinido: o timer dispara mas não deve escrever.
      viewer.hidden.value = new Set([0])
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
      await flushPromises()
      expect(sessionStore.saveSession).not.toHaveBeenCalled()

      // `id` transiciona para definido.
      meta.value = makeMeta({ id: 42 })
      await flushPromises()

      // Só a mutação posterior à transição é persistida.
      viewer.order.value = [2, 0, 1]
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
      await flushPromises()

      expect(sessionStore.saveSession).toHaveBeenCalledTimes(1)
      expect(sessionStore.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({ fileId: 42, order: [2, 0, 1] }),
      )
    })
  })
})
