<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ViewerToolbar from '~/components/ViewerToolbar.vue'
import ViewerTable from '~/components/ViewerTable.vue'
import StatsPanel from '~/components/StatsPanel.vue'
import FilterPanel from '~/components/FilterPanel.vue'
import FilterChips from '~/components/FilterChips.vue'
import ExportModal from '~/components/ExportModal.vue'
import ConfirmModal from '~/components/ConfirmModal.vue'
import SaveCopyModal from '~/components/SaveCopyModal.vue'
import { useCurrentDataset } from '~/composables/useCurrentDataset'
import { useViewer } from '~/composables/useViewer'
import { useCellEditing } from '~/composables/useCellEditing'
import { useSaveVersion } from '~/composables/useSaveVersion'
import { useViewerSession } from '~/composables/useViewerSession'
import { useUnsavedChangesGuard } from '~/composables/useUnsavedChangesGuard'
import { nextCopyName } from '~/services/formatFile'

/**
 * Tela do **Viewer** (Fase 7).
 *
 * Toolbar (nome do arquivo, contagem de linhas, busca e seletor de colunas)
 * sobre uma tabela virtualizada. A lógica de busca/colunas/tipos vive em
 * {@link useViewer}; o dataset vem do estado compartilhado {@link useCurrentDataset}
 * carregado pela tela de Upload (Fase 6). Sem dataset (acesso direto à URL),
 * volta à tela de Upload.
 *
 * Ref de design: `.spec/init/design/README.md#screen-2--visualizador-principal`.
 */
definePageMeta({ pageTransition: { name: 'view', mode: 'out-in' } })

const { dataset, hasDataset, meta } = useCurrentDataset()

// Acesso direto ao Viewer sem um dataset carregado → volta ao Upload.
if (!hasDataset.value) {
  await navigateTo('/')
}

// Título da aba com o nome do arquivo (mesmo padrão do brand__file no header).
useHead({
  title: computed(() => `CSV View | ${meta.value?.name ?? 'Viewer'}`),
})

const {
  search,
  columns,
  toggleColumn,
  hidden,
  selectedIndex,
  selectedColumn,
  selectedStats,
  selectColumn,
  sortKeys,
  sortedRows,
  sortColumn,
  sortColumnAdditive,
  widths,
  resizeColumn,
  columnWidth,
  order,
  reorderColumn,
  pinned,
  togglePin,
  displayColumns,
  filters,
  activeFilters,
  activeFilterCount,
  removeFilter,
  clearFilters,
  applyFilters,
  noResults,
  visibleRowCount,
  filteredRows,
  columnDuplicateCounts,
} = useViewer(() => dataset.value)

useViewerSession({ filters, sortKeys, hidden, widths, order, pinned }, meta)

const selectedLabel = computed(() => selectedColumn.value?.label ?? null)

/**
 * Edição de célula (T03) e persistência da versão editada (T05, cell-editing
 * T09) — nenhum estado de edição próprio na página, só a fiação entre os
 * composables e `ViewerToolbar` (undo/redo/salvar/sobrescrever).
 */
const { canUndo, canRedo, hasUnsavedChanges, undo, redo } = useCellEditing()
const { isBusy: isSaving, error: saveError, saveNewVersion, overwriteOriginal } = useSaveVersion()
const { guardNavigation } = useUnsavedChangesGuard()

function onUndo(): void {
  undo()
}

function onRedo(): void {
  redo()
}

/**
 * Confirmação de "Salvar como cópia": o clique no toolbar só abre o modal de
 * nomeação (`SaveCopyModal`) — a chamada real a `saveNewVersion(name)` só
 * acontece se o usuário confirmar, com o nome (editável, sugerido por
 * `nextCopyName`) escolhido lá.
 */
const showSaveVersionConfirm = ref(false)
const suggestedCopyName = computed(() => nextCopyName(meta.value?.name ?? ''))

function onSaveNewVersion(): void {
  showSaveVersionConfirm.value = true
}

