/**
 * Predicado puro de filtros por coluna do CSV View.
 *
 * Opera sobre células já parseadas (strings) e o tipo inferido por coluna
 * (`ColumnType`, `columnStats.ts`): dado um conjunto de `ColumnFilter`, decide
 * se uma linha satisfaz todos eles (AND). Sem I/O, sem estado, determinístico.
 *
 * Referência: `.spec/features/filters/SPEC.md`; `.spec/features/filters/PLAN.md`
 * (T01); RF-01, RF-02, RF-03, CT-01, RNF-02.
 */

import {
  isBooleanValue,
  isDateValue,
  isEmptyCell,
  parseDate,
  parseNumber,
  type ColumnType,
} from '~/services/columnStats'

/** Operadores suportados por um filtro de coluna (rótulos pt-BR resolvidos na UI). */
export type FilterOperator =
  | 'igual'
  | 'diferente'
  | 'contem'
  | 'naoContem'
  | 'maiorQue'
  | 'menorQue'
  | 'entre'
  | 'intervaloDatas'
  | 'vazio'
  | 'preenchido'
  | 'verdadeiro'
  | 'falso'

/** Par de limites inclusivos usado por `entre` e `intervaloDatas`. */
export interface FilterRange {
  from: string | number
  to: string | number
}

/**
 * Um filtro de coluna (CT-01): referencia a coluna por índice, carregando o
 * operador e o(s) valor(es). Qualquer coluna pode ser alvo, inclusive ocultas
 * — a visibilidade não restringe a filtragem.
 */
export interface ColumnFilter {
  column: number
  operator: FilterOperator
  value?: string | number | FilterRange
}

/** Família de tipo que enquadra os operadores disponíveis (RF-01). */
export type TypeFamily = 'texto' | 'numero' | 'data' | 'booleano'

/**
 * Mapeia o tipo inferido de uma coluna (`columnStats.ts`) para a família que
 * enquadra os operadores oferecidos. `text`/`email`/`url` degradam para
 * `texto`; sem `boolean` em `ColumnType`, a família `booleano` nunca é
 * produzida (degradação graciosa quando `rich-types-and-stats` não existe).
 */
export function typeFamily(type: ColumnType): TypeFamily {
  if (type === 'number') return 'numero'
  if (type === 'date') return 'data'
  if (type === 'boolean') return 'booleano'
  return 'texto'
}

const OPERATORS_BY_FAMILY: Record<TypeFamily, FilterOperator[]> = {
  texto: ['igual', 'diferente', 'contem', 'naoContem', 'vazio', 'preenchido'],
  numero: [
    'igual',
    'diferente',
    'maiorQue',
    'menorQue',
    'entre',
    'vazio',
    'preenchido',
  ],
  data: ['igual', 'diferente', 'intervaloDatas', 'vazio', 'preenchido'],
  booleano: ['verdadeiro', 'falso', 'vazio', 'preenchido'],
}

/** Lista os operadores disponíveis para uma família de tipo (RF-01). */
export function operatorsForFamily(family: TypeFamily): FilterOperator[] {
  return OPERATORS_BY_FAMILY[family]
}

// Operadores que não exigem valor: nunca são inertes (RF-05).
const VALUELESS_OPERATORS: ReadonlySet<FilterOperator> = new Set([
  'vazio',
  'preenchido',
  'verdadeiro',
  'falso',
])

function isRange(value: unknown): value is FilterRange {
  return (
    typeof value === 'object' &&
    value !== null &&
    'from' in value &&
    'to' in value
  )
}

/**
 * Um filtro é inerte (RF-05) quando o operador exige valor e ele está
 * ausente/vazio: `entre`/`intervaloDatas` exigem `from` e `to` preenchidos;
 * os demais operadores com valor exigem um valor não vazio. Operadores sem
 * valor (`vazio`/`preenchido`/`verdadeiro`/`falso`) nunca são inertes.
 */
export function isFilterInert(filter: ColumnFilter): boolean {
  if (VALUELESS_OPERATORS.has(filter.operator)) return false

  if (filter.operator === 'entre' || filter.operator === 'intervaloDatas') {
    if (!isRange(filter.value)) return true
    return isEmptyCell(String(filter.value.from)) || isEmptyCell(String(filter.value.to))
  }

  return isEmptyCell(
    filter.value === undefined || filter.value === null
      ? undefined
      : String(filter.value),
  )
}

