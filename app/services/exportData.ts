/**
 * Geradores de conteúdo por formato de exportação (Fase 1 de `export`).
 *
 * Funções puras, framework-free (sem `ref`/`computed`, sem I/O) — seguem a
 * mesma convenção de `csvParser.ts`/`columnStats.ts`/`formatFile.ts`. Cada
 * gerador recebe o `header`/`rows` já projetados para as colunas visíveis (na
 * ordem de exibição final, `displayColumns`) e devolve o conteúdo textual do
 * formato correspondente.
 *
 * Referência: `.spec/features/export/SPEC.md` (RF-05, RF-06, RF-08, RF-09,
 * RF-11 a RF-14, RF-17); `.spec/features/export/PLAN.md` (T01).
 */

/** Opções do gerador CSV (RF-09). */
export interface CsvOptions {
  /** Inclui a linha de cabeçalho; padrão `true`. */
  includeHeader?: boolean
  /** Envolve todo campo em aspas duplas; padrão `false` (mínimo RFC 4180). */
  quoteAll?: boolean
}

/** Opções do gerador SQL (RF-06, RF-13, RF-14). */
export interface SqlOptions {
  /** Inclui a linha de comentário `-- col1, col2, ...`; padrão `true`. */
  includeHeader?: boolean
  /** Nome da tabela usado em `INSERT INTO` (ver {@link deriveTableName}). */
  tableName: string
}

/**
 * Extrai, de cada linha, apenas as colunas indicadas em `columnIndexes`, na
 * ordem dada — base da projeção de colunas visíveis (RF-08). Nunca inclui um
 * índice fora da lista passada; índice fora do tamanho da linha vira célula
 * vazia (linhas já normalizadas ao tamanho do header pelo parser).
 */
export function projectColumns(
  rows: string[][],
  columnIndexes: number[],
): string[][] {
  return rows.map((row) => columnIndexes.map((index) => row[index] ?? ''))
}

/** Caracteres que, presentes num campo CSV, exigem aspas por RFC 4180. */
function csvNeedsQuoting(field: string): boolean {
  return field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')
}

/** Escapa um campo CSV: aspas internas duplicadas; envolve em aspas quando necessário ou forçado. */
function escapeCsvField(field: string, quoteAll: boolean): string {
  if (!quoteAll && !csvNeedsQuoting(field)) return field
  return `"${field.replace(/"/g, '""')}"`
}

/**
 * Gera o conteúdo CSV (RF-09): cabeçalho condicional; aspas em todos os
 * campos (`quoteAll`) ou apenas onde RFC 4180 exige (delimitador, aspas ou
 * quebra de linha), com aspas internas escapadas por duplicação. Célula
 * vazia (RF-17) vira campo vazio entre delimitadores. Linhas separadas por
 * `\r\n`, conforme a convenção RFC 4180.
 */
export function generateCsv(
  header: string[],
  rows: string[][],
  options: CsvOptions = {},
): string {
  const includeHeader = options.includeHeader ?? true
  const quoteAll = options.quoteAll ?? false

  const lines: string[] = []
  if (includeHeader) {
    lines.push(header.map((label) => escapeCsvField(label, quoteAll)).join(','))
  }
  for (const row of rows) {
    lines.push(
      header.map((_, index) => escapeCsvField(row[index] ?? '', quoteAll)).join(','),
    )
  }
  return lines.join('\r\n')
}

/**
 * Gera o conteúdo JSON (RF-11): array de objetos chaveados pelos rótulos de
 * `header`; todo valor não vazio é passthrough de string (sem coerção
 * numérica/booleana); célula vazia (RF-17) vira `null` JSON.
 */
export function generateJson(header: string[], rows: string[][]): string {
  const objects = rows.map((row) => {
    const entry: Record<string, string | null> = {}
    header.forEach((label, index) => {
      const value = row[index] ?? ''
      entry[label] = value === '' ? null : value
    })
    return entry
  })
  return JSON.stringify(objects, null, 2)
}

/** Escapa uma célula Markdown: `|` literal como `\|`; quebras de linha substituídas por espaço. */
function escapeMarkdownCell(value: string): string {
  return value.replace(/\r\n|\n|\r/g, ' ').replace(/\|/g, '\\|')
}

/**
 * Gera a tabela GFM (RF-12): cabeçalho e linha separadora SEMPRE presentes
 * (independente de `includeHeader`, N/A para este formato — RF-05); `|`
 * escapado e quebras de linha substituídas por espaço em toda célula; célula
 * vazia (RF-17) vira célula em branco.
 */
export function generateMarkdown(header: string[], rows: string[][]): string {
  const headerLine = `| ${header.map(escapeMarkdownCell).join(' | ')} |`
  const separatorLine = `| ${header.map(() => '---').join(' | ')} |`
  const dataLines = rows.map(
    (row) =>
      `| ${header.map((_, index) => escapeMarkdownCell(row[index] ?? '')).join(' | ')} |`,
  )
  return [headerLine, separatorLine, ...dataLines].join('\n')
}

/** Escapa um literal de string SQL: aspas simples internas duplicadas. */
function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''")
}

/**
 * Gera as instruções SQL (RF-13): um `INSERT INTO <tableName> (<header>)
 * VALUES (<valores>);` por linha; strings entre aspas simples com `''` para
 * aspas internas; célula vazia (RF-17) vira o literal `NULL` (sem aspas),
 * consistente para todas as células vazias do arquivo. Comentário `--
 * col1, col2, ...` antes do bloco de `INSERT`s quando `includeHeader`
 * (RF-06).
 */
export function generateSql(
  header: string[],
  rows: string[][],
  options: SqlOptions,
): string {
  const includeHeader = options.includeHeader ?? true
  const columnList = header.join(', ')

  const lines: string[] = []
  if (includeHeader) {
    lines.push(`-- ${columnList}`)
  }
  for (const row of rows) {
    const values = header.map((_, index) => {
      const value = row[index] ?? ''
      return value === '' ? 'NULL' : `'${escapeSqlString(value)}'`
    })
    lines.push(
      `INSERT INTO ${options.tableName} (${columnList}) VALUES (${values.join(', ')});`,
    )
  }
  return lines.join('\n')
}

/**
 * Deriva o nome de tabela SQL a partir do nome original do arquivo (RF-14):
 * remove a extensão final, substitui qualquer caractere fora de
 * `[A-Za-z0-9_]` por `_`, colapsa sequências de `_` consecutivos num único
 * `_` e prefixa com `_` se o resultado começar com dígito ou for vazio.
 */
export function deriveTableName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^./]+$/, '')
  const sanitized = withoutExtension
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')

  if (sanitized === '' || /^[0-9]/.test(sanitized)) {
    return `_${sanitized}`
  }
  return sanitized
}
