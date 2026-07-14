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

/** Conta ocorrências de um caractere numa string. */
function countChar(text: string, char: string): number {
  let count = 0
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === char) count += 1
  }
  return count
}

/**
 * Detecta o delimitador a partir do conteúdo, contando os candidatos nas
 * primeiras linhas não-vazias. Empate ou ausência total resolve para `comma`.
 */
export function detectDelimiterFromContent(content: string): Delimiter {
  const sample = content.slice(0, 64 * 1024)
  const lines = sample
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim() !== '')
    .slice(0, 5)
  const joined = lines.join('\n')

  const counts: Record<Delimiter, number> = {
    comma: countChar(joined, DELIMITER_CHARS.comma),
    tab: countChar(joined, DELIMITER_CHARS.tab),
    semicolon: countChar(joined, DELIMITER_CHARS.semicolon),
  }

  // Preferência estável em caso de empate: comma > tab > semicolon.
  const order: Delimiter[] = ['comma', 'tab', 'semicolon']
  let best: Delimiter = 'comma'
  let bestCount = -1
  for (const candidate of order) {
    if (counts[candidate] > bestCount) {
      best = candidate
      bestCount = counts[candidate]
    }
  }
  return best
}

/**
 * Detecta o delimitador por **extensão** e, quando ambígua, por **conteúdo**:
 * `.csv` → comma, `.tsv` → tab, `.txt`/variantes → detecção pelo conteúdo
 * (ex.: `;` → semicolon). Sem extensão nem conteúdo, assume `comma`.
 */
export function detectDelimiter(fileName: string, content?: string): Delimiter {
  const ext = extensionOf(fileName)
  if (ext === '.csv') return 'comma'
  if (ext === '.tsv') return 'tab'
  // `.txt` e demais: decide pelo conteúdo.
  if (content !== undefined && content !== '') {
    return detectDelimiterFromContent(content)
  }
  return 'comma'
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
  content: string,
  options: ParseOptions = {},
): Promise<ParseResult> {
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
