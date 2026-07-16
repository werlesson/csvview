<script setup lang="ts">
import { nextTick, ref, watch, computed } from 'vue'
import Select from '~/components/Select.vue'
import { operatorsForFamily, typeFamily, type ColumnFilter, type FilterOperator } from '~/services/columnFilters'
import {
  defaultFilterValue,
  isRangeOperator,
  isRangeValue,
  isValuelessOperator,
  OPERATOR_LABELS,
} from '~/services/filterLabels'
import type { ViewerColumn } from '~/composables/useViewer'

/**
 * Editor de filtros por coluna do **Viewer** (UI-01), como um drawer lateral
 * fixo à direita ("Filtros avançados" / "Combine múltiplas condições por
 * coluna"), fiel à Screen 3 do design.
 *
 * Mantém um **rascunho local** (`draftFilters`), semeado a partir de `filters`
 * (os filtros já aplicados) sempre que o drawer abre. Cards "Onde" editam só
 * o rascunho — nada é aplicado à tabela enquanto o usuário edita. O botão
 * **"Filtrar"** confirma o rascunho de uma vez (`emit('apply', ...)`) e fecha
 * o drawer; fechar por fora (backdrop/X/Escape) descarta o rascunho sem
 * aplicar. Os filtros já aplicados aparecem como badges acima da tabela
 * (`FilterChips.vue`), com remoção imediata — só a criação/edição passa pelo
 * gate do "Filtrar".
 *
 * Ref de design: `.spec/init/design/README.md#screen-3--filtros-avançados`.
 */
const props = defineProps<{
  /** Todas as colunas do dataset (inclusive ocultas) — o seletor lista todas. */
  columns: ViewerColumn[]
  /** Filtros já aplicados — semeiam o rascunho sempre que o drawer abre. */
  filters: ColumnFilter[]
  /** Visibilidade do drawer — controlada pelo pai (botão "Filtros" da toolbar). */
  open: boolean
}>()

const emit = defineEmits<{
  /** Confirma o rascunho inteiro de uma vez, substituindo os filtros aplicados. */
  (e: 'apply', filters: ColumnFilter[]): void
  (e: 'close'): void
}>()

const draftFilters = ref<ColumnFilter[]>([])

// Semeia o rascunho a partir dos filtros aplicados sempre que o drawer abre —
// fechar sem "Filtrar" (backdrop/X/Escape) simplesmente descarta o rascunho.
watch(
  () => props.open,
  (open) => {
    if (open) draftFilters.value = props.filters.map((filter) => ({ ...filter }))
  },
  { immediate: true },
)

function familyForColumn(columnIndex: number): ReturnType<typeof typeFamily> {
  const column = props.columns.find((c) => c.index === columnIndex)
  return typeFamily(column?.type ?? 'text')
}

function columnLabel(index: number): string {
  return props.columns.find((column) => column.index === index)?.label ?? `coluna ${index}`
}

const columnOptions = computed(() =>
  props.columns.map((column) => ({ label: column.label, value: String(column.index) })),
)

/** Opções de operador para um filtro, enquadradas pela família de tipo da sua coluna atual. */
function operatorOptionsFor(filter: ColumnFilter) {
  return operatorsForFamily(familyForColumn(filter.column)).map((operator) => ({
    label: OPERATOR_LABELS[operator],
    value: operator,
  }))
}

function rangeValue(filter: ColumnFilter) {
  return isRangeValue(filter.value) ? filter.value : { from: '', to: '' }
}

function scalarValue(filter: ColumnFilter): string {
  return filter.value === undefined || filter.value === null ? '' : String(filter.value)
}

function patchDraft(index: number, patch: Partial<ColumnFilter>): void {
  const current = draftFilters.value[index]
  if (!current) return
  const next = [...draftFilters.value]
  next[index] = { ...current, ...patch }
  draftFilters.value = next
}

/** Trocar de coluna pode mudar a família de tipo — realinha o operador se o atual não couber (RF-01). */
function onColumnChange(index: number, value: string): void {
  const filter = draftFilters.value[index]
  if (!filter) return
  const column = Number(value)
  const options = operatorsForFamily(familyForColumn(column))
  const operator = options.includes(filter.operator) ? filter.operator : options[0]!
  const patch: Partial<ColumnFilter> = { column, operator }
  if (operator !== filter.operator) patch.value = defaultFilterValue(operator)
  patchDraft(index, patch)
}

function onOperatorChange(index: number, value: string): void {
  const operator = value as FilterOperator
  patchDraft(index, { operator, value: defaultFilterValue(operator) })
}

function onValueChange(index: number, event: Event): void {
  patchDraft(index, { value: (event.target as HTMLInputElement).value })
}

function onRangeChange(index: number, part: 'from' | 'to', event: Event): void {
  const filter = draftFilters.value[index]
  if (!filter) return
  const value = (event.target as HTMLInputElement).value
  const current = rangeValue(filter)
  patchDraft(index, {
    value: part === 'from' ? { from: value, to: current.to } : { from: current.from, to: value },
  })
}

function onRemove(index: number): void {
  draftFilters.value = draftFilters.value.filter((_, i) => i !== index)
}

/** "Adicionar filtro": cria um card no rascunho para a primeira coluna/operador. */
function onAdd(): void {
  const column = props.columns[0]?.index ?? 0
  const operator = operatorsForFamily(familyForColumn(column))[0] ?? 'igual'
  draftFilters.value = [
    ...draftFilters.value,
    { column, operator, value: defaultFilterValue(operator) },
  ]
}

