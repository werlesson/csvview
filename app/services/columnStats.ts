/**
 * Motor de inferência de tipo e estatísticas por coluna do CSV View.
 *
 * Opera sobre o dataset já parseado (Fase 4): recebe os valores de uma coluna
 * (sempre strings, como o parser devolve) e produz o tipo inferido
 * (`number` | `date` | `text`), as métricas gerais (nulos, únicos, duplicados,
 * preenchido) e — apenas para colunas numéricas — as métricas de mínimo,
 * máximo, média e a distribuição em histograma.
 *
 * Toda a lógica é pura e client-side: nenhum dado sai da máquina (US-3.1).
 *
 * Referência: `.spec/init/project-phases.md` (Fase 5); US-3.1.
 */

/** Tipo inferido de uma coluna. Espelha os rótulos exibidos no painel de stats. */
export type ColumnType = 'number' | 'date' | 'text'

/** Um bin (faixa) do histograma de distribuição de uma coluna numérica. */
export interface HistogramBin {
  /** Limite inferior da faixa (inclusivo). */
  start: number
  /** Limite superior da faixa (inclusivo no último bin, exclusivo nos demais). */
  end: number
  /** Nº de valores numéricos não-nulos que caem nesta faixa. */
  count: number
}

/** Métricas exclusivas de colunas do tipo `number`. */
export interface NumericStats {
  /** Menor valor não-nulo. */
  min: number
  /** Maior valor não-nulo. */
  max: number
  /** Média aritmética dos valores não-nulos. */
  mean: number
  /** Distribuição em bins; a soma dos `count` é o total de valores não-nulos. */
  histogram: HistogramBin[]
}

/** Estatísticas completas de uma coluna. */
export interface ColumnStats {
  /** Tipo inferido: `number` | `date` | `text`. */
  type: ColumnType
  /** Nº de células vazias (`null`/`undefined`/`''`). */
  nulls: number
  /** Nº de células preenchidas (não vazias). */
  filled: number
  /** Nº de valores distintos entre as células preenchidas. */
  unique: number
  /** Nº de células preenchidas que repetem um valor já visto (`filled - unique`). */
  duplicates: number
  /** Métricas numéricas; presente somente quando `type === 'number'`. */
  numeric?: NumericStats
}

/** Uma célula não parseada, como chega do dataset. */
type Cell = string | null | undefined

/**
 * Regra de célula vazia, consistente com `CsvCell`: `null`, `undefined` ou
 * string vazia (após aparar espaços) contam como nulo (US-3.1).
 */
export function isEmptyCell(value: Cell): boolean {
  return value === null || value === undefined || String(value).trim() === ''
}

// Número "simples": sinal opcional, dígitos com casa decimal e/ou expoente.
// Rejeita hexadecimais, `Infinity`, `NaN` e separadores de milhar.
const NUMBER_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/

/**
 * Converte uma célula para número, ou `null` se não for um número reconhecível.
 * Células vazias retornam `null`.
 */
