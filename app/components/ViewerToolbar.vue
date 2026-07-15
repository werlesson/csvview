<script setup lang="ts">
import SearchInput from '~/components/SearchInput.vue'
import Dropdown from '~/components/Dropdown.vue'
import ColumnChip from '~/components/ColumnChip.vue'
import { formatRowCount } from '~/services/formatFile'
import type { ViewerColumn } from '~/composables/useViewer'

/**
 * Toolbar do **Viewer** (Fase 7, US-2.1).
 *
 * Fiel à tela de referência (Screen 2): à esquerda o campo de busca
 * "Buscar em tudo…" e o seletor de colunas; à direita, o contador de linhas.
 * O nome do arquivo fica na barra de título (header do layout). Os controles
 * de features adiadas (Filtros, Exportar) ficam **fora do escopo do MVP** e não
 * são renderizados aqui.
 *
 * Cada item do menu "Colunas" reusa {@link ColumnChip} (variação `pinned`) e
 * expõe um controle de fixar/desfixar equivalente ao botão de pin do
 * cabeçalho da tabela (`toggle-pin`, UI-05) — os dois controles operam sobre o
 * mesmo estado de fixação (`togglePin` em `useViewer`).
 *
 * Ref de design: `.spec/init/design/README.md#screen-2--visualizador-principal`.
 */
defineProps<{
  /** Total de linhas do dataset (sem filtro). */
  rowCount: number
  /** Colunas do dataset, com tipo, visibilidade e fixação atuais. */
  columns: ViewerColumn[]
  /** Termo de busca (suporta `v-model:search`). */
  search: string
}>()

const emit = defineEmits<{
  (e: 'update:search', value: string): void
  (e: 'toggle-column', index: number): void
  (e: 'toggle-pin', index: number): void
}>()

function onSearch(value: string): void {
  emit('update:search', value)
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

      <Dropdown label="Colunas">
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
        <ul class="columns-menu" role="none">
          <li v-for="column in columns" :key="column.index" role="none">
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
}

.toolbar__count {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--text-3);
  white-space: nowrap;
}

.toolbar__icon {
  flex: none;
  color: var(--text-2);
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
