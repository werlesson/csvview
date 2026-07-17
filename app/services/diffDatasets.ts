/**
 * Motor de diff puro entre dois datasets CSV/TSV (feature `file-comparison`,
 * Fase 1, T01).
 *
 * Pareia os registros de dois datasets (A e B) por coluna-chave comum
 * (`pairByKey`, RF-04) ou, na ausência de uma, por posição (`pairByPosition`,
 * RF-05); classifica cada par em `added` | `removed` | `changed` | `unchanged`
 * (RF-03); e, para os pares presentes nos dois lados, marca quais colunas
 * comuns divergem, usando equivalência por tipo inferido (RF-06) — reusa
 * `parseNumber`/`parseDate`/`inferColumnType` de `columnStats.ts`.
 *
 * Framework-free, client-side (`app/services/` — `AGENTS.md`, seção 2).
 */

import { type ColumnType, inferColumnType, parseDate, parseNumber } from './columnStats'

/** Dataset mínimo necessário para o diff: cabeçalho + linhas de dados. */
export interface DiffDataset {
  header: string[]
  rows: string[][]
}

/** Classificação de um registro pareado, exatamente uma por registro (RF-03). */
export type RecordStatus = 'added' | 'removed' | 'changed' | 'unchanged'

/**
 * Resultado de um pareamento (RF-04/RF-05): o índice de linha em cada
 * dataset, ou `null` quando o registro existe somente do outro lado.
 */
export interface PairedIndex {
  indexA: number | null
  indexB: number | null
}

/** Uma coluna comum aos dois cabeçalhos, com seu índice em cada dataset. */
export interface CommonColumn {
  name: string
  indexA: number
  indexB: number
}

/** Um registro já classificado, pronto para exibição (CT-01). */
export interface ComparisonRecord {
  status: RecordStatus
  indexA: number | null
  indexB: number | null
  rowA: string[] | null
  rowB: string[] | null
  /** Nomes das colunas comuns cujo valor diverge entre A e B (RF-06, UI-02); vazio fora de `changed`. */
  diffColumns: string[]
}

/** Contagens agregadas por categoria (UI-03). A soma é sempre igual ao nº de registros pareados (RF-03 AC). */
export interface ComparisonCounts {
  added: number
  removed: number
  changed: number
  unchanged: number
}

/** Resultado completo de `diffDatasets` (CT-01). */
export interface ComparisonResult {
  /** Nomes das colunas comuns aos dois datasets, na ordem do cabeçalho de A. */
  commonColumns: string[]
  records: ComparisonRecord[]
  counts: ComparisonCounts
}

/**
 * Nomes de coluna presentes em ambos os cabeçalhos, na ordem de `headerA`
 * (CT-02: base para o seletor de coluna-chave). Cabeçalhos sem interseção
 * retornam uma lista vazia — pareamento cai para `pairByPosition` (RF-05).
 */
export function commonKeyColumns(headerA: string[], headerB: string[]): string[] {
  const setB = new Set(headerB)
  return headerA.filter((name) => setB.has(name))
}

/**
 * Pareia os registros de A e B pela coluna-chave informada (RF-04): constrói,
 * para cada dataset, um `Map` de valor bruto da coluna-chave → nº da linha, e
 * casa os registros cujas chaves coincidem entre os dois mapas. Uma chave
 * presente em apenas um dos mapas vira um registro `added`/`removed` (nunca
 * pareado com outro registro).
 *
 * Chave duplicada dentro do mesmo dataset: como o `Map` é construído com
 * `Map.set` em ordem de linha, a **última ocorrência** daquela chave é a que
 * fica no mapa e participa do pareamento (comportamento documentado, decisão
 * de implementação — `PLAN.md`, T01).
 *
 * `keyColumn` ausente em algum dos cabeçalhos cai para `pairByPosition`
 * (RF-05).
 */
export function pairByKey(
  datasetA: DiffDataset,
  datasetB: DiffDataset,
  keyColumn: string,
): PairedIndex[] {
  const columnIndexA = datasetA.header.indexOf(keyColumn)
  const columnIndexB = datasetB.header.indexOf(keyColumn)
  if (columnIndexA === -1 || columnIndexB === -1) {
    return pairByPosition(datasetA, datasetB)
  }

  const mapA = new Map<string, number>()
  datasetA.rows.forEach((row, index) => mapA.set(row[columnIndexA] ?? '', index))
  const mapB = new Map<string, number>()
  datasetB.rows.forEach((row, index) => mapB.set(row[columnIndexB] ?? '', index))

  const pairs: PairedIndex[] = []
  for (const [key, indexA] of mapA) {
    const indexB = mapB.has(key) ? mapB.get(key)! : null
    pairs.push({ indexA, indexB })
  }
  for (const [key, indexB] of mapB) {
    if (mapA.has(key)) continue
    pairs.push({ indexA: null, indexB })
  }

  return pairs
}

/**
 * Pareia os registros de A e B pela posição (índice de linha, RF-05): a
 * linha N de A casa com a linha N de B. Um índice fora do intervalo de um dos
 * lados vira um registro `added` (só em B) ou `removed` (só em A).
 */