async function onConfirmSaveVersion(name: string): Promise<void> {
  await saveNewVersion(name)
  showSaveVersionConfirm.value = false
}

/** Confirmação da sobrescrita (RF-15): o clique no toolbar só abre o modal — a chamada real a `overwriteOriginal()` só acontece se o usuário confirmar. */
const showOverwriteConfirm = ref(false)

/** Sem alteração pendente desde o último save (`hasUnsavedChanges` falso), não há o que salvar — cobre tanto o clique no botão quanto o atalho Ctrl+S. */
function onOverwriteOriginal(): void {
  if (!hasUnsavedChanges.value) return
  showOverwriteConfirm.value = true
}

async function onConfirmOverwrite(): Promise<void> {
  await overwriteOriginal()
  showOverwriteConfirm.value = false
}

/**
 * Atalhos de teclado globais: Ctrl/Cmd+Z desfaz, Ctrl/Cmd+R refaz,
 * Ctrl/Cmd+S abre a confirmação de sobrescrita (mesmo caminho do clique no
 * botão "Sobrescrever original" — nunca sobrescreve direto). Ignorados
 * enquanto o foco está num campo de texto (input/textarea), para não atropelar
 * a digitação (ex.: rascunho de uma célula em edição) nem o undo nativo dela.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

function onGlobalKeydown(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey) || isTypingTarget(event.target)) return

  const key = event.key.toLowerCase()
  if (key === 'z') {
    event.preventDefault()
    onUndo()
  } else if (key === 'r') {
    event.preventDefault()
    onRedo()
  } else if (key === 's') {
    event.preventDefault()
    onOverwriteOriginal()
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onUnmounted(() => window.removeEventListener('keydown', onGlobalKeydown))

/**
 * Recarregar/fechar a aba com alteração pendente (`hasUnsavedChanges`):
 * dispara o diálogo nativo do navegador (texto genérico, sem opção de salvar
 * — não há UI customizável nesse caso). A navegação interna (logo/"Voltar",
 * "Comparar") usa o modal customizado de `useUnsavedChangesGuard`, via
 * `guardNavigation`.
 */
