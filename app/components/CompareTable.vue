<script setup lang="ts">
import { computed, ref } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import Badge from '~/components/Badge.vue'
import type { BadgeVariant } from '~/components/Badge.vue'
import type { ColumnType } from '~/services/columnStats'
import type { ComparisonRecord, RecordStatus } from '~/services/diffDatasets'

/**
 * Tabela virtualizada da tela de comparação (feature `file-comparison`,
 * Fase 3, T05, UI-02/UI-04).
 *
 * Reaproveita o padrão de virtualização de `ViewerTable.vue`
 * (`@tanstack/vue-virtual`) para navegar grandes volumes de registros
 * pareados (`diffDatasets`, T01) sem materializar todo o DOM. Cada linha
 * exibe o status do registro (`Badge.vue`); em uma linha `changed`, toda
 * célula cujo nome de coluna está em `record.diffColumns` recebe um
 * indicador visual distinto (UI-02 AC). `records` já chega filtrado pelo
 * chamador quando "somente diferenças" está ativo (UI-04) — este componente
 * só renderiza a lista recebida. Sem edição de célula (fora do escopo).
 *
 * Ref de design: `.spec/init/design/README.md#screen-5--comparação-de-arquivos`.
 */

/** Coluna comum a exibir: nome + tipo inferido + índice em cada dataset (para extrair o valor de `rowA`/`rowB`). */
export interface CompareTableColumn {
  name: string
  type: ColumnType
  indexA: number
  indexB: number
}

const props = withDefaults(
  defineProps<{
    /** Colunas comuns aos dois datasets, na ordem de exibição. */
    commonColumns: CompareTableColumn[]
    /** Registros já classificados/pareados (`diffDatasets`), já filtrados pelo chamador quando aplicável (UI-04). */
    records: ComparisonRecord[]
    /** Estado vazio calculado pelo chamador; quando omitido, cai para `records.length === 0`. */
    noResults?: boolean
  }>(),
  { noResults: undefined },
)

/** Altura estimada de cada linha, em px (usada pela virtualização). */
const ROW_HEIGHT = 40

/** Largura fixa da coluna de status. */
const STATUS_COL_WIDTH = 140

/** Largura padrão de uma coluna de dado. */
const DATA_COL_WIDTH = 180

const STATUS_LABELS: Record<RecordStatus, string> = {
  added: 'Adicionado',
  removed: 'Removido',
  changed: 'Alterado',
  unchanged: 'Sem alteração',
}

const STATUS_VARIANTS: Record<RecordStatus, BadgeVariant> = {
  added: 'settled',
  removed: 'failed',
  changed: 'pending',
  unchanged: 'default',
}

function statusLabel(status: RecordStatus): string {
  return STATUS_LABELS[status]
}

function statusVariant(status: RecordStatus): BadgeVariant {
  return STATUS_VARIANTS[status]
}

/** Valor exibido na célula: prefere o valor de B (arquivo mais recente); cai para A quando só existe em A (`removed`). */
function cellValue(record: ComparisonRecord, column: CompareTableColumn): string {
  if (record.rowB) return record.rowB[column.indexB] ?? ''
  if (record.rowA) return record.rowA[column.indexA] ?? ''
  return ''
}

/** Célula com valor divergente entre A e B (UI-02 AC): só se aplica a registros `changed`. */
function isDiffCell(record: ComparisonRecord, column: CompareTableColumn): boolean {
  return record.status === 'changed' && record.diffColumns.includes(column.name)
}

/** Largura definida da grade (soma da coluna de status + colunas de dado), para `table-layout: fixed`. */
const gridWidth = computed(
  () => `${STATUS_COL_WIDTH + props.commonColumns.length * DATA_COL_WIDTH}px`,
)

const scroller = ref<HTMLElement | null>(null)

const rowVirtualizer = useVirtualizer(
  computed(() => ({
    count: props.records.length,
    getScrollElement: () => scroller.value,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })),
)

