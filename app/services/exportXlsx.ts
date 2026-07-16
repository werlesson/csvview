/**
 * Gerador de conteúdo XLSX (Fase 1 de `export`, T02).
 *
 * A biblioteca de terceiros (`xlsx`/SheetJS) é carregada via `import()`
 * dinâmico **dentro** de {@link generateXlsx} — nunca no topo do módulo —
 * para que o código da lib entre num chunk separado do bundle eager das
 * rotas Upload/Viewer (RNF-02). `exportXlsx.ts` pode ser importado
 * eagerly por quem o chama sem puxar a biblioteca.
 *
 * Referência: `.spec/features/export/SPEC.md` (RF-10, RF-17, RF-18,
 * RNF-02); `.spec/features/export/PLAN.md` (T02).
 */

/** Opções do gerador XLSX (RF-10). */
export interface XlsxOptions {
  /** Inclui a linha de cabeçalho na linha 1; padrão `true`. */
  includeHeader?: boolean
}

/** Resultado da geração XLSX. */
export interface XlsxResult {
  /** Conteúdo binário do arquivo `.xlsx` (planilha única). */
  buffer: ArrayBuffer
  /** Nº total de linhas escritas na planilha (dados + cabeçalho, se incluído). */
  rowCount: number
  /** `true` quando o escopo excedeu o limite de linhas do Excel e foi truncado (RF-18). */
  truncated: boolean
}

/** Limite de linhas por planilha do Excel (RF-18). */
export const MAX_XLSX_ROWS = 1_048_576

/**
 * Gera uma pasta de trabalho de planilha única (`.xlsx`) a partir de
 * `header`/`rows` já projetados para as colunas visíveis. A linha 1 é o
 * cabeçalho se e somente se `includeHeader` estiver ligado (RF-10). Célula
 * vazia (RF-17) permanece vazia — nenhum placeholder é escrito.
 *
 * Se o total de linhas (dados + cabeçalho, quando incluído) exceder
 * {@link MAX_XLSX_ROWS}, trunca as linhas de dados nesse limite e devolve
 * `truncated: true`, sem dividir os dados em múltiplas planilhas e sem
 * lançar erro (RF-18).
 */
export async function generateXlsx(
  header: string[],
  rows: string[][],
  options: XlsxOptions = {},
): Promise<XlsxResult> {
  const includeHeader = options.includeHeader ?? true
  const XLSX = await import('xlsx')

  const headerRowCount = includeHeader ? 1 : 0
  const maxDataRows = MAX_XLSX_ROWS - headerRowCount
  const truncated = rows.length > maxDataRows
  const dataRows = truncated ? rows.slice(0, maxDataRows) : rows

  const aoa: string[][] = includeHeader ? [header, ...dataRows] : dataRows

  const worksheet = XLSX.utils.aoa_to_sheet(aoa)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')

  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

  return {
    buffer,
    rowCount: aoa.length,
    truncated,
  }
}