/** "Limpar": esvazia só o rascunho — nada muda na tabela até "Filtrar". */
function onClear(): void {
  draftFilters.value = []
}

/** "Filtrar": confirma o rascunho de uma vez e fecha o drawer (RF-05/RF-06). */
function onApply(): void {
  emit('apply', draftFilters.value)
  emit('close')
}

function onClose(): void {
  emit('close')
}

// Foco inicial no drawer ao abrir, para o Escape funcionar sem exigir clique antes.
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
  <div v-if="open" class="filter-overlay" @click.self="onClose">
    <aside
      ref="panel"
      class="filter-overlay__panel"
      role="dialog"
      aria-modal="true"
      aria-label="Filtros avançados"
      tabindex="-1"
      @keydown.esc="onClose"
    >
      <header class="filter-overlay__header">
        <div class="filter-overlay__heading">
          <h2 class="filter-overlay__title">Filtros avançados</h2>
          <p class="filter-overlay__subtitle">Combine múltiplas condições por coluna.</p>
        </div>
        <button
          type="button"
          class="filter-overlay__close"
          aria-label="Fechar filtros"
          @click="onClose"
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

      <div class="filter-overlay__body">
        <p v-if="draftFilters.length === 0" class="filter-overlay__empty">
          Nenhum filtro no rascunho ainda.
        </p>

        <template v-for="(filter, index) in draftFilters" :key="index">
          <div v-if="index > 0" class="filter-overlay__joiner" aria-hidden="true">E</div>

          <div class="filter-card">
            <div class="filter-card__head">
              <span class="filter-card__eyebrow">Onde</span>
              <button
                type="button"
                class="filter-card__remove"
                :aria-label="`Remover filtro de ${columnLabel(filter.column)}`"
                @click="onRemove(index)"
              >
                ×
              </button>
            </div>

            <Select
              class="filter-card__field"
              :model-value="String(filter.column)"
              :options="columnOptions"
              aria-label="Coluna do filtro"
              @update:model-value="onColumnChange(index, $event)"
            />

            <Select
              class="filter-card__field"
              :model-value="filter.operator"
              :options="operatorOptionsFor(filter)"
              aria-label="Operador do filtro"
              @update:model-value="onOperatorChange(index, $event)"
            />

            <div v-if="isRangeOperator(filter.operator)" class="filter-card__range">
              <input
                class="filter-card__input"
                :value="rangeValue(filter).from"
                type="text"
                aria-label="Valor inicial"
                @input="onRangeChange(index, 'from', $event)"
              >
              <input
                class="filter-card__input"
                :value="rangeValue(filter).to"
                type="text"
                aria-label="Valor final"
                @input="onRangeChange(index, 'to', $event)"
              >
            </div>
            <input
              v-else-if="!isValuelessOperator(filter.operator)"
              class="filter-card__input filter-card__input--full"
              :value="scalarValue(filter)"
              type="text"
              aria-label="Valor do filtro"
              @input="onValueChange(index, $event)"
            >
          </div>
        </template>

        <button type="button" class="filter-overlay__add" @click="onAdd">
          + Adicionar filtro
        </button>
      </div>

      <footer class="filter-overlay__footer">
        <button
          type="button"
          class="filter-overlay__clear"
          :disabled="draftFilters.length === 0"
          @click="onClear"
        >
          Limpar
        </button>
        <button type="button" class="filter-overlay__apply" @click="onApply">
          Filtrar
        </button>
      </footer>
    </aside>
  </div>
</template>

<style scoped>
/* Drawer fixo cobrindo o viewport (independe do `overflow: hidden` do
   `.viewer`, já que `position: fixed` ancora no viewport, não no ancestral —
   nenhum ancestral define transform/filter/contain que criasse um novo
   containing block). */
.filter-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  justify-content: flex-end;
  background: rgba(0, 0, 0, 0.5);
}

.filter-overlay__panel {
  display: flex;
  flex-direction: column;
  width: 400px;
  max-width: 90vw;
  height: 100%;
  background: var(--bg-1);
  border-left: 1px solid var(--border);
  box-shadow: var(--shadow);
  outline: none;
}

.filter-overlay__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--border);
}

.filter-overlay__title {
  margin: 0;
  font-family: var(--font);
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.filter-overlay__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-3);
}

.filter-overlay__close {
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

.filter-overlay__close:hover {
  color: var(--accent);
  background: var(--accent-soft);
}

.filter-overlay__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
}

.filter-overlay__empty {
  margin: 0;
  padding: 12px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-3);
}

.filter-overlay__joiner {
  align-self: center;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3);
}

.filter-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.filter-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.filter-card__eyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3);
}

.filter-card__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--text-3);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.filter-card__remove:hover {
  color: var(--error);
  background: var(--error-soft);
}

.filter-card__range {
  display: flex;
  gap: 8px;
}

.filter-card__input {
  height: 36px;
  min-width: 0;
  padding: 0 12px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
}

.filter-card__range .filter-card__input {
  flex: 1;
}

.filter-card__input:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--bg-1);
}

.filter-overlay__add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  background: none;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius);
  color: var(--text-2);
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.filter-overlay__add:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-soft);
}

.filter-overlay__footer {
  display: flex;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
}

.filter-overlay__clear,
.filter-overlay__apply {
  flex: 1;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.filter-overlay__clear {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-2);
}

.filter-overlay__clear:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.filter-overlay__clear:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.filter-overlay__apply {
  background: var(--accent);
  border: 1px solid var(--accent);
  color: var(--accent-fg);
}

.filter-overlay__apply:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}
</style>