function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (!hasUnsavedChanges.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onUnmounted(() => window.removeEventListener('beforeunload', onBeforeUnload))

/** Visibilidade do painel de filtros (UI-01) — nenhuma persistência (RF-07). */
const showFilters = ref(false)

function onToggleFilters(): void {
  showFilters.value = !showFilters.value
}

/** Visibilidade do modal de exportação (UI-04) — nenhuma persistência (RF-16). */
const showExport = ref(false)

function onOpenExport(): void {
  showExport.value = true
}

/**
 * Navega para a tela de comparação (RF-02, T07) — passa pelo guard de
 * alterações não salvas (mesmo modal do "Voltar"/logo em `default.vue`).
 */
function onOpenCompare(): void {
  guardNavigation('/compare')
}

/** Só os filtros que restringem linhas (não-inertes) acionam a mensagem/ação de "limpar filtros" no estado vazio. */
const hasActiveFilters = computed(() => activeFilters.value.length > 0)
</script>

<template>
  <section v-if="hasDataset" class="viewer">
    <ViewerToolbar
      v-model:search="search"
      :row-count="visibleRowCount"
      :columns="columns"
      :active-filter-count="activeFilterCount"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :has-unsaved-changes="hasUnsavedChanges"
      :save-error="saveError"
      @toggle-column="toggleColumn"
      @toggle-pin="togglePin"
      @toggle-filters="onToggleFilters"
      @open-export="onOpenExport"
      @open-compare="onOpenCompare"
      @undo="onUndo"
      @redo="onRedo"
      @save-new-version="onSaveNewVersion"
      @overwrite-original="onOverwriteOriginal"
    />

    <FilterChips :columns="columns" :filters="filters" @remove="removeFilter" />

    <FilterPanel
      :open="showFilters"
      :columns="columns"
      :filters="filters"
      @apply="applyFilters"
      @close="showFilters = false"
    />

    <ExportModal
      :open="showExport"
      :filtered-rows="filteredRows"
      :all-rows="dataset?.rows ?? []"
      :display-columns="displayColumns"
      :file-name="meta?.name ?? ''"
      @close="showExport = false"
    />

    <SaveCopyModal
      :open="showSaveVersionConfirm"
      :file-name="meta?.name ?? ''"
      :suggested-name="suggestedCopyName"
      :busy="isSaving"
      @confirm="onConfirmSaveVersion"
      @close="showSaveVersionConfirm = false"
    />

    <ConfirmModal
      :open="showOverwriteConfirm"
      title="Salvar?"
      :message="`Isso substituirá permanentemente o conteúdo de “${meta?.name ?? ''}”. As edições não salvas como cópia serão perdidas do arquivo original — esta ação não pode ser desfeita.`"
      confirm-label="Salvar"
      danger
      :busy="isSaving"
      @confirm="onConfirmOverwrite"
      @close="showOverwriteConfirm = false"
    />

    <div class="viewer__body">
      <ViewerTable
        :columns="displayColumns"
        :rows="sortedRows"
        :selected-index="selectedIndex"
        :sort-keys="sortKeys"
        :has-active-filters="hasActiveFilters"
        :no-results="noResults"
        :column-duplicate-counts="columnDuplicateCounts"
        @select-column="selectColumn"
        @sort="sortColumn"
        @sort-additive="sortColumnAdditive"
        @resize="resizeColumn"
        @reorder="reorderColumn"
        @toggle-pin="togglePin"
        @clear-filters="clearFilters"
      />

      <Transition name="stats-grow">
        <StatsPanel
          v-if="selectedStats"
          :label="selectedLabel"
          :stats="selectedStats"
          @close="selectColumn(null)"
        />
      </Transition>
    </div>
  </section>
</template>

<style scoped>
/* Superfície única do Viewer (fiel à Screen 2): toolbar no topo e, abaixo,
   tabela + painel de stats colados — separados só por linhas de 1px, sem gaps.
   O card preenche a altura disponível (`.app-content` é flex full-height) e o
   scroll fica confinado à área da tabela. */
.viewer {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.viewer__body {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* A tabela ocupa o espaço restante; o painel tem largura fixa e um divisor à
   esquerda (o próprio painel desenha a borda — ver StatsPanel). Estilizamos as
   raízes dos componentes filhos: em CSS scoped, o Vue aplica o escopo do pai à
   raiz do filho, então `.viewer-table`/`.stats-panel` são alcançáveis daqui. */
.viewer__body > .viewer-table {
  flex: 1;
  min-width: 0;
}

.viewer__body > .stats-panel {
  flex: none;
  width: 320px;
}

/* Empilha em telas estreitas: o divisor do painel vira borda superior. */
@media (max-width: 900px) {
  .viewer__body {
    flex-direction: column;
  }

  .viewer__body > .stats-panel {
    width: auto;
  }
}

/* Abrir/fechar o painel de estatísticas (RF-06b/UI-03): a largura cresce de 0
   até os 320px normais junto com um fade, dando o efeito de "crescer e
   aparecer" pedido para abrir/fechar via botão de stats ou o "X" do painel.
   Especificidade elevada (3 classes) para vencer `.viewer__body > .stats-panel`. */
.viewer__body > .stats-panel.stats-grow-enter-active,
.viewer__body > .stats-panel.stats-grow-leave-active {
  transition:
    width 0.26s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.2s ease,
    padding-left 0.26s ease,
    padding-right 0.26s ease;
  overflow: hidden;
}

.viewer__body > .stats-panel.stats-grow-enter-from,
.viewer__body > .stats-panel.stats-grow-leave-to {
  width: 0;
  opacity: 0;
  padding-left: 0;
  padding-right: 0;
}

@media (prefers-reduced-motion: reduce) {
  .viewer__body > .stats-panel.stats-grow-enter-active,
  .viewer__body > .stats-panel.stats-grow-leave-active {
    transition-duration: 0s;
  }
}
</style>
