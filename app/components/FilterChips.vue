<script setup lang="ts">
import Badge from '~/components/Badge.vue'
import { filterLabel } from '~/services/filterLabels'
import type { ColumnFilter } from '~/services/columnFilters'
import type { ViewerColumn } from '~/composables/useViewer'

/**
 * Barra de filtros **aplicados**, acima da tabela (UI-01/UI-02).
 *
 * Um badge por filtro, com rótulo `<coluna> <operador> <valor>` (mesmo se a
 * coluna estiver oculta) e um "×" que remove aquele filtro imediatamente —
 * diferente do editor (`FilterPanel.vue`), que só aplica no botão "Filtrar".
 * Some por completo quando não há filtros aplicados.
 */
const props = defineProps<{
  /** Todas as colunas do dataset (inclusive ocultas) — o rótulo do chip busca aqui. */
  columns: ViewerColumn[]
  /** Filtros atualmente aplicados, na ordem em que foram adicionados. */
  filters: ColumnFilter[]
}>()

const emit = defineEmits<{
  (e: 'remove', index: number): void
}>()

function columnLabel(index: number): string {
  return props.columns.find((column) => column.index === index)?.label ?? `coluna ${index}`
}

function onRemove(index: number): void {
  emit('remove', index)
}
</script>

<template>
  <ul v-if="filters.length > 0" class="filter-chips" aria-label="Filtros aplicados">
    <li v-for="(filter, index) in filters" :key="index" class="filter-chips__item">
      <Badge variant="accent" class="filter-chips__chip">
        <span class="filter-chips__label">{{ filterLabel(filter, columnLabel(filter.column)) }}</span>
        <button
          type="button"
          class="filter-chips__remove"
          :aria-label="`Remover filtro ${filterLabel(filter, columnLabel(filter.column))}`"
          @click="onRemove(index)"
        >
          ×
        </button>
      </Badge>
    </li>
  </ul>
</template>

<style scoped>
.filter-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 10px 16px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
}

.filter-chips__item {
  display: inline-flex;
}

.filter-chips__chip {
  gap: 6px;
}

.filter-chips__label {
  white-space: nowrap;
}

.filter-chips__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}
</style>