export function pairByPosition(datasetA: DiffDataset, datasetB: DiffDataset): PairedIndex[] {
  const total = Math.max(datasetA.rows.length, datasetB.rows.length)
  const pairs: PairedIndex[] = []
  for (let index = 0; index < total; index += 1) {
    pairs.push({
      indexA: index < datasetA.rows.length ? index : null,
      indexB: index < datasetB.rows.length ? index : null,
    })
  }
  return pairs
}

/**
 * Equivalência de duas células por tipo inferido (RF-06): colunas `number`
 * comparam pelo valor numérico (`parseNumber` — `"10"` e `"10.0"` são
 * iguais); colunas `date` comparam pelo timestamp (`parseDate` — formatos
 * distintos equivalentes contam como iguais); demais tipos (inclusive quando
 * algum lado não converte no tipo esperado) comparam a string exata.
 */
export function valuesEqual(type: ColumnType, a: string, b: string): boolean {
  if (type === 'number') {
    const numberA = parseNumber(a)
    const numberB = parseNumber(b)
    if (numberA !== null && numberB !== null) return numberA === numberB
    return a === b
  }
  if (type === 'date') {
    const dateA = parseDate(a)
    const dateB = parseDate(b)
    if (dateA !== null && dateB !== null) return dateA === dateB
    return a === b
  }
  return a === b
}

/**
 * Classifica um registro presente em ambos os datasets (RF-03/RF-06):
 * aplica `valuesEqual` a cada coluna comum, usando o tipo resolvido por
 * `typeOf(name)` para aquela coluna. `changed` quando ao menos uma coluna
 * diverge; `unchanged` quando todas as colunas comuns são equivalentes.
 */
export function diffRecord(
  rowA: string[],
  rowB: string[],
  commonColumns: CommonColumn[],
  typeOf: (name: string) => ColumnType,
): { status: 'changed' | 'unchanged'; diffColumns: string[] } {
  const diffColumns: string[] = []
  for (const { name, indexA, indexB } of commonColumns) {
    const valueA = rowA[indexA] ?? ''
    const valueB = rowB[indexB] ?? ''
    if (!valuesEqual(typeOf(name), valueA, valueB)) diffColumns.push(name)
  }
  return { status: diffColumns.length > 0 ? 'changed' : 'unchanged', diffColumns }
}

/**
 * Orquestra o diff completo entre A e B (RF-03 a RF-06, CT-02): resolve o
 * pareamento (`pairByKey` quando `options.keyColumn` está presente em
 * `commonKeyColumns`, senão `pairByPosition`), classifica cada par e agrega
 * as contagens por categoria.
 *
 * O tipo usado para comparar uma coluna comum exige que **ambos** os lados
 * (A e B) tenham essa coluna inferida como o mesmo tipo não-texto
 * (`number`/`date`); caso contrário a coluna cai em comparação de string
 * exata (`PLAN.md`, "Assumptions" — leitura conservadora de RF-06 quando A e
 * B discordam do tipo inferido).
 */
export function diffDatasets(
  datasetA: DiffDataset,
  datasetB: DiffDataset,
  options: { keyColumn?: string } = {},
): ComparisonResult {
  const commonColumnNames = commonKeyColumns(datasetA.header, datasetB.header)
  const commonColumns: CommonColumn[] = commonColumnNames.map((name) => ({
    name,
    indexA: datasetA.header.indexOf(name),
    indexB: datasetB.header.indexOf(name),
  }))

  const pairs =
    options.keyColumn && commonColumnNames.includes(options.keyColumn)
      ? pairByKey(datasetA, datasetB, options.keyColumn)
      : pairByPosition(datasetA, datasetB)

  const typeCache = new Map<string, ColumnType>()
  function typeOf(name: string): ColumnType {
    const cached = typeCache.get(name)
    if (cached) return cached

    const column = commonColumns.find((c) => c.name === name)!
    const typeA = inferColumnType(datasetA.rows.map((row) => row[column.indexA] ?? ''))
    const typeB = inferColumnType(datasetB.rows.map((row) => row[column.indexB] ?? ''))
    const resolved: ColumnType =
      typeA === typeB && (typeA === 'number' || typeA === 'date') ? typeA : 'text'
    typeCache.set(name, resolved)
    return resolved
  }

  const counts: ComparisonCounts = { added: 0, removed: 0, changed: 0, unchanged: 0 }
  const records: ComparisonRecord[] = pairs.map(({ indexA, indexB }) => {
    if (indexA === null || indexB === null) {
      const status: RecordStatus = indexB === null ? 'removed' : 'added'
      counts[status] += 1
      return {
        status,
        indexA,
        indexB,
        rowA: indexA !== null ? (datasetA.rows[indexA] ?? null) : null,
        rowB: indexB !== null ? (datasetB.rows[indexB] ?? null) : null,
        diffColumns: [],
      }
    }

    const rowA = datasetA.rows[indexA]!
    const rowB = datasetB.rows[indexB]!
    const { status, diffColumns } = diffRecord(rowA, rowB, commonColumns, typeOf)
    counts[status] += 1
    return { status, indexA, indexB, rowA, rowB, diffColumns }
  })

  return { commonColumns: commonColumnNames, records, counts }
}
