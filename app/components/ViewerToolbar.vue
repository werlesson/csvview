<script setup lang="ts">
import { computed, ref } from 'vue'
import SearchInput from '~/components/SearchInput.vue'
import Dropdown from '~/components/Dropdown.vue'
import ColumnChip from '~/components/ColumnChip.vue'
import Badge from '~/components/Badge.vue'
import { formatRowCount } from '~/services/formatFile'
import type { ViewerColumn } from '~/composables/useViewer'

/**
 * Toolbar do **Viewer** (Fase 7, US-2.1).
 *
 * Fiel à tela de referência (Screen 2): à esquerda o campo de busca
 * "Buscar em tudo…", o controle **Filtros** (badge de contagem, UI-02) e o
 * seletor de colunas; à direita, o controle **Exportar** (UI-04, abre o
 * modal de exportação via `open-export`) e o contador de linhas. O nome do
 * arquivo fica na barra de título (header do layout).
 *
 * Cada item do menu "Colunas" reusa {@link ColumnChip} (variação `pinned`) e
 * expõe um controle de fixar/desfixar equivalente ao botão de pin do
 * cabeçalho da tabela (`toggle-pin`, UI-05) — os dois controles operam sobre o
 * mesmo estado de fixação (`togglePin` em `useViewer`).
 *
 * Ref de design: `.spec/init/design/README.md#screen-2--visualizador-principal`.
 */
const props = withDefaults(
  defineProps<{
    /** Total de linhas do dataset (sem filtro). */
    rowCount: number
    /** Colunas do dataset, com tipo, visibilidade e fixação atuais. */
    columns: ViewerColumn[]
    /** Termo de busca (suporta `v-model:search`). */
    search: string
    /** Nº de filtros de coluna ativos (chips) — badge no controle "Filtros" (UI-02). */
    activeFilterCount?: number
    /** `true` quando há ao menos uma entrada desfazível no histórico do dataset atual (RF-09). */
    canUndo?: boolean
    /** `true` quando há ao menos uma entrada refazível no histórico do dataset atual (RF-09). */
    canRedo?: boolean
    /** Mensagem de erro da última escrita de "Salvar nova versão"/"Sobrescrever original" (RNF-02). */
    saveError?: string | null
  }>(),
  {
    activeFilterCount: 0,
    canUndo: false,
    canRedo: false,
    saveError: null,
  },
)

const emit = defineEmits<{
  (e: 'update:search', value: string): void
  (e: 'toggle-column', index: number): void
  (e: 'toggle-pin', index: number): void
  (e: 'toggle-filters'): void
  (e: 'open-export'): void
  (e: 'undo'): void
  (e: 'redo'): void
  (e: 'save-new-version'): void
  (e: 'overwrite-original'): void
}>()

function onToggleFilters(): void {
  emit('toggle-filters')
}

function onOpenExport(): void {
  emit('open-export')
}

function onUndo(): void {
  if (!props.canUndo) return
  emit('undo')
}

function onRedo(): void {
  if (!props.canRedo) return
  emit('redo')
}

function onSaveNewVersion(): void {
  emit('save-new-version')
}

function onOverwriteOriginal(): void {
  emit('overwrite-original')
}

function onSearch(value: string): void {
  emit('update:search', value)
}

/** Termo de busca do menu "Colunas" — filtra a lista, independente da busca da tabela. */
const columnSearch = ref('')

/** Colunas cujo rótulo casa com `columnSearch` (case-insensitive); sem termo, todas. */
const filteredColumns = computed(() => {
  const term = columnSearch.value.trim().toLowerCase()
  if (!term) return props.columns
  return props.columns.filter((column) => column.label.toLowerCase().includes(term))
})

/** Limpa a busca ao fechar o menu, para reabrir sempre com a lista completa. */
function onColumnsMenuClose(): void {
  columnSearch.value = ''
}

function onToggle(index: number): void {
  emit('toggle-column', index)
}

function onTogglePin(index: number): void {
  emit('toggle-pin', index)
}
</script>

