/**
 * Motor de inferência de tipo e estatísticas por coluna do CSV View.
 *
 * Opera sobre o dataset já parseado (Fase 4): recebe os valores de uma coluna
 * (sempre strings, como o parser devolve) e produz o tipo inferido
 * (`number` | `date` | `boolean` | `email` | `url` | `text`), as métricas
 * gerais (nulos, únicos, duplicados, preenchido) e — apenas para colunas
 * numéricas — as métricas de mínimo, máximo, média, soma, mediana, a
 * distinção inteiro/decimal (`numericKind`) e a distribuição em histograma.
 *
 * Toda a lógica é pura e client-side: nenhum dado sai da máquina (US-3.1).
 *
 * Referência: `.spec/init/project-phases.md` (Fase 5); US-3.1.
 */

/**
 * Tipo inferido de uma coluna. Espelha os rótulos exibidos no painel de stats.
 *
 * Inteiro e decimal NÃO são membros deste tipo: colunas numéricas permanecem
 * `'number'` e a distinção inteiro/decimal vive em `NumericStats.numericKind`.
 */
export type ColumnType = 'number' | 'date' | 'boolean' | 'email' | 'url' | 'text'

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
  /** Soma de todos os valores não-nulos. */
  sum: number
  /**
   * Mediana dos valores não-nulos: valor central da lista ordenada; média dos
   * dois centrais quando a contagem é par.
   */
  median: number
  /**
   * Distinção inteiro/decimal derivada do valor numérico (`Number.isInteger`):
   * `'integer'` quando todos os valores são inteiros; `'decimal'` quando ao
   * menos um não é. Não altera `ColumnType`, que permanece `'number'`.
   */
  numericKind: 'integer' | 'decimal'
  /** Distribuição em bins; a soma dos `count` é o total de valores não-nulos. */
  histogram: HistogramBin[]
}

/** Estatísticas completas de uma coluna. */
export interface ColumnStats {
  /** Tipo inferido: `number` | `date` | `boolean` | `email` | `url` | `text`. */
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

// Tokens booleanos reconhecidos (case-insensitive). `0`/`1` NÃO são booleano:
// permanecem número, que precede booleano na ordem de inferência.
const BOOLEAN_TOKENS: ReadonlySet<string> = new Set([
  'true',
  'false',
  'sim',
  'não',
  'yes',
  'no',
])

// E-mail conservador: um `@`, um `.` no domínio, sem espaços em nenhum lado.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// URL: apenas os esquemas `http://` e `https://`.
const URL_RE = /^https?:\/\/\S+$/i

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
 * Converte uma célula-data em um valor numérico comparável (timestamp UTC em
 * milissegundos), ou `null` para célula vazia ou não reconhecida como data.
 *
 * Reusa os mesmos regexes de `isDateValue`: o formato ISO (`DATE_ISO_RE`) é
 * interpretado como ano/mês/dia; o ramo ambíguo `DD..MM..YYYY` (`DATE_DMY_RE`)
 * assume sempre a convenção pt-BR **dia/mês/ano (DMY)** para a coluna inteira,
 * sem detecção de ordem dominante (RF-03). A hora eventual do ISO é ignorada:
 * a comparação é por data. Determinístico e independente de locale.
 */
export function parseDate(value: Cell): number | null {
  if (isEmptyCell(value)) return null
  const text = String(value).trim()

  const iso = DATE_ISO_RE.exec(text)
  if (iso) {
    const year = Number(iso[1])
    const month = Number(iso[2])
    const day = Number(iso[3])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return Date.UTC(year, month - 1, day)
  }

  const dmy = DATE_DMY_RE.exec(text)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    const year = Number(dmy[3])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return Date.UTC(year, month - 1, day)
  }

  return null
}

/**
 * Reconhece um valor booleano por token da allowlist case-insensitive
 * `{ true, false, sim, não, yes, no }`. `0`/`1` NÃO são booleano — permanecem
 * número (número precede booleano na inferência). Determinístico, sem locale.
 */
