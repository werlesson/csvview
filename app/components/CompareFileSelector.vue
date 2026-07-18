<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import Dropzone from '~/components/Dropzone.vue'
import RecentFiles from '~/components/RecentFiles.vue'
import type { FileRecord } from '~/composables/useDatabase'

/**
 * Modal de seleção do arquivo B (feature `file-comparison`, Fase 3, T03, UI-01).
 *
 * Reaproveita `Dropzone.vue`/`RecentFiles.vue` **por composição** (nenhum dos
 * dois recebe prop/variante nova) — este componente só encaminha os emits
 * `select`/`open-recent`/`close` para quem orquestra a abertura de B
 * (`useComparisonDatasets`, T02). `recents` é a lista de recentes de **A**
 * (`RecentFiles.vue` aqui só serve como origem de seleção; escolher um item
 * aciona `reopenRecentB`, que nunca escreve nessa lista).
 *
 * Mesmo padrão visual de overlay/backdrop/foco/`Transition` de `ExportModal.vue`.
 *
 * Ref de design: `.spec/init/design/README.md#screen-5--comparação-de-arquivos`.
 */
const props = defineProps<{
  /** Visibilidade do modal — controlada pelo pai (`compare.vue`). */
  open: boolean
  /** Arquivos recentes de A, já ordenados (mesma fonte de `index.vue`). */
  recents: FileRecord[]
  /** Abertura de B em andamento (upload ou recente) — desabilita a interação. */
  isOpening: boolean
  /** Mensagem de erro da última tentativa de abrir B, ou `null`. */
  error: string | null
}>()

const emit = defineEmits<{
  (e: 'select', file: File): void
  (e: 'open-recent', id: number): void
  (e: 'close'): void
}>()

function onSelect(file: File): void {
  emit('select', file)
}

function onOpenRecent(id: number): void {
  emit('open-recent', id)
}

function onDismiss(): void {
  emit('close')
}

// Foco inicial no modal ao abrir, para o Escape funcionar sem exigir clique antes.
const panel = ref<HTMLElement | null>(null)
watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    panel.value?.focus()
  },
)
</script>

<template>
  <Transition name="compare-selector-overlay">
    <div v-if="open" class="compare-selector-overlay" @click.self="onDismiss">
      <div
        ref="panel"
        class="compare-selector-overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Comparar arquivos"
        tabindex="-1"
        @keydown.esc="onDismiss"
      >
        <header class="compare-selector-overlay__header">
          <div class="compare-selector-overlay__heading">
            <h2 class="compare-selector-overlay__title">Comparar arquivos</h2>
            <p class="compare-selector-overlay__subtitle">
              Escolha o segundo arquivo (upload ou um recente) para comparar com o atual.
            </p>
          </div>
          <button
            type="button"
            class="compare-selector-overlay__close"
            aria-label="Fechar comparação"
            @click="onDismiss"
          >
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
              <path
                d="M1.5 1.5 L10.5 10.5 M10.5 1.5 L1.5 10.5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </header>

        <div class="compare-selector-overlay__body">
          <Dropzone :disabled="isOpening" @select="onSelect" />

          <p v-if="error" class="compare-selector-overlay__error">{{ error }}</p>

          <RecentFiles :files="recents" @open="onOpenRecent" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.compare-selector-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.compare-selector-overlay__panel {
  display: flex;
  flex-direction: column;
  width: 480px;
  max-width: 90vw;
  max-height: 85vh;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  outline: none;
  overflow: hidden;
}

.compare-selector-overlay-enter-active,
.compare-selector-overlay-leave-active {
  transition: opacity 0.2s ease;
}

.compare-selector-overlay-enter-active .compare-selector-overlay__panel,
.compare-selector-overlay-leave-active .compare-selector-overlay__panel {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
}

.compare-selector-overlay-enter-from,
.compare-selector-overlay-leave-to {
  opacity: 0;
}

.compare-selector-overlay-enter-from .compare-selector-overlay__panel,
.compare-selector-overlay-leave-to .compare-selector-overlay__panel {
  transform: scale(0.96);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .compare-selector-overlay-enter-active,
  .compare-selector-overlay-leave-active,
  .compare-selector-overlay-enter-active .compare-selector-overlay__panel,
  .compare-selector-overlay-leave-active .compare-selector-overlay__panel {
    transition-duration: 0s;
  }
}

.compare-selector-overlay__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--border);
}

.compare-selector-overlay__title {
  margin: 0;
  font-family: var(--font);
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.compare-selector-overlay__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-3);
}

.compare-selector-overlay__close {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--text-3);
  cursor: pointer;
}

.compare-selector-overlay__close:hover {
  color: var(--accent);
  background: var(--accent-soft);
}

.compare-selector-overlay__body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
}

.compare-selector-overlay__error {
  margin: 0;
  padding: 10px 12px;
  background: var(--error-soft);
  border: 1px solid var(--error);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: 13px;
}
</style>
