<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dropdown from '~/components/Dropdown.vue'
import Select from '~/components/Select.vue'
import Badge from '~/components/Badge.vue'
import {
  operatorsForFamily,
  typeFamily,
  type ColumnFilter,
  type FilterOperator,
  type FilterRange,
} from '~/services/columnFilters'
import type { ViewerColumn } from '~/composables/useViewer'

/**
 * Painel de filtros por coluna do **Viewer** (Fase de filtros, UI-01).
 *
 * Componente fino/apresentacional: só props/emits, sem lógica de dados. Exibe
 * um chip por filtro ativo (rótulo `<coluna> <operador> <valor>`, mesmo se a
 * coluna estiver oculta), um editor em dropdown para adicionar um novo filtro
 * (coluna → operador, por família de tipo → valor) e a ação "Limpar". Nenhum
 * controle de filtro vive no cabeçalho da coluna (`ViewerTable.vue` `<th>`).
 *
 * Ref de design: `.spec/init/design/README.md#screen-3--filtros-avançados`
 * (chips reaproveitam `Badge.vue`; editor reaproveita `Dropdown.vue`/`Select.vue`).
 */
const props = defineProps<{
  /** Todas as colunas do dataset (inclusive ocultas) — o seletor lista todas. */
  columns: ViewerColumn[]
  /** Filtros ativos (chips), na ordem em que foram adicionados. */
  filters: ColumnFilter[]
}>()

const emit = defineEmits<{
  (e: 'add', filter: ColumnFilter): void
  (e: 'update', index: number, patch: Partial<ColumnFilter>): void
  (e: 'remove', index: number): void
  (e: 'clear'): void
}>()

/** Rótulos pt-BR dos operadores (RF-01/RF-02) — resolvidos aqui, na UI. */
const OPERATOR_LABELS: Record<FilterOperator, string> = {
  igual: 'igual a',
  diferente: 'diferente de',
  contem: 'contém',
  naoContem: 'não contém',
  maiorQue: 'maior que',
  menorQue: 'menor que',
  entre: 'entre',
  intervaloDatas: 'intervalo de datas',
  vazio: 'vazio',
  preenchido: 'preenchido',
  verdadeiro: 'verdadeiro',
  falso: 'falso',
}

/** Operadores que não têm campo de valor (RF-05: nunca inertes). */
const VALUELESS_OPERATORS: ReadonlySet<FilterOperator> = new Set([
  'vazio',
  'preenchido',
  'verdadeiro',
  'falso',
])

/** Operadores de dois limites (`{ from, to }`). */
const RANGE_OPERATORS: ReadonlySet<FilterOperator> = new Set(['entre', 'intervaloDatas'])

function isValuelessOperator(operator: FilterOperator): boolean {
  return VALUELESS_OPERATORS.has(operator)
}

function isRangeOperator(operator: FilterOperator): boolean {
  return RANGE_OPERATORS.has(operator)
}

function isRange(value: ColumnFilter['value']): value is FilterRange {
  return typeof value === 'object' && value !== null && 'from' in value && 'to' in value
}

function columnLabel(index: number): string {
  return props.columns.find((column) => column.index === index)?.label ?? `coluna ${index}`
}

/** Valor legível de um filtro para o rótulo do chip; vazio para operadores sem valor. */
function valueLabel(filter: ColumnFilter): string {
  if (isValuelessOperator(filter.operator)) return ''
  if (isRangeOperator(filter.operator)) {
    if (!isRange(filter.value)) return ''
    return `${filter.value.from} e ${filter.value.to}`
  }
  return filter.value === undefined || filter.value === null ? '' : String(filter.value)
}

/** Rótulo legível do chip: `<coluna> <operador> <valor>` (UI-01). */
function filterLabel(filter: ColumnFilter): string {
  const parts = [columnLabel(filter.column), OPERATOR_LABELS[filter.operator]]
  const value = valueLabel(filter)
  if (value !== '') parts.push(value)
  return parts.join(' ')
}

function onRemove(index: number): void {
  emit('remove', index)
}

function onClear(): void {
  emit('clear')
}

// --- Editor de novo filtro ("Adicionar filtro") ---

const draftColumn = ref<number>(props.columns[0]?.index ?? 0)
const draftOperatorOptions = computed<FilterOperator[]>(() => {
  const column = props.columns.find((c) => c.index === draftColumn.value)
  const family = typeFamily(column?.type ?? 'text')
  return operatorsForFamily(family)
})
const draftOperator = ref<FilterOperator>(draftOperatorOptions.value[0] ?? 'igual')
const draftValue = ref('')
const draftFrom = ref('')
const draftTo = ref('')

