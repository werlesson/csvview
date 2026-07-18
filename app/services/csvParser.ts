import Papa from 'papaparse'

/**
 * Motor de parsing CSV/TSV do CSV View.
 *
 * Contém a lógica pura de parsing (usada tanto na main thread quanto dentro do
 * Web Worker): detecção de delimitador, parse via PapaParse com streaming/
 * progresso, tratamento de bordas (arquivo vazio, linhas irregulares, ausência
 * de cabeçalho detectável) e normalização das linhas ao número de colunas do
 * cabeçalho.
 *
 * A primeira linha é sempre tratada como **cabeçalho** (US-1.1). Todo valor é
 * mantido como string — a inferência de tipo é responsabilidade da Fase 5.
 *
 * Referência: `.spec/init/project-phases.md` (Fase 4); US-1.1, US-1.2.
 */

/**
 * Delimitador inferido. Espelha os valores documentados em
 * `files.delimiter` (schema): `comma` (`,`), `tab` (`\t`), `semicolon` (`;`).
 */
export type Delimiter = 'comma' | 'tab' | 'semicolon'

/** Mapeia cada delimitador para o caractere correspondente. */
export const DELIMITER_CHARS: Record<Delimiter, string> = {
  comma: ',',
  tab: '\t',
  semicolon: ';',
}

/** Tamanho de chunk padrão (bytes) usado no streaming do parse. */
export const DEFAULT_CHUNK_SIZE = 1024 * 1024

/**
 * Resultado de um parse bem-sucedido: cabeçalho, linhas de dados e metadados.
 * As linhas são normalizadas ao número de colunas do cabeçalho.
 */
export interface ParseResult {
  /** Rótulos das colunas (primeira linha do arquivo). */
  header: string[]
  /** Linhas de dados, cada uma alinhada às colunas do cabeçalho. */
  rows: string[][]
  /** Nº de linhas de dados (sem o cabeçalho). Espelha `files.row_count`. */
  row_count: number
  /** Nº de colunas do cabeçalho. Espelha `files.column_count`. */
  column_count: number
  /** Delimitador efetivamente usado no parse. */
  delimiter: Delimiter
}

/** Opções do parse. */
export interface ParseOptions {
  /** Nome do arquivo, usado para detectar o delimitador pela extensão. */
  fileName?: string
  /** Força um delimitador; quando ausente, é detectado por extensão/conteúdo. */
  delimiter?: Delimiter
  /**
   * Callback de progresso, chamado com uma fração entre 0 e 1 durante o parse
   * de arquivos grandes. O valor final (1) é reportado ao concluir.
   */
  onProgress?: (progress: number) => void
  /** Tamanho de chunk (bytes) do streaming. Padrão: {@link DEFAULT_CHUNK_SIZE}. */
  chunkSize?: number
}

/**
 * Erro tratável de parse: arquivo vazio/sem linhas ou falha do parser. A tela
 * de Upload (Fase 6) consome esta mensagem para dar feedback ao usuário.
 */
export class CsvParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CsvParseError'
  }
}

/** Extrai a extensão (com ponto, em minúsculas) de um nome de arquivo. */
function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot < 0) return ''
  return fileName.slice(dot).toLowerCase()
}

/**
 * Remove o BOM (U+FEFF) do início do conteúdo, se presente. Exportadores
 * (Excel, sistemas legados) costumam prefixar UTF-8 com BOM, o que grudaria o
 * caractere invisível no primeiro rótulo do cabeçalho (ex.: `﻿id_asset`).
 */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/** Conta ocorrências de um caractere numa string. */
function countChar(text: string, char: string): number {
  let count = 0
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === char) count += 1
  }
  return count
}

/** Conta cada delimitador candidato num trecho de texto. */
function countDelimiters(text: string): Record<Delimiter, number> {
  return {
    comma: countChar(text, DELIMITER_CHARS.comma),
    tab: countChar(text, DELIMITER_CHARS.tab),
    semicolon: countChar(text, DELIMITER_CHARS.semicolon),
  }
}

/**
 * Escolhe o delimitador de maior contagem. Empates são resolvidos por uma ordem
 * de preferência que começa pela `hint` (a extensão do arquivo, quando
 * conhecida) e segue comma > tab > semicolon. Retorna `null` se nenhum
 * candidato aparecer.
 */