/** Apenas as linhas atualmente visíveis (mais overscan). */
const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())
/** Altura total da lista, para dimensionar a área de rolagem. */
const totalSize = computed(() => rowVirtualizer.value.getTotalSize())

/** Sem nenhum registro para exibir (filtro "somente diferenças" sem resultado, ou nenhum dado pareado). */
const isEmpty = computed(() => props.noResults ?? props.records.length === 0)
</script>

<template>
  <div ref="scroller" class="compare-table" role="region" aria-label="Tabela de comparação">
    <table class="compare-table__grid">
      <thead class="compare-table__head">
        <tr class="compare-table__row" :style="{ width: gridWidth }">
          <th class="compare-table__th compare-table__th--status" :style="{ '--col-w': `${STATUS_COL_WIDTH}px` }" scope="col">
            Status
          </th>
          <th
            v-for="column in commonColumns"
            :key="column.name"
            class="compare-table__th"
            :style="{ '--col-w': `${DATA_COL_WIDTH}px` }"
            scope="col"
          >
            {{ column.name }}
          </th>
        </tr>
      </thead>
      <tbody v-if="!isEmpty" class="compare-table__body" :style="{ height: `${totalSize}px` }">
        <tr
          v-for="virtualRow in virtualRows"
          :key="virtualRow.key"
          class="compare-table__row"
          :class="`compare-table__row--${records[virtualRow.index]?.status}`"
          :style="{ width: gridWidth, transform: `translateY(${virtualRow.start}px)` }"
        >
          <td class="compare-table__cell compare-table__cell--status" :style="{ '--col-w': `${STATUS_COL_WIDTH}px` }">
            <Badge :variant="statusVariant(records[virtualRow.index]!.status)">
              {{ statusLabel(records[virtualRow.index]!.status) }}
            </Badge>
          </td>
          <td
            v-for="column in commonColumns"
            :key="column.name"
            class="compare-table__cell"
            :class="{ 'compare-table__cell--diff': isDiffCell(records[virtualRow.index]!, column) }"
            :style="{ '--col-w': `${DATA_COL_WIDTH}px` }"
          >
            {{ cellValue(records[virtualRow.index]!, column) }}
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="isEmpty" class="compare-table__empty" role="status">
      <p class="compare-table__empty-title">Nenhum registro encontrado</p>
      <p class="compare-table__empty-hint">
        Nenhum registro casa com o filtro aplicado. Desative "Somente diferenças" para ver todos os registros.
      </p>
    </div>
  </div>
</template>

<style scoped>
.compare-table {
  position: relative;
  height: 100%;
  overflow: auto;
  background: var(--bg-1);
}

.compare-table__grid {
  display: block;
  width: 100%;
  border-collapse: collapse;
}

.compare-table__head {
  display: block;
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bg-2);
}

.compare-table__head .compare-table__row,
.compare-table__body .compare-table__row {
  display: table;
  min-width: 100%;
  table-layout: fixed;
}

.compare-table__body {
  display: block;
  position: relative;
}

.compare-table__body .compare-table__row {
  position: absolute;
  top: 0;
  left: 0;
}

.compare-table__th {
  width: var(--col-w);
  display: table-cell;
  vertical-align: middle;
  padding: 10px 12px;
  font-family: var(--font);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-3);
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
}

.compare-table__cell {
  width: var(--col-w);
  display: table-cell;
  vertical-align: middle;
  padding: 10px 12px;
  font-family: var(--mono);
  font-size: 13px;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compare-table__cell--status {
  font-family: var(--font);
}

/* Indicador visual distinto de célula divergente (UI-02): fundo + borda accent,
   sem depender só de cor (a coluna de status já indica `changed`). */
.compare-table__cell--diff {
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent);
  color: var(--accent);
  font-weight: 600;
}

.compare-table__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 48px 24px;
  text-align: center;
}

.compare-table__empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}

.compare-table__empty-hint {
  font-size: 13px;
  color: var(--text-3);
}
</style>