<template>
  <div class="toolbar">
    <div class="toolbar__controls">
      <div class="toolbar__search">
        <SearchInput
          :model-value="search"
          placeholder="Buscar em tudo…"
          @update:model-value="onSearch"
        />
      </div>

      <button
        type="button"
        class="toolbar__filters"
        aria-label="Filtros"
        @click="onToggleFilters"
      >
        <svg
          class="toolbar__icon"
          viewBox="0 0 16 16"
          width="15"
          height="15"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M2 3 H14 L9.5 8.2 V13 L6.5 11.5 V8.2 Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linejoin="round"
          />
        </svg>
        <span>Filtros</span>
        <Badge v-if="activeFilterCount > 0" variant="accent" class="toolbar__filters-badge">
          {{ activeFilterCount }}
        </Badge>
      </button>

      <Dropdown label="Colunas" @close="onColumnsMenuClose">
        <template #trigger>
          <svg
            class="toolbar__icon"
            viewBox="0 0 16 16"
            width="15"
            height="15"
            aria-hidden="true"
            focusable="false"
          >
            <rect x="2" y="2.5" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3" />
            <line x1="6.5" y1="2.5" x2="6.5" y2="13.5" stroke="currentColor" stroke-width="1.3" />
            <line x1="10" y1="2.5" x2="10" y2="13.5" stroke="currentColor" stroke-width="1.3" />
          </svg>
          <span>Colunas</span>
        </template>
        <div class="columns-menu__search">
          <SearchInput
            v-model="columnSearch"
            placeholder="Buscar coluna…"
            aria-label="Buscar coluna"
          />
        </div>
        <ul class="columns-menu" role="none">
          <li v-if="filteredColumns.length === 0" class="columns-menu__empty" role="none">
            Nenhuma coluna encontrada
          </li>
          <li v-for="column in filteredColumns" :key="column.index" role="none">
            <div
              class="columns-menu__item"
              :class="{ 'columns-menu__item--pinned': column.pinned }"
            >
              <label class="columns-menu__visibility">
                <input
                  type="checkbox"
                  class="columns-menu__checkbox"
                  :checked="column.visible"
                  @change="onToggle(column.index)"
                >
                <ColumnChip
                  class="columns-menu__chip"
                  :label="column.label"
                  :type="column.type"
                  :pinned="column.pinned"
                />
              </label>
              <button
                type="button"
                class="columns-menu__pin"
                :class="{ 'columns-menu__pin--active': column.pinned }"
                :aria-pressed="column.pinned"
                :aria-label="column.pinned ? `Desfixar coluna ${column.label}` : `Fixar coluna ${column.label}`"
                @click="onTogglePin(column.index)"
              >
                <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                  <path
                    d="M4 1.5 H8 L7.4 5 L9.5 6.8 H6.5 L5.8 10.5 H5.2 L4.5 6.8 H1.5 L3.6 5 Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </li>
        </ul>
      </Dropdown>
    </div>

    <div class="toolbar__meta">
      <span v-if="saveError" class="toolbar__save-error" role="alert">{{ saveError }}</span>

      <div class="toolbar__history" role="group" aria-label="Desfazer/Refazer">
        <button
          type="button"
          class="toolbar__history-btn"
          aria-label="Desfazer"
          :disabled="!canUndo"
          @click="onUndo"
        >
          <svg
            class="toolbar__icon"
            viewBox="0 0 16 16"
            width="15"
            height="15"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M6 3.5 2.5 7 6 10.5 M2.5 7 H10 A3.5 3.5 0 0 1 10 14 H8"
              fill="none"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>Desfazer</span>
        </button>
        <button
          type="button"
          class="toolbar__history-btn"
          aria-label="Refazer"
          :disabled="!canRedo"
          @click="onRedo"
        >
          <svg
            class="toolbar__icon"
            viewBox="0 0 16 16"
            width="15"
            height="15"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M10 3.5 13.5 7 10 10.5 M13.5 7 H6 A3.5 3.5 0 0 0 6 14 H8"
              fill="none"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>Refazer</span>
        </button>
      </div>

      <button
        type="button"
        class="toolbar__overwrite"
        aria-label="Sobrescrever original"
        @click="onOverwriteOriginal"
      >
        <span>Sobrescrever original</span>
      </button>

      <button
        type="button"
        class="toolbar__save-version"
        aria-label="Salvar nova versão"
        @click="onSaveNewVersion"
      >
        <span>Salvar nova versão</span>
      </button>

      <button
        type="button"
        class="toolbar__export"
        aria-label="Exportar"
        @click="onOpenExport"
      >
        <svg
          class="toolbar__icon"
          viewBox="0 0 16 16"
          width="15"
          height="15"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M8 1.5 V10 M8 10 L5 7 M8 10 L11 7"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M2.5 11.5 V13.5 H13.5 V11.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>Exportar</span>
      </button>
      <span class="toolbar__count">{{ formatRowCount(rowCount) }} linhas</span>
    </div>
  </div>