// Normalização local de data DMY (`dd/mm/aaaa`) + ISO (`aaaa-mm-dd`),
// alinhada a `parseDate`/`isDateValue` de `columnStats.ts`.
function normalizeDate(value: string | number): number | null {
  const text = String(value).trim()
  if (!isDateValue(text)) return null
  return parseDate(text)
}

function valuesEqualText(cell: string, target: string): boolean {
  return cell.trim().toLowerCase() === String(target).trim().toLowerCase()
}

function cellContains(cell: string, target: string): boolean {
  return cell.toLowerCase().includes(String(target).toLowerCase())
}

function evaluateOperator(
  operator: FilterOperator,
  cell: string,
  value: ColumnFilter['value'],
  family: TypeFamily,
): boolean {
  switch (operator) {
    case 'vazio':
      return isEmptyCell(cell)
    case 'preenchido':
      return !isEmptyCell(cell)
    case 'verdadeiro':
      return isBooleanValue(cell) && TRUE_TOKENS.has(cell.trim().toLowerCase())
    case 'falso':
      return isBooleanValue(cell) && FALSE_TOKENS.has(cell.trim().toLowerCase())
    case 'igual': {
      if (isEmptyCell(cell)) return false
      if (family === 'numero') {
        const cellNumber = parseNumber(cell)
        const targetNumber = parseNumber(String(value))
        return cellNumber !== null && targetNumber !== null && cellNumber === targetNumber
      }
      return valuesEqualText(cell, String(value))
    }
    case 'diferente': {
      if (isEmptyCell(cell)) return true
      if (family === 'numero') {
        const cellNumber = parseNumber(cell)
        const targetNumber = parseNumber(String(value))
        return !(cellNumber !== null && targetNumber !== null && cellNumber === targetNumber)
      }
      return !valuesEqualText(cell, String(value))
    }
    case 'contem':
      return !isEmptyCell(cell) && cellContains(cell, String(value))
    case 'naoContem':
      return isEmptyCell(cell) || !cellContains(cell, String(value))
    case 'maiorQue': {
      const cellNumber = parseNumber(cell)
      const targetNumber = parseNumber(String(value))
      return cellNumber !== null && targetNumber !== null && cellNumber > targetNumber
    }
    case 'menorQue': {
      const cellNumber = parseNumber(cell)
      const targetNumber = parseNumber(String(value))
      return cellNumber !== null && targetNumber !== null && cellNumber < targetNumber
    }
    case 'entre': {
      if (!isRange(value)) return false
      const cellNumber = parseNumber(cell)
      const from = parseNumber(String(value.from))
      const to = parseNumber(String(value.to))
      return (
        cellNumber !== null &&
        from !== null &&
        to !== null &&
        cellNumber >= from &&
        cellNumber <= to
      )
    }
    case 'intervaloDatas': {
      if (!isRange(value)) return false
      const cellDate = normalizeDate(cell)
      const from = normalizeDate(value.from)
      const to = normalizeDate(value.to)
      return (
        cellDate !== null &&
        from !== null &&
        to !== null &&
        cellDate >= from &&
        cellDate <= to
      )
    }
    default:
      return false
  }
}

// Tokens booleanos reconhecidos por `isBooleanValue` (`columnStats.ts`),
// particionados aqui apenas para resolver `verdadeiro`/`falso` sem redefinir
// o reconhecedor: consomem `isBooleanValue`, não reimplementam a allowlist.
const TRUE_TOKENS: ReadonlySet<string> = new Set(['true', 'sim', 'yes'])
const FALSE_TOKENS: ReadonlySet<string> = new Set(['false', 'não', 'no'])

/**
 * Avalia um único filtro contra uma célula (RF-02). Filtros inertes (RF-05)
 * devem ser filtrados por `matchesFilters` antes de chegar aqui.
 */
function matchesFilter(
  filter: ColumnFilter,
  cell: string,
  type: ColumnType,
): boolean {
  return evaluateOperator(filter.operator, cell, filter.value, typeFamily(type))
}

/**
 * Decide se uma linha satisfaz todos os filtros ativos (AND, RF-03). Filtros
 * inertes (RF-05) são ignorados — não restringem nenhuma linha. Puro e
 * determinístico (RNF-02): não faz I/O e não recalcula `columnTypes`.
 */
export function matchesFilters(
  filters: ColumnFilter[],
  row: string[],
  columnTypes: ColumnType[],
): boolean {
  for (const filter of filters) {
    if (isFilterInert(filter)) continue
    const cell = filter.column < row.length ? row[filter.column]! : ''
    const type = columnTypes[filter.column] ?? 'text'
    if (!matchesFilter(filter, cell, type)) return false
  }
  return true
}
