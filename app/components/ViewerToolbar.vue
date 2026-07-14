<script setup lang="ts">
import SearchInput from '~/components/SearchInput.vue'
import Dropdown from '~/components/Dropdown.vue'
import { formatRowCount } from '~/services/formatFile'
import type { ViewerColumn } from '~/composables/useViewer'

/**
 * Toolbar do **Viewer** (Fase 7, US-2.1).
 *
 * Fiel à tela de referência: nome do arquivo, contador de linhas, campo de
 * busca "Buscar em tudo…" e seletor de colunas (mostrar/ocultar). Os controles
 * de features adiadas (Filtros, Exportar) ficam **fora do escopo do MVP** e não
 * são renderizados aqui.
 *
 * Ref de design: `.spec/init/design/README.md#screen-2--visualizador-principal`.
 */
defineProps<{
  /** Nome do arquivo carregado. */
  fileName: string
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
    <div class="toolbar__file">
      <span class="toolbar__name">{{ fileName }}</span>
      <span class="toolbar__count">{{ formatRowCount(rowCount) }} linhas</span>
    </div>

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
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.toolbar__file {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

.toolbar__name {
  font-family: var(--mono);
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar__count {
  flex: none;
  font-size: 13px;
  color: var(--text-3);
  white-space: nowrap;
}

.toolbar__controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar__search {
  width: 280px;
  max-width: 40vw;
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
    width: 100%;
    max-width: none;
  }
}
</style>