</template>

<style scoped>
/* Faixa de topo da superfície do Viewer: colada ao topo do card, separada da
   tabela apenas por uma linha de 1px (sem borda/raio próprios). */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
}

.toolbar__controls {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.toolbar__search {
  flex: 0 1 360px;
  min-width: 0;
}

.toolbar__meta {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Controle "Exportar" (UI-04): destaque primary (accent sólido), para se
   diferenciar dos demais controles da toolbar como ação principal. */
.toolbar__export {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  padding: 8px 12px;
  background: var(--accent);
  color: var(--accent-fg);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
}

.toolbar__export:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.toolbar__export .toolbar__icon {
  color: var(--accent-fg);
}

.toolbar__count {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--text-3);
  white-space: nowrap;
}

/* Mensagem de erro de "Salvar nova versão"/"Sobrescrever original" (RNF-02): exibida
   sem bloquear os demais controles da toolbar. */
.toolbar__save-error {
  font-size: 12.5px;
  color: var(--error);
  white-space: nowrap;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Grupo "Desfazer"/"Refazer" (RF-06, RF-07, RF-09). */
.toolbar__history {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.toolbar__history-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 500;
  padding: 7px 10px;
  background: var(--bg-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
}

.toolbar__history-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.toolbar__history-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* "Salvar nova versão" (RF-11): mesmo padrão visual accent-sólido do controle
   "Exportar" — ação de gravação principal, não-destrutiva (cria um registro novo). */
.toolbar__save-version {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  padding: 8px 12px;
  background: var(--accent);
  color: var(--accent-fg);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
}

.toolbar__save-version:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

/* "Sobrescrever original" (RF-15, CT-04): visualmente distinto de "Salvar nova
   versão" — borda de aviso, fundo transparente, para sinalizar uma ação destrutiva
   (substitui o registro original) que nunca é disparada pelo botão padrão. */
.toolbar__overwrite {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  padding: 8px 12px;
  background: transparent;
  color: var(--warning);
  border: 1px solid var(--warning);
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
}

.toolbar__overwrite:hover {
  background: var(--warning-soft);
}

.toolbar__icon {
  flex: none;
  color: var(--text-2);
}

/* Controle "Filtros" (UI-02): mesma aparência do gatilho do Dropdown, com
   badge de contagem (Badge.vue) quando há filtros ativos. */
.toolbar__filters {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  padding: 8px 12px;
  background: var(--bg-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
}

.toolbar__filters:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.toolbar__filters-badge {
  padding: 2px 6px;
}

/* Busca do menu "Colunas": mesmo `SearchInput` do campo principal, num
   invólucro compacto (sem o padding do menu ao redor, para ficar rente aos
   itens da lista logo abaixo). */
.columns-menu__search {
  padding: 4px 4px 6px;
}

.columns-menu__empty {
  padding: 10px 8px;
  font-size: 13px;
  color: var(--text-3);
  text-align: center;
}

.columns-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 320px;
  overflow-y: auto;
}

.columns-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text);
}

.columns-menu__item:hover {
  background: var(--bg-hover);
}

/* Item de coluna fixada (UI-05): mesma variação visual do chip (`chip--pinned`,
   borda accent), aplicada também à linha do item inteira no menu. */
.columns-menu__item--pinned {
  border: 1px solid var(--accent);
}

.columns-menu__visibility {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
  cursor: pointer;
}

.columns-menu__checkbox {
  flex: none;
  accent-color: var(--accent);
}

.columns-menu__chip {
  flex: 1;
  min-width: 0;
}

.columns-menu__chip :deep(.chip__label) {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Controle de fixar/desfixar (UI-05): equivalente ao botão de pin do
   cabeçalho da tabela — mesmo estado (`toggle-pin`), reutilizado aqui no menu
   "Colunas". */
.columns-menu__pin {
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

.columns-menu__pin:hover {
  color: var(--accent);
  background: var(--accent-soft);
}

.columns-menu__pin--active {
  color: var(--accent);
}

@media (max-width: 640px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar__search {
    flex: 1 1 auto;
  }

  .toolbar__meta {
    justify-content: flex-end;
  }
}
</style>