function pickByCounts(
  counts: Record<Delimiter, number>,
  hint?: Delimiter,
): Delimiter | null {
  const base: Delimiter[] = ['comma', 'tab', 'semicolon']
  const order = hint ? [hint, ...base.filter((d) => d !== hint)] : base
  let best: Delimiter | null = null
  let bestCount = 0
  for (const candidate of order) {
    // `>` estrito + ordem iniciando pela hint => empate fica com a hint.
    if (counts[candidate] > bestCount) {
      best = candidate
      bestCount = counts[candidate]
    }
  }
  return best
}

/** Primeiras `max` linhas não-vazias da amostra (BOM já removido). */
function sampleLines(content: string, max: number): string[] {
  return stripBom(content)
    .slice(0, 64 * 1024)
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim() !== '')
    .slice(0, max)
}

/**
 * Detecta o delimitador a partir do conteúdo. A **linha de cabeçalho** decide
 * primeiro — ela raramente contém o delimitador dentro de valores entre aspas,
 * então é o sinal mais limpo (evita que vírgulas de decimais/valores citados,
 * ex.: `"353.097,00"`, mascarem um arquivo `;`). Só se o cabeçalho não tiver
 * nenhum candidato é que a amostra inteira decide. Empate/ausência → `hint`.
 */
function detectFromContent(content: string, hint?: Delimiter): Delimiter {
  const lines = sampleLines(content, 5)
  const header = lines[0]
  if (header) {
    const byHeader = pickByCounts(countDelimiters(header), hint)
    if (byHeader) return byHeader
  }
  const bySample = pickByCounts(countDelimiters(lines.join('\n')), hint)
  return bySample ?? hint ?? 'comma'
}

/**
 * Detecta o delimitador a partir do conteúdo, priorizando a linha de cabeçalho.
 * Empate ou ausência total resolve para `comma`.
 */
export function detectDelimiterFromContent(content: string): Delimiter {
  return detectFromContent(content)
}

/**
 * Detecta o delimitador combinando **extensão** e **conteúdo**: `.csv` → comma,
 * `.tsv` → tab, `.txt`/variantes → detecção pelo conteúdo (ex.: `;` →
 * semicolon).
 *
 * A extensão é apenas um **desempate**: o conteúdo (linha de cabeçalho) manda.
 * Assim um `.csv` exportado com `;` — padrão pt-BR — não é parseado como uma
 * coluna só. Sem conteúdo, assume o delimitador da extensão.
 */
export function detectDelimiter(fileName: string, content?: string): Delimiter {
  const ext = extensionOf(fileName)
  const hint: Delimiter | undefined =
    ext === '.csv' ? 'comma' : ext === '.tsv' ? 'tab' : undefined

  const sample = content !== undefined ? stripBom(content) : ''
  if (sample.trim() === '') return hint ?? 'comma'

  return detectFromContent(sample, hint)
}

/**
 * Aplica quoting CSV padrão a um campo: envolve em aspas duplas quando o
 * valor contém o delimitador, uma aspas dupla (dobrada) ou uma quebra de
 * linha — necessário para round-trip correto com {@link parseCsv} (PapaParse).
 */
