import { nextTick, watch, type Ref } from 'vue'
import type { DatasetMeta } from '~/composables/useCurrentDataset'
import type { SortKey } from '~/composables/useViewer'
import { useSessionStore } from '~/composables/useSessionStore'
import type { ColumnFilter } from '~/services/columnFilters'
import {
  deserializeViewerSession,
  serializeViewerSession,
} from '~/services/viewerSession'

/**
 * Composable de restauração + escrita debounced do estado de sessão do
 * Viewer (Fase 3 da feature `sessions`).
 *
 * Orquestra, sobre os seis aspectos expostos por `useViewer` (T04) e o
 * `meta` de `useCurrentDataset`, a restauração (RF-02, RF-03, RF-05) e a
 * escrita assíncrona/debounced (RF-01, RNF-01) via `useSessionStore` (T02) e
 * `app/services/viewerSession.ts` (T05).
 *
 * Referência: `.spec/features/sessions/SPEC.md`; `.spec/features/sessions/PLAN.md` (T06).
 */

/** Debounce padrão (ms) da escrita do estado de sessão (RF-01/RNF-01). */
const DEFAULT_DEBOUNCE_MS = 300

/** Subconjunto de `useViewer()` que compõe a sessão persistida (CT-01). */
export interface ViewerSessionRefs {
  filters: Ref<ColumnFilter[]>
  sortKeys: Ref<SortKey[]>
  hidden: Ref<Set<number>>
  widths: Ref<Map<number, number>>
  order: Ref<number[]>
  pinned: Ref<Set<number>>
}

/** Dependências injetáveis do composable (todas com default de produção). */
export interface UseViewerSessionOptions {
  /** Store `sessions`; default {@link useSessionStore}. */
  sessionStore?: Pick<
    ReturnType<typeof useSessionStore>,
    'getSession' | 'saveSession' | 'deleteSession'
  >
  /** Janela de debounce (ms) da escrita (RF-01/RNF-01); default 300. */
  debounceMs?: number
}

/**
 * Liga a restauração e a persistência debounced do estado de sessão do
 * Viewer ao dataset atual.
 *
 * `viewer` é o subconjunto `{ filters, sortKeys, hidden, widths, order,
 * pinned }` retornado por `useViewer` (T04); `meta` é o `Ref` de
 * `DatasetMeta | null` de `useCurrentDataset`.
 *
 * RF-05: enquanto `meta.value?.id` é `undefined`, nenhuma leitura nem
 * escrita ocorre em store algum — o Viewer permanece funcional só em
 * memória, e nenhuma mutação anterior à transição `undefined` → definido é
 * salva retroativamente (o `id` é relido no momento de cada disparo de
 * escrita, não capturado no instante da mutação).
 */
export function useViewerSession(
  viewer: ViewerSessionRefs,
  meta: Ref<DatasetMeta | null>,
  options: UseViewerSessionOptions = {},
): void {
  const sessionStore = options.sessionStore ?? useSessionStore()
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS

  // Suprime a escrita disparada pela própria restauração, para não
  // reescrever imediatamente o que acabou de ser lido, com os mesmos dados.
  let isRestoring = false
  let timer: ReturnType<typeof setTimeout> | null = null

  // Restauração (RF-02, RF-03, RF-05): dispara ao montar e a cada troca de
  // dataset (novo `meta.value`, inclusive `id` indefinido → definido).
  watch(
    meta,
    async (current) => {
      const id = current?.id
      if (id === undefined) return

      let record
      try {
        record = await sessionStore.getSession(id)
      } catch (error) {
        console.error('Falha ao restaurar a sessão do Viewer:', error)
        return
      }
      if (record === undefined) return

      const restored = deserializeViewerSession(record, current.columnCount)
      if (restored === null) {
        // RF-06: schema divergente (`columnCount`) — descarte total do
        // registro, sem aplicar nenhum índice de coluna potencialmente
        // obsoleto (RNF-03: os refs seguem no estado padrão atual).
        try {
          await sessionStore.deleteSession(id)
        } catch (error) {
          console.error('Falha ao remover a sessão divergente:', error)
        }
        return
      }

      isRestoring = true
      viewer.filters.value = restored.filters
      viewer.sortKeys.value = restored.sortKeys
      viewer.hidden.value = restored.hidden
      viewer.widths.value = restored.widths
      viewer.order.value = restored.order
      viewer.pinned.value = restored.pinned
      // Aguarda o watcher de escrita (abaixo, `flush: 'post'`) rodar e ser
      // suprimido antes de liberar novas mutações para persistência.
      await nextTick()
      isRestoring = false
    },
    { immediate: true },
  )

  // Escrita debounced (RF-01, RNF-01): coalesce mutações rápidas (ex.: um
  // arraste de redimensionamento) numa única gravação por janela de debounce.
  watch(
    [
      viewer.filters,
      viewer.sortKeys,
      viewer.hidden,
      viewer.widths,
      viewer.order,
      viewer.pinned,
    ],
    () => {
      if (isRestoring) return
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        void persist()
      }, debounceMs)
    },
    { flush: 'post' },
  )

  /** Serializa e grava o estado atual, se o dataset ativo tiver um `id`. */
  async function persist(): Promise<void> {
    // Lido no momento do disparo (não no instante da mutação): RF-05 AC2,
    // sem retroatividade quando o `id` surge depois.
    const current = meta.value
    if (current === null || current.id === undefined) return
    const id = current.id

    try {
      const payload = serializeViewerSession(
        {
          filters: viewer.filters.value,
          sortKeys: viewer.sortKeys.value,
          hidden: viewer.hidden.value,
          widths: viewer.widths.value,
          order: viewer.order.value,
          pinned: viewer.pinned.value,
        },
        current.columnCount,
      )
      await sessionStore.saveSession({
        fileId: id,
        updated_at: Date.now(),
        ...payload,
      })
    } catch (error) {
      // RNF-01: falha de escrita nunca propaga nem bloqueia a UI — só log.
      console.error('Falha ao salvar a sessão do Viewer:', error)
    }
  }
}
