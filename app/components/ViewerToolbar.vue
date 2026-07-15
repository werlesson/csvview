<script setup lang="ts">
import SearchInput from '~/components/SearchInput.vue'
import Dropdown from '~/components/Dropdown.vue'
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
 * Ref de design: `.spec/init/design/README.md#screen-2--visualizador-principal`.
 */
defineProps<{
  /** Total de linhas do dataset (sem filtro). */
  rowCount: number
  /** Colunas do dataset, com tipo e visibilidade atual. */
  columns: ViewerColumn[]
  /** Termo de busca (suporta `v-model:search`). */
  search: string
}>()

const emit = defineEmits<{
  (e: 'update:search', value: string): void
  (e: 'toggle-column', index: number): void
}>()

function onSearch(value: string): void {
  emit('update:search', value)
}

function onToggle(index: number): void {
  emit('toggle-column', index)
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
            <label class="columns-menu__item">
              <input
                type="checkbox"
                class="columns-menu__checkbox"
                :checked="column.visible"
                @change="onToggle(column.index)"
              >
              <span class="columns-menu__label">{{ column.label }}</span>
              <span class="columns-menu__type">{{ column.type }}</span>
            </label>
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
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
}

.columns-menu__item:hover {
  background: var(--bg-hover);
}

.columns-menu__checkbox {
  flex: none;
  accent-color: var(--accent);
}

.columns-menu__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.columns-menu__type {
  flex: none;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-3);
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