export function isBooleanValue(value: Cell): boolean {
  if (isEmptyCell(value)) return false
  return BOOLEAN_TOKENS.has(String(value).trim().toLowerCase())
}

/**
 * Reconhece um e-mail de forma conservadora (`^[^@\s]+@[^@\s]+\.[^@\s]+$`):
 * exige exatamente um `@` cercado por partes sem espaço e um `.` no domínio.
 */
export function isEmailValue(value: Cell): boolean {
  if (isEmptyCell(value)) return false
  return EMAIL_RE.test(String(value).trim())
}

/**
 * Reconhece uma URL apenas quando o esquema é `http://` ou `https://`.
 * Outros esquemas (ex.: `ftp://`, `mailto:`) são rejeitados.
 */
export function isUrlValue(value: Cell): boolean {
  if (isEmptyCell(value)) return false
  return URL_RE.test(String(value).trim())
}

/**
 * Compara duas células já reconhecidas como preenchidas segundo o tipo
 * inferido da coluna, retornando `-1`/`0`/`1` em ordem ascendente:
 * `number` por valor numérico (`parseNumber`), `date` cronologicamente
 * (`parseDate`, T01) e `text` lexicograficamente (`localeCompare`). Quando um
 * valor não converte no ramo numérico/data (não deveria ocorrer numa coluna do
 * tipo, mas é possível em dados sujos), o ramo recai em comparação textual
 * determinística, mantendo o comparador total e estável.
 */
function compareFilled(type: ColumnType, a: string, b: string): number {
  if (type === 'number') {
    const na = parseNumber(a)
    const nb = parseNumber(b)
    if (na !== null && nb !== null) {
      return na < nb ? -1 : na > nb ? 1 : 0
    }
  } else if (type === 'date') {
    const da = parseDate(a)
    const db = parseDate(b)
    if (da !== null && db !== null) {
      return da < db ? -1 : da > db ? 1 : 0
    }
  }
  return a.localeCompare(b)
}

/**
 * Constrói um comparador PURO para ordenar células de uma coluna respeitando o
 * seu tipo inferido (RF-03). Regras:
 *
 * - Células vazias (`isEmptyCell`: `null`/`undefined`/`''` após aparar) ficam
 *   SEMPRE ao final, independentemente da direção `asc`/`desc` — a direção só
 *   inverte a ordem entre as células preenchidas, nunca empurra vazios ao topo.
 * - `number` compara por valor numérico (`2 < 10 < 100`, não como texto);
 *   `date` cronologicamente (`parseDate`, DMY para ambíguos); `text` por
 *   `localeCompare`.
 * - Empates retornam `0`: a estabilidade do `Array.prototype.sort` do V8
 *   preserva a ordem original, viabilizando a ordenação multi-chave incremental.
 */
export function makeComparator(
  type: ColumnType,
  direction: 'asc' | 'desc',
): (a: Cell, b: Cell) => number {
  const sign = direction === 'desc' ? -1 : 1

  return (a, b) => {
    const aEmpty = isEmptyCell(a)
    const bEmpty = isEmptyCell(b)
    if (aEmpty || bEmpty) {
      if (aEmpty && bEmpty) return 0
      return aEmpty ? 1 : -1 // vazios ao fim em qualquer direção
    }
    return sign * compareFilled(type, String(a).trim(), String(b).trim())
  }
}

/**
 * Ponto único de decisão inteiro/decimal, compartilhado entre inferência e
 * métricas: `'decimal'` se algum valor não for inteiro (`Number.isInteger`),
 * caso contrário `'integer'`. A distinção é pelo valor numérico, não pelo
 * texto: `1.0`, `5.00` e `2e3` são inteiros.
 */
export function numericKindOf(
  numbers: readonly number[],
): 'integer' | 'decimal' {
  return numbers.some((n) => !Number.isInteger(n)) ? 'decimal' : 'integer'
}

