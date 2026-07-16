<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useExportModal, type ExportFormat } from '~/composables/useExportModal'
import type { ViewerColumn } from '~/composables/useViewer'
import { formatRowCount } from '~/services/formatFile'

/**
 * Modal de exportação (Screen 4, T05 de `.spec/features/export/PLAN.md`).
 *
 * Apresentacional: toda a orquestração (seleção de formato/escopo/opções,
 * projeção de colunas e disparo do download) vive em `useExportModal` (T04) —
 * este componente apenas instancia o composable a partir das props recebidas
 * do Viewer e renderiza o template fiel à Screen 4. Segue o mesmo padrão de
 * overlay de `FilterPanel.vue` (backdrop `@click.self`, foco inicial para o
 * Escape funcionar, `Transition` de abertura/fechamento).
 *
 * Ref de design: `.spec/init/design/README.md#screen-4--exportação`.
 */
const props = defineProps<{
  /** Visibilidade do modal — controlada pelo pai (botão "Exportar" da toolbar). */
  open: boolean
  /** Linhas após busca + filtros (`useViewer.filteredRows`). */
  filteredRows: string[][]
  /** Todas as linhas do dataset, ignorando busca/filtros (`dataset.rows`). */
  allRows: string[][]
  /** Colunas visíveis na ordem final de exibição (`useViewer.displayColumns`). */
  displayColumns: ViewerColumn[]
  /** Nome original do arquivo aberto (`useCurrentDataset.meta.name`). */
  fileName: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const {
  format,
  scope,
  includeHeader,
  quoteAll,
  resetSelection,
  optionsEnabled,
  scopeCounts,
  downloadLabel,
  xlsxWarning,
  download,
} = useExportModal({
  filteredRows: () => props.filteredRows,
  allRows: () => props.allRows,
  displayColumns: () => props.displayColumns,
  fileName: () => props.fileName,
})

/** Abas de formato, na ordem fixa da Screen 4. */
const FORMAT_TABS: Array<{ value: ExportFormat; label: string }> = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
  { value: 'xlsx', label: 'XLSX' },
  { value: 'md', label: 'MD' },
  { value: 'sql', label: 'SQL' },
]

/** Cancelar/"X"/backdrop/Escape: descarta a seleção, sem gerar nem baixar (RF-16). */
function onDismiss(): void {
  resetSelection()
  emit('close')
}

/** "Baixar": aciona o download do formato/escopo/opções atuais e fecha o modal. */
async function onDownload(): Promise<void> {
  await download()
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
  <Transition name="export-overlay">
    <div v-if="open" class="export-overlay" @click.self="onDismiss">
      <div
        ref="panel"
        class="export-overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Exportar dados"
        tabindex="-1"
        @keydown.esc="onDismiss"
      >
        <header class="export-overlay__header">
          <div class="export-overlay__heading">
            <h2 class="export-overlay__title">Exportar dados</h2>
            <p class="export-overlay__subtitle">Escolha o formato e o escopo.</p>
          </div>
          <button
            type="button"
            class="export-overlay__close"
            aria-label="Fechar exportação"
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

        <div class="export-overlay__body">
          <section class="export-section">
            <span class="export-section__label">Formato</span>
            <div class="export-format-tabs" role="tablist" aria-label="Formato de exportação">
              <button
                v-for="tab in FORMAT_TABS"
                :key="tab.value"
                type="button"
                role="tab"
                class="export-format-tab"
                :class="{ 'export-format-tab--active': format === tab.value }"
                :aria-selected="format === tab.value"
                @click="format = tab.value"
              >
                {{ tab.label }}
              </button>
            </div>
          </section>

          <section class="export-section">
            <span class="export-section__label">Escopo</span>
            <label class="export-scope-option">
              <input v-model="scope" type="radio" name="export-scope" value="filtered">
              <span>Linhas filtradas ({{ formatRowCount(scopeCounts.filtered) }})</span>
            </label>
            <label class="export-scope-option">
              <input v-model="scope" type="radio" name="export-scope" value="all">
              <span>Todas as linhas ({{ formatRowCount(scopeCounts.all) }})</span>
            </label>
          </section>

          <section class="export-section">
            <span class="export-section__label">Opções</span>
            <label
              class="export-option-toggle"
              :class="{ 'export-option-toggle--disabled': !optionsEnabled.includeHeader }"
            >
              <input
                v-model="includeHeader"
                type="checkbox"
                :disabled="!optionsEnabled.includeHeader"
              >
              <span>Incluir cabeçalho</span>
            </label>
            <label
              class="export-option-toggle"
              :class="{ 'export-option-toggle--disabled': !optionsEnabled.quoteAll }"
            >
              <input
                v-model="quoteAll"
                type="checkbox"
                :disabled="!optionsEnabled.quoteAll"
              >
              <span>Aspas em todos os campos</span>
            </label>
          </section>

          <p v-if="xlsxWarning" class="export-overlay__warning">{{ xlsxWarning }}</p>
        </div>

        <footer class="export-overlay__footer">
          <button type="button" class="export-overlay__cancel" @click="onDismiss">
            Cancelar
          </button>
          <button type="button" class="export-overlay__download" @click="onDownload">
            {{ downloadLabel }}
          </button>
        </footer>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Overlay centralizado (modal, ao contrário do drawer lateral do FilterPanel),
   fiel à Screen 4 — mesmo padrão de backdrop/foco/transição. */
.export-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.export-overlay__panel {
  display: flex;
  flex-direction: column;
  width: 420px;
  max-width: 90vw;
  max-height: 85vh;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  outline: none;
  overflow: hidden;
}

.export-overlay-enter-active,
.export-overlay-leave-active {
  transition: opacity 0.2s ease;
}

.export-overlay-enter-active .export-overlay__panel,
.export-overlay-leave-active .export-overlay__panel {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
}

.export-overlay-enter-from,
.export-overlay-leave-to {
  opacity: 0;
}

.export-overlay-enter-from .export-overlay__panel,
.export-overlay-leave-to .export-overlay__panel {
  transform: scale(0.96);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .export-overlay-enter-active,
  .export-overlay-leave-active,
  .export-overlay-enter-active .export-overlay__panel,
  .export-overlay-leave-active .export-overlay__panel {
    transition-duration: 0s;
  }
}

.export-overlay__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--border);
}

.export-overlay__title {
  margin: 0;
  font-family: var(--font);
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.export-overlay__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-3);
}

.export-overlay__close {
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

.export-overlay__close:hover {
  color: var(--accent);
  background: var(--accent-soft);
}

.export-overlay__body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
}

.export-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.export-section__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3);
}

.export-format-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.export-format-tab {
  padding: 8px 14px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-2);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.export-format-tab:hover {
  border-color: var(--border-strong);
}

.export-format-tab--active {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
}

.export-scope-option,
.export-option-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
}

.export-option-toggle--disabled {
  color: var(--text-3);
  opacity: 0.5;
  cursor: not-allowed;
}

.export-overlay__warning {
  margin: 0;
  padding: 10px 12px;
  background: var(--warning-soft, rgba(234, 179, 8, 0.12));
  border: 1px solid var(--warning, #eab308);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: 13px;
}

.export-overlay__footer {
  display: flex;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
}

.export-overlay__cancel,
.export-overlay__download {
  flex: 1;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.export-overlay__cancel {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-2);
}

.export-overlay__cancel:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.export-overlay__download {
  background: var(--accent);
  border: 1px solid var(--accent);
  color: var(--accent-fg);
}

.export-overlay__download:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}
</style>
