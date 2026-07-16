/**
 * Rótulos e helpers de apresentação para `ColumnFilter` (UI, pt-BR).
 *
 * Compartilhado pelo editor de filtros (`FilterPanel.vue`) e pelos badges de
 * filtros aplicados (`FilterChips.vue`) para não duplicar o mapa de rótulos
 * nem a lógica de operador sem valor / de intervalo entre os dois.
 */

import type { ColumnFilter, FilterOperator, FilterRange } from '~/services/columnFilters'

/** Rótulos pt-BR dos operadores (RF-01/RF-02). */
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
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

export function isValuelessOperator(operator: FilterOperator): boolean {
  return VALUELESS_OPERATORS.has(operator)
}

export function isRangeOperator(operator: FilterOperator): boolean {
  return RANGE_OPERATORS.has(operator)
}

export function isRangeValue(value: ColumnFilter['value']): value is FilterRange {
  return typeof value === 'object' && value !== null && 'from' in value && 'to' in value
}

/** Valor inicial coerente com o operador — inerte (sem valor) até o usuário preencher. */
export function defaultFilterValue(operator: FilterOperator): ColumnFilter['value'] {
  if (isValuelessOperator(operator)) return undefined
  if (isRangeOperator(operator)) return { from: '', to: '' }
  return ''
}

/** Valor legível de um filtro; vazio para operadores sem valor. */
function filterValueLabel(filter: ColumnFilter): string {
  if (isValuelessOperator(filter.operator)) return ''
  if (isRangeOperator(filter.operator)) {
    if (!isRangeValue(filter.value)) return ''
    return `${filter.value.from} e ${filter.value.to}`
  }
  return filter.value === undefined || filter.value === null ? '' : String(filter.value)
}

/** Rótulo legível de um filtro: `<coluna> <operador> <valor>` (UI-01). */
export function filterLabel(filter: ColumnFilter, columnLabel: string): string {
  const parts = [columnLabel, OPERATOR_LABELS[filter.operator]]
  const value = filterValueLabel(filter)
  if (value !== '') parts.push(value)
  return parts.join(' ')
}