/**
 * Infere o tipo dominante de uma coluna a partir das células não vazias
 * (as vazias são ignoradas via `isEmptyCell` e não invalidam a inferência).
 *
 * A avaliação é **por coluna**, em uma única passagem O(N): a coluna assume o
 * primeiro tipo cujo conjunto completo de células preenchidas é satisfeito, na
 * ordem de precedência determinística:
 *
 *   número → data → booleano → e-mail → URL → texto (fallback terminal)
 *
 * Assim, quando todas as células satisfazem mais de um tipo, vence sempre o
 * primeiro da sequência (ex.: `0`/`1` → número, não booleano). Inteiro/decimal
 * NÃO são retornados aqui: colunas numéricas são `'number'` e a distinção vive
 * em `NumericStats.numericKind`. Uma coluna sem célula preenchida é `text`.
 */
export function inferColumnType(values: readonly Cell[]): ColumnType {
  let hasFilled = false
  let allNumbers = true
  let allDates = true
  let allBooleans = true
  let allEmails = true
  let allUrls = true

  for (const value of values) {
    if (isEmptyCell(value)) continue
    hasFilled = true
    if (allNumbers && parseNumber(value) === null) allNumbers = false
    if (allDates && !isDateValue(value)) allDates = false
    if (allBooleans && !isBooleanValue(value)) allBooleans = false
    if (allEmails && !isEmailValue(value)) allEmails = false
    if (allUrls && !isUrlValue(value)) allUrls = false
    if (!allNumbers && !allDates && !allBooleans && !allEmails && !allUrls) {
      break
    }
  }

  if (!hasFilled) return 'text'
  if (allNumbers) return 'number'
  if (allDates) return 'date'
  if (allBooleans) return 'boolean'
  if (allEmails) return 'email'
  if (allUrls) return 'url'
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

/**
 * Calcula min/max/média/soma/mediana, a distinção inteiro/decimal
 * (`numericKind`) e o histograma de uma lista de valores numéricos.
 *
 * A mediana é a única operação super-linear introduzida: ordena uma cópia dos
 * valores (O(N log N)) e toma o valor central (média dos dois centrais quando
 * a contagem é par). As demais métricas continuam em uma passagem O(N).
 */
function computeNumericStats(values: number[]): NumericStats {
  let min = values[0]!
  let max = values[0]!
  let sum = 0
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }

  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1]! + sorted[mid]!) / 2
      : sorted[mid]!

  return {
    min,
    max,
    mean: sum / values.length,
    sum,
    median,
    numericKind: numericKindOf(values),
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

/**
 * Mapeia, para uma coluna, cada valor preenchido (após `trim`) → nº de
 * ocorrências entre as células preenchidas. Uma única passagem O(N), pulando
 * células vazias (`isEmptyCell`, mesma convenção de `computeColumnStats`) —
 * sem comparação par a par (RNF-02). Distinto do agregado
 * `ColumnStats.duplicates` (`filled - unique`): aqui é possível saber o N
 * específico de cada valor, necessário para o badge "dup ×N" (RF-02).
 */
export function computeColumnDuplicateCounts(
  values: readonly Cell[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (isEmptyCell(value)) continue
    const key = String(value).trim()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/**
 * Verifica se uma linha contém ao menos uma célula cujo valor está duplicado
 * na sua coluna, segundo os mapas já calculados por
 * `computeColumnDuplicateCounts` (um por coluna, na mesma ordem de `row`).
 * O(colunas): itera apenas as colunas da linha, sem varrer o dataset (RF-03).
 */
export function rowHasDuplicateValue(
  row: readonly Cell[],
  duplicateCounts: readonly Map<string, number>[],
): boolean {
  for (let i = 0; i < row.length; i += 1) {
    const value = row[i]
    if (isEmptyCell(value)) continue
    const count = duplicateCounts[i]?.get(String(value).trim())
    if (count !== undefined && count > 1) return true
  }
  return false
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
