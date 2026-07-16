import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import type { ViewerColumn } from '~/composables/useViewer'
import {
  deriveTableName,
  generateCsv,
  generateJson,
  generateMarkdown,
  generateSql,
  projectColumns,
} from '~/services/exportData'
import { generateXlsx, MAX_XLSX_ROWS } from '~/services/exportXlsx'
import { formatRowCount } from '~/services/formatFile'

/**
 * Composable de orquestração do modal de exportação (Fase 2 de `export`).
 *
 * Não estende `useViewer`: recebe `filteredRows`/`allRows`/`displayColumns`/
 * `fileName` via getters reativos do chamador (`ExportModal.vue` ← `viewer.vue`)
 * e concentra toda a lógica de seleção (formato/escopo/opções), projeção de
 * colunas e disparo do download — os geradores de conteúdo em si (T01/T02)
 * permanecem puros e framework-free em `app/services/`.
 *
 * Referência: `.spec/features/export/SPEC.md` (RF-01 a RF-08, RF-14 a RF-18,
 * UI-02, UI-05, CT-02, RNF-01, RNF-02); `.spec/features/export/PLAN.md` (T04).
 */

/** Formato de exportação selecionável no modal. */
export type ExportFormat = 'csv' | 'json' | 'xlsx' | 'md' | 'sql'

/** Escopo de linhas selecionável no modal. */
export type ExportScope = 'filtered' | 'all'

/** Rótulo exibido em cada aba/rótulo de botão, por formato (UI-05). */
const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: 'CSV',
  json: 'JSON',
  xlsx: 'XLSX',
  md: 'MD',
  sql: 'SQL',
}

/** Extensão de arquivo por formato (RF-15, CT-02). */
const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  csv: 'csv',
  json: 'json',
  xlsx: 'xlsx',
  md: 'md',
  sql: 'sql',
}

/** Tipo MIME fixo por formato (CT-02). */
const FORMAT_MIME: Record<ExportFormat, string> = {
  csv: 'text/csv',
  json: 'application/json',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  md: 'text/markdown',
  sql: 'text/plain',
}

/**
 * Quais das duas opções (Incluir cabeçalho / Aspas em todos os campos) ficam
 * habilitadas para cada formato (RF-02 a RF-06, UI-03).
 */
const OPTIONS_ENABLED_BY_FORMAT: Record<
  ExportFormat,
  { includeHeader: boolean; quoteAll: boolean }
> = {
  csv: { includeHeader: true, quoteAll: true },
  xlsx: { includeHeader: true, quoteAll: false },
  json: { includeHeader: false, quoteAll: false },
  md: { includeHeader: false, quoteAll: false },
  sql: { includeHeader: true, quoteAll: false },
}

/** Getters reativos consumidos pelo composable, fornecidos pelo chamador. */
export interface UseExportModalOptions {
  /** Linhas após busca + filtros (`useViewer.filteredRows`). */
  filteredRows: MaybeRefOrGetter<string[][]>
  /** Todas as linhas do dataset, ignorando busca/filtros (`dataset.rows`). */
  allRows: MaybeRefOrGetter<string[][]>
  /** Colunas visíveis na ordem final de exibição (`useViewer.displayColumns`). */
  displayColumns: MaybeRefOrGetter<ViewerColumn[]>
  /** Nome original do arquivo aberto (`useCurrentDataset.meta.name`). */
  fileName: MaybeRefOrGetter<string>
}

/** Remove a extensão final do nome de arquivo, sem sanitizar caracteres (RF-15/CT-02 ≠ RF-14). */
function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^./]+$/, '')
}

/** Cria um `Blob`, dispara o download client-side e libera o Object URL (RF-15, RNF-01). */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function useExportModal(options: UseExportModalOptions) {
  const format = ref<ExportFormat>('csv')
  const scope = ref<ExportScope>('filtered')
  const includeHeader = ref(true)
  const quoteAll = ref(false)
  /** Aviso de truncamento XLSX (RF-18), populado após `download()`. */
  const xlsxWarning = ref<string | null>(null)

  /** Restaura os defaults (`csv`/`filtered`/`true`/`false`) — chamada em todo dismiss (RF-16). */
  function resetSelection(): void {
    format.value = 'csv'
    scope.value = 'filtered'
    includeHeader.value = true
    quoteAll.value = false
    xlsxWarning.value = null
  }

  /** Toggles habilitados/desabilitados para o formato atual (RF-02 a RF-06, UI-03). */
  const optionsEnabled = computed(() => OPTIONS_ENABLED_BY_FORMAT[format.value])

  /** Contagens de escopo (UI-02), prontas para `formatRowCount`. */
  const scopeCounts = computed(() => ({
    filtered: toValue(options.filteredRows).length,
    all: toValue(options.allRows).length,
  }))

  /** Rótulo dinâmico do botão "Baixar" (UI-05). */
  const downloadLabel = computed(() => `Baixar ${FORMAT_LABELS[format.value]}`)

  /**
   * Linhas do escopo selecionado — sempre `filteredRows`/`dataset.rows`,
   * nunca `sortedRows` (RF-07).
   */
  const rowsForScope = computed<string[][]>(() =>
    scope.value === 'filtered'
      ? toValue(options.filteredRows)
      : toValue(options.allRows),
  )

  /**
   * Gera o arquivo do formato atual e dispara o download (RF-01 a RF-08,
   * RF-14 a RF-16, RF-18, CT-02, RNF-01, RNF-02). Projeta `header`/`rows`
   * exclusivamente a partir de `displayColumns` (RF-08) — nunca inclui um
   * índice de coluna fora dessa lista.
   */
  async function download(): Promise<void> {
    xlsxWarning.value = null

    const columns = toValue(options.displayColumns)
    const header = columns.map((column) => column.label)
    const rows = projectColumns(rowsForScope.value, columns.map((column) => column.index))
    const baseName = stripExtension(toValue(options.fileName))
    const currentFormat = format.value

    let content: string | ArrayBuffer
    if (currentFormat === 'csv') {
      content = generateCsv(header, rows, {
        includeHeader: includeHeader.value,
        quoteAll: quoteAll.value,
      })
    } else if (currentFormat === 'json') {
      content = generateJson(header, rows)
    } else if (currentFormat === 'md') {
      content = generateMarkdown(header, rows)
    } else if (currentFormat === 'sql') {
      content = generateSql(header, rows, {
        includeHeader: includeHeader.value,
        tableName: deriveTableName(toValue(options.fileName)),
      })
    } else {
      const result = await generateXlsx(header, rows, {
        includeHeader: includeHeader.value,
      })
      content = result.buffer
      if (result.truncated) {
        xlsxWarning.value = `O arquivo foi truncado em ${formatRowCount(MAX_XLSX_ROWS)} linhas — limite máximo de uma planilha XLSX.`
      }
    }

    const blob = new Blob([content], { type: FORMAT_MIME[currentFormat] })
    triggerDownload(blob, `${baseName}.${FORMAT_EXTENSIONS[currentFormat]}`)
  }

  return {
    format,
    scope,
    includeHeader,
    quoteAll,
    resetSelection,
    optionsEnabled,
    scopeCounts,
    downloadLabel,
    rowsForScope,
    xlsxWarning,
    download,
  }
}
