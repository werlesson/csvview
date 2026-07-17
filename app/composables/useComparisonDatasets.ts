import { computed, readonly, ref, watch } from 'vue'
import { ACCEPTED_LABEL, hasAcceptedExtension } from '~/composables/useOpenFile'
import { useCsvParser, type ParseFileOptions } from '~/composables/useCsvParser'
import { useFilesStore } from '~/composables/useFilesStore'
import { useCurrentDataset, type Dataset, type DatasetMeta } from '~/composables/useCurrentDataset'
import { CsvParseError, type ParseResult } from '~/services/csvParser'
import { commonKeyColumns, diffDatasets, type ComparisonCounts } from '~/services/diffDatasets'

/**
 * Estado paralelo da comparação de dois arquivos (feature `file-comparison`,
 * Fase 2, T02).
 *
 * `datasetA`/`metaA` são um passthrough somente-leitura de
 * {@link useCurrentDataset} — nunca reatribuídos por este composable (RF-01).
 * `datasetB`/`metaB` vivem em `ref`s locais dedicadas, nunca persistidas em
 * IndexedDB (CT-01). `openFileB`/`reopenRecentB` são um caminho de abertura
 * **dedicado e paralelo** a `useOpenFile.ts` — reaproveitam só as constantes
 * puras de extensão e o `parser.parseText()` (mesmo Web Worker), nunca
 * chamando `saveFile()`/`touchFile()` do `filesStore` injetado.
 *
 * Estado em escopo de módulo (mesmo padrão de `useCurrentDataset.ts`/
 * `useCellEditing.ts`).
 */

/** Teto de tamanho de RNF-01, aplicado individualmente a cada dataset. */
export const MAX_COMPARISON_SIZE_BYTES = 50 * 1024 * 1024

/** Teto de linhas de RNF-01, aplicado individualmente a cada dataset. */
export const MAX_COMPARISON_ROWS = 1_000_000

/** Parser mínimo exigido pelo fluxo de B (subconjunto de {@link useCsvParser}). */
export interface ComparisonParser {
  parseText(
    content: string,
    fileName?: string,
    options?: ParseFileOptions,
  ): Promise<ParseResult>
}

/** Dependências injetáveis do fluxo de B (todas com um default de produção). */
export interface UseComparisonDatasetsOptions {
  /** Parser de CSV/TSV; default {@link useCsvParser}. */
  parser?: ComparisonParser
  /** Acesso somente-leitura ao store `files`; nunca `saveFile`/`touchFile`. */
  filesStore?: Pick<ReturnType<typeof useFilesStore>, 'getFile'>
}

// Estado compartilhado em escopo de módulo: dataset B nunca é persistido, mas
// sobrevive entre instâncias do composable (mesmo padrão de useCurrentDataset).
const datasetB = ref<Dataset | null>(null)
const metaB = ref<DatasetMeta | null>(null)
const keyColumn = ref<string | null>(null)
const comparisonError = ref<string | null>(null)
const isOpeningB = ref(false)
const progressB = ref(0)

/** Traduz um erro capturado em mensagem legível para a UI. */
function toMessage(err: unknown): string {
  if (err instanceof CsvParseError) return err.message
  return 'Não foi possível abrir o arquivo.'
}

/** Zera o estado de comparação (B + coluna-chave + erro); nunca toca em A. */
function clearComparison(): void {
  datasetB.value = null
  metaB.value = null
  keyColumn.value = null
  comparisonError.value = null
}

// Reset automático: trocar o dataset A (novo `id`) limpa B (RF-01/Assumptions,
// mesma técnica de useCellEditing.ts:61-70). `flush: 'sync'` evita que uma
// comparação B-vs-A antigo fique presa contra um A já trocado.
watch(() => useCurrentDataset().meta.value?.id, clearComparison, { flush: 'sync' })