function quoteField(value: string, delimiterChar: string): string {
  if (
    value.includes(delimiterChar) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Serializa um dataset (cabeçalho + linhas) de volta a texto, no delimitador
 * informado, com quoting CSV padrão. Função pura, inversa de {@link parseCsv}
 * para o conteúdo produzido (RF-11, CT-03).
 */
export function stringifyDataset(
  dataset: { header: string[]; rows: string[][] },
  delimiter: Delimiter,
): string {
  const delimiterChar = DELIMITER_CHARS[delimiter]
  const lines = [dataset.header, ...dataset.rows].map((row) =>
    row.map((cell) => quoteField(cell, delimiterChar)).join(delimiterChar),
  )
  return lines.join('\n')
}

/**
 * Projeta a ordem COMPLETA de exibição das colunas (CT-03 de
 * `reorder-columns-undo-redo`): grupo fixado primeiro, na sequência de
 * fixação (`pinnedSequence`), seguido do grupo não fixado, na sequência de
 * `order`. Cada índice original de `[0, columnCount)` aparece exatamente uma
 * vez — inclusive colunas ocultas, sem noção de `hidden` — superconjunto de
 * `displayColumns` (`useViewer.ts`), usado por `useSaveVersion` para
 * serializar o dataset na ordem vigente em vez da ordem original do arquivo.
 *
 * Função pura, framework-free (mesma convenção de `stringifyDataset`):
 * reimplementa o fallback de `effectiveOrder` (`useViewer.ts:125-129`) — `order`
 * de tamanho diferente de `columnCount` cai para a ordem identidade.
 */
export function orderedColumnIndices(
  columnCount: number,
  order: number[],
  pinnedSequence: number[],
): number[] {
  const effectiveOrder =
    order.length === columnCount
      ? order
      : Array.from({ length: columnCount }, (_, index) => index)

  const validPinned = pinnedSequence.filter(
    (index) => index >= 0 && index < columnCount,
  )
  const pinnedSet = new Set(validPinned)

  return [...validPinned, ...effectiveOrder.filter((index) => !pinnedSet.has(index))]
}

/**
 * Normaliza uma linha ao número de colunas do cabeçalho: faltantes viram
 * células vazias; excedentes são preservadas (US-1.2).
 */
function normalizeRow(row: string[], columnCount: number): string[] {
  if (row.length < columnCount) {
    const padded = row.slice()
    while (padded.length < columnCount) padded.push('')
    return padded
  }
  return row
}

/**
 * Parseia o conteúdo bruto de um CSV/TSV, tratando a primeira linha como
 * cabeçalho e normalizando as linhas de dados. Roda em streaming (chunks) e
 * reporta progresso via {@link ParseOptions.onProgress}, sem acumular o parse
 * inteiro de uma vez.
 *
 * Rejeita com {@link CsvParseError} quando o conteúdo está vazio/sem linhas ou
 * quando o parser falha.
 */
export function parseCsv(
  rawContent: string,
  options: ParseOptions = {},
): Promise<ParseResult> {
  // Remove o BOM antes de qualquer coisa, senão ele grudaria no 1º rótulo do
  // cabeçalho e distorceria a detecção de delimitador.
  const content = stripBom(rawContent)
  const delimiter =
    options.delimiter ?? detectDelimiter(options.fileName ?? '', content)
  const delimiterChar = DELIMITER_CHARS[delimiter]
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE
  const totalBytes = content.length

  // Arquivo vazio (0 bytes / só espaços em branco): erro tratável, nunca uma
  // tabela vazia silenciosa (US-1.2).
  if (content.trim() === '') {
    return Promise.reject(new CsvParseError('O arquivo está vazio.'))
  }

  return new Promise<ParseResult>((resolve, reject) => {
    const allRows: string[][] = []

    Papa.parse<string[]>(content, {
      delimiter: delimiterChar,
      // Mantém tudo como string; a inferência de tipo é da Fase 5.
      skipEmptyLines: 'greedy',
      chunkSize,
      chunk(results) {
        for (const row of results.data) allRows.push(row)
        if (options.onProgress && totalBytes > 0) {
          const cursor = results.meta?.cursor ?? 0
          options.onProgress(Math.min(1, cursor / totalBytes))
        }
      },
      complete() {
        // Sem nenhuma linha (ex.: só linhas em branco filtradas): erro tratável.
        if (allRows.length === 0) {
          reject(new CsvParseError('O arquivo não contém nenhuma linha.'))
          return
        }

        const header = allRows[0]!.map((cell) => cell)
        const columnCount = header.length
        const rows = allRows
          .slice(1)
          .map((row) => normalizeRow(row, columnCount))

        options.onProgress?.(1)

        resolve({
          header,
          rows,
          row_count: rows.length,
          column_count: columnCount,
          delimiter,
        })
      },
      error(error: Error) {
        reject(new CsvParseError(error.message))
      },
    })
  })
}

/** Requisição de parse enviada ao Web Worker. */
export interface ParseRequest {
  /** Conteúdo bruto do arquivo. */
  content: string
  /** Nome do arquivo (para detecção do delimitador). */
  fileName?: string
  /** Delimitador forçado, quando já conhecido. */
  delimiter?: Delimiter
}

/** Mensagens que o Web Worker emite de volta para a main thread. */
export type ParseWorkerMessage =
  | { type: 'progress'; progress: number }
  | { type: 'result'; result: ParseResult }
  | { type: 'error'; message: string }

/**
 * Executa uma requisição de parse e reporta o andamento/resultado via `post`.
 * É a lógica que o Web Worker roda; fica aqui (e não no arquivo `.worker`) para
 * poder ser testada diretamente sem instanciar um Worker real.
 */
export async function runParseRequest(
  request: ParseRequest,
  post: (message: ParseWorkerMessage) => void,
): Promise<void> {
  try {
    const result = await parseCsv(request.content, {
      fileName: request.fileName,
      delimiter: request.delimiter,
      onProgress: (progress) => post({ type: 'progress', progress }),
    })
    post({ type: 'result', result })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha ao parsear o arquivo.'
    post({ type: 'error', message })
  }
}