// Trocar de coluna pode mudar a família de tipo — realinha o operador do
// rascunho para o primeiro disponível na nova família (RF-01).
watch(draftOperatorOptions, (options) => {
  if (!options.includes(draftOperator.value)) {
    draftOperator.value = options[0] ?? 'igual'
  }
})

const columnOptions = computed(() =>
  props.columns.map((column) => ({ label: column.label, value: String(column.index) })),
)

const operatorOptions = computed(() =>
  draftOperatorOptions.value.map((operator) => ({
    label: OPERATOR_LABELS[operator],
    value: operator,
  })),
)

function onDraftColumnChange(value: string): void {
  draftColumn.value = Number(value)
}

function onDraftOperatorChange(value: string): void {
  draftOperator.value = value as FilterOperator
}

function resetDraft(): void {
  draftValue.value = ''
  draftFrom.value = ''
  draftTo.value = ''
}

function onSubmit(): void {
  const filter: ColumnFilter = {
    column: draftColumn.value,
    operator: draftOperator.value,
  }
  if (isRangeOperator(draftOperator.value)) {
    filter.value = { from: draftFrom.value, to: draftTo.value }
  } else if (!isValuelessOperator(draftOperator.value)) {
    filter.value = draftValue.value
  }
  emit('add', filter)
  resetDraft()
}
</script>

<template>
  <div class="filter-panel">
    <ul class="filter-panel__chips" aria-label="Filtros ativos">
      <li v-for="(filter, index) in filters" :key="index" class="filter-panel__chip-item">
        <Badge variant="accent" class="filter-panel__chip">
          <span class="filter-panel__chip-label">{{ filterLabel(filter) }}</span>
          <button
            type="button"
            class="filter-panel__chip-remove"
            :aria-label="`Remover filtro ${filterLabel(filter)}`"
            @click="onRemove(index)"
          >
            ×
          </button>
        </Badge>
      </li>
    </ul>

    <Dropdown label="Adicionar filtro" class="filter-panel__add" @close="resetDraft">
      <form class="filter-panel__editor" @submit.prevent="onSubmit">
        <label class="filter-panel__field">
          <span class="filter-panel__field-label">Coluna</span>
          <Select
            :model-value="String(draftColumn)"
            :options="columnOptions"
            aria-label="Coluna do filtro"
            @update:model-value="onDraftColumnChange"
          />
        </label>

        <label class="filter-panel__field">
          <span class="filter-panel__field-label">Operador</span>
          <Select
            :model-value="draftOperator"
            :options="operatorOptions"
            aria-label="Operador do filtro"
            @update:model-value="onDraftOperatorChange"
          />
        </label>

        <template v-if="isRangeOperator(draftOperator)">
          <label class="filter-panel__field">
            <span class="filter-panel__field-label">De</span>
            <input v-model="draftFrom" type="text" class="filter-panel__input" aria-label="Valor inicial">
          </label>
          <label class="filter-panel__field">
            <span class="filter-panel__field-label">Até</span>
            <input v-model="draftTo" type="text" class="filter-panel__input" aria-label="Valor final">
          </label>
        </template>
        <label v-else-if="!isValuelessOperator(draftOperator)" class="filter-panel__field">
          <span class="filter-panel__field-label">Valor</span>
          <input v-model="draftValue" type="text" class="filter-panel__input" aria-label="Valor do filtro">
        </label>

        <button type="submit" class="filter-panel__submit">Adicionar filtro</button>
      </form>
    </Dropdown>

    <button
      type="button"
      class="filter-panel__clear"
      :disabled="filters.length === 0"
      @click="onClear"
    >
      Limpar
    </button>
  </div>
</template>

<style scoped>
.filter-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
}

.filter-panel__chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.filter-panel__chip-item {
  display: inline-flex;
}

.filter-panel__chip {
  gap: 6px;
}

.filter-panel__chip-label {
  white-space: nowrap;
}

.filter-panel__chip-remove {
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

.filter-panel__editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 220px;
  padding: 4px;
}

.filter-panel__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--text-3);
}

.filter-panel__input {
  height: 36px;
  padding: 0 12px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
}

.filter-panel__input:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--bg-1);
}

.filter-panel__submit {
  margin-top: 4px;
  padding: 8px 12px;
  background: var(--accent);
  color: var(--bg-1);
  border: none;
  border-radius: var(--radius-sm);
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.filter-panel__clear {
  padding: 8px 12px;
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-2);
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.filter-panel__clear:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.filter-panel__clear:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