export function useComparisonDatasets(options: UseComparisonDatasetsOptions = {}) {
  const parser = options.parser ?? useCsvParser()
  const filesStore = options.filesStore ?? useFilesStore()
  const { dataset: datasetA, meta: metaA } = useCurrentDataset()

  /** Teto de RNF-01: tamanho OU nº de linhas acima do limite. */
  function exceedsCeiling(sizeBytes: number, rowCount: number): boolean {
    return sizeBytes > MAX_COMPARISON_SIZE_BYTES || rowCount > MAX_COMPARISON_ROWS
  }

  const availableKeyColumns = computed<string[]>(() => {
    if (!datasetA.value || !datasetB.value) return []
    return commonKeyColumns(datasetA.value.header, datasetB.value.header)
  })

  const result = computed(() => {
    if (!datasetA.value || !datasetB.value) return null
    return diffDatasets(datasetA.value, datasetB.value, {
      keyColumn: keyColumn.value ?? undefined,
    })
  })

  const summary = computed<ComparisonCounts | null>(() => result.value?.counts ?? null)

  const hasDatasetB = computed(() => datasetB.value !== null)

  /**
   * Abre um {@link File} solto/selecionado pelo usuário como dataset B
   * (UI-01): valida extensão, parseia (mesmo parser/Worker de A), valida o
   * teto de RNF-01 e, em sucesso, atribui `datasetB`/`metaB` diretamente —
   * **nunca** persiste em `files` (CT-01, RF-01).
   */
  async function openFileB(file: File): Promise<boolean> {
    comparisonError.value = null

    if (!hasAcceptedExtension(file.name)) {
      comparisonError.value = `Tipo de arquivo não suportado. Formatos aceitos: ${ACCEPTED_LABEL}.`
      return false
    }

    isOpeningB.value = true
    progressB.value = 0
    try {
      const content = await file.text()
      const result = await parser.parseText(content, file.name, {
        onProgress: (value) => {
          progressB.value = value
        },
      })

      if (exceedsCeiling(file.size, result.row_count)) {
        comparisonError.value =
          'Arquivo excede o limite permitido para comparação (~50 MB / ~1.000.000 de linhas).'
        return false
      }

      datasetB.value = { header: result.header, rows: result.rows }
      metaB.value = {
        name: file.name,
        delimiter: result.delimiter,
        sizeBytes: file.size,
        rowCount: result.row_count,
        columnCount: result.column_count,
      }
      return true
    } catch (err) {
      comparisonError.value = toMessage(err)
      return false
    } finally {
      isOpeningB.value = false
    }
  }

  /**
   * Reabre, em modo somente-leitura, um arquivo já persistido (item dos
   * recentes de A) como dataset B: busca o conteúdo via
   * `filesStore.getFile(id)` (leitura pura), reparseia, valida o teto de
   * RNF-01 e, em sucesso, atribui `datasetB`/`metaB` (`metaB.id = id`, só
   * para exibição). **Nunca** chama `touchFile` — não altera `last_opened_at`
   * nem a ordem dos recentes de A.
   */
  async function reopenRecentB(id: number): Promise<boolean> {
    comparisonError.value = null
    isOpeningB.value = true
    progressB.value = 0
    try {
      const record = await filesStore.getFile(id)
      if (!record) {
        comparisonError.value = 'Arquivo não encontrado.'
        return false
      }

      const result = await parser.parseText(record.content, record.name, {
        onProgress: (value) => {
          progressB.value = value
        },
      })

      if (exceedsCeiling(record.size_bytes, result.row_count)) {
        comparisonError.value =
          'Arquivo excede o limite permitido para comparação (~50 MB / ~1.000.000 de linhas).'
        return false
      }

      datasetB.value = { header: result.header, rows: result.rows }
      metaB.value = {
        id,
        name: record.name,
        delimiter: result.delimiter,
        sizeBytes: record.size_bytes,
        rowCount: result.row_count,
        columnCount: result.column_count,
      }
      return true
    } catch (err) {
      comparisonError.value = toMessage(err)
      return false
    } finally {
      isOpeningB.value = false
    }
  }

  return {
    datasetA,
    metaA,
    datasetB: readonly(datasetB),
    metaB: readonly(metaB),
    keyColumn,
    availableKeyColumns,
    result,
    summary,
    hasDatasetB,
    comparisonError: readonly(comparisonError),
    isOpeningB: readonly(isOpeningB),
    progressB: readonly(progressB),
    openFileB,
    reopenRecentB,
    clearComparison,
  }
}