export function parseNumber(value: Cell): number | null {
  if (isEmptyCell(value)) return null
  const text = String(value).trim()
  if (!NUMBER_RE.test(text)) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

// `YYYY-MM-DD`, `YYYY/MM/DD`, `YYYY.MM.DD`, com hora opcional (ISO).
const DATE_ISO_RE =
  /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/
// `DD/MM/YYYY`, `MM/DD/YYYY` e variantes com `-` ou `.`.
const DATE_DMY_RE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/

/** Um par de inteiros forma um (dia, mês) plausível em alguma das duas ordens. */
function isDayMonthPair(a: number, b: number): boolean {
  const asDayMonth = a >= 1 && a <= 31 && b >= 1 && b <= 12
  const asMonthDay = a >= 1 && a <= 12 && b >= 1 && b <= 31
  return asDayMonth || asMonthDay
}

/**
 * Reconhece uma data em formatos comuns (ISO `YYYY-MM-DD`, `DD/MM/YYYY` etc.),
 * validando as faixas de mês/dia. Determinístico e independente de locale.
 */
export function isDateValue(value: Cell): boolean {
  if (isEmptyCell(value)) return false
  const text = String(value).trim()

  const iso = DATE_ISO_RE.exec(text)
  if (iso) {
    const month = Number(iso[2])
    const day = Number(iso[3])
    return month >= 1 && month <= 12 && day >= 1 && day <= 31
  }

  const dmy = DATE_DMY_RE.exec(text)
  if (dmy) {
    return isDayMonthPair(Number(dmy[1]), Number(dmy[2]))
  }

  return false
}

/**
 * Infere o tipo dominante de uma coluna a partir das células não vazias
 * (as vazias são ignoradas e não invalidam a inferência):
 * - toda célula preenchida é número → `number`;
 * - senão, toda célula preenchida é data → `date`;
 * - caso contrário → `text`.
 * Uma coluna sem nenhuma célula preenchida é `text`.
 */
export function inferColumnType(values: readonly Cell[]): ColumnType {
  let hasFilled = false
  let allNumbers = true
  let allDates = true

  for (const value of values) {
    if (isEmptyCell(value)) continue
    hasFilled = true
    if (parseNumber(value) === null) allNumbers = false
    if (!isDateValue(value)) allDates = false
    if (!allNumbers && !allDates) break
  }

  if (!hasFilled) return 'text'
  if (allNumbers) return 'number'
  if (allDates) return 'date'
  return 'text'
}

/**
 * Nº de bins do histograma pela regra de Sturges (`ceil(log2(n)) + 1`),
 * determinístico para um mesmo tamanho de amostra e com mínimo de 1.
 */
export function histogramBinCount(sampleSize: number): number {
  if (sampleSize <= 1) return 1
  return Math.max(1, Math.ceil(Math.log2(sampleSize)) + 1)
}

/**
 * Constrói o histograma de distribuição para uma lista de valores numéricos.
 * A soma dos `count` é sempre igual a `values.length`. Quando todos os valores
 * são iguais, retorna um único bin.
 */
export function buildHistogram(values: readonly number[]): HistogramBin[] {
  const n = values.length
  if (n === 0) return []

  let min = values[0]!
  let max = values[0]!
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }

  if (min === max) {
    return [{ start: min, end: max, count: n }]
  }

  const binCount = histogramBinCount(n)
  const width = (max - min) / binCount
  const bins: HistogramBin[] = []
  for (let i = 0; i < binCount; i += 1) {
    bins.push({
      start: min + i * width,
      end: i === binCount - 1 ? max : min + (i + 1) * width,
      count: 0,
    })
  }

  for (const v of values) {
    let index = Math.floor((v - min) / width)
    if (index >= binCount) index = binCount - 1 // o valor máximo cai no último bin
    if (index < 0) index = 0
    bins[index]!.count += 1
  }

  return bins
}

/** Calcula min/max/média e o histograma de uma lista de valores numéricos. */
function computeNumericStats(values: number[]): NumericStats {
  let min = values[0]!
  let max = values[0]!
  let sum = 0
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }
  return {
    min,
    max,
    mean: sum / values.length,
    histogram: buildHistogram(values),
  }
}

/**
 * Calcula as estatísticas completas de uma coluna a partir dos seus valores
 * brutos (strings). Métricas numéricas só são calculadas quando o tipo
 * inferido é `number`; para os demais tipos, `numeric` fica ausente.
 */
export function computeColumnStats(values: readonly Cell[]): ColumnStats {
  const type = inferColumnType(values)

  let nulls = 0
  const seen = new Set<string>()
  const numbers: number[] = []

  for (const value of values) {
    if (isEmptyCell(value)) {
      nulls += 1
      continue
    }
    seen.add(String(value))
    if (type === 'number') {
      const n = parseNumber(value)
      if (n !== null) numbers.push(n)
    }
  }

  const filled = values.length - nulls
  const unique = seen.size

  const stats: ColumnStats = {
    type,
    nulls,
    filled,
    unique,
    duplicates: filled - unique,
  }

  if (type === 'number' && numbers.length > 0) {
    stats.numeric = computeNumericStats(numbers)
  }

  return stats
}

/** Dataset mínimo necessário para o cálculo por coluna. */
export interface StatsDataset {
  header: string[]
  rows: Cell[][]
}

/**
 * Extrai os valores de uma coluna (por índice) das linhas do dataset,
 * preenchendo com vazio as linhas mais curtas que o índice pedido.
 */
export function columnValues(rows: readonly Cell[][], index: number): Cell[] {
  return rows.map((row) => (index < row.length ? row[index] : ''))
}

/**
 * Calcula as estatísticas de todas as colunas do dataset, na ordem do
 * cabeçalho. Conveniência para o painel de estatísticas (Fase 8).
 */
export function computeDatasetStats(dataset: StatsDataset): ColumnStats[] {
  return dataset.header.map((_, index) =>
    computeColumnStats(columnValues(dataset.rows, index)),
  )
}
