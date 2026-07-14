import { readonly, ref } from 'vue'
import { useCsvParser, type ParseFileOptions } from '~/composables/useCsvParser'
import { useFilesStore } from '~/composables/useFilesStore'
import {
  useCurrentDataset,
  type DatasetMeta,
} from '~/composables/useCurrentDataset'
import { CsvParseError, type ParseResult } from '~/services/csvParser'

/**
 * Orquestra o fluxo de **abrir/reabrir** um arquivo na tela de Upload (Fase 6):
 * parsear (Fase 4) → persistir em `files` (Fase 3) → carregar no
 * {@link useCurrentDataset} → navegar ao Viewer. Concentra também o estado de
 * erro/carregamento consumido pela UI (US-1.1, US-1.2, US-4.1; workflows 1 e 4).
 *
 * As dependências são injetáveis para permitir testar o fluxo sem Web Worker,
 * sem roteador Nuxt e com um parser determinístico.
 */

/** Rota do Viewer, aberta ao concluir o fluxo (Fase 7). */
export const VIEWER_ROUTE = '/viewer'

/** Extensões aceitas no upload (US-1.1). */
export const ACCEPTED_EXTENSIONS = ['.csv', '.tsv', '.txt'] as const

/** Rótulo legível das extensões aceitas, para mensagens de erro. */
export const ACCEPTED_LABEL = ACCEPTED_EXTENSIONS.join(', ')

/** Parser mínimo exigido pelo fluxo (subconjunto de {@link useCsvParser}). */
export interface OpenFileParser {
  parseText(
    content: string,
    fileName?: string,
    options?: ParseFileOptions,
  ): Promise<ParseResult>
}

/** Dependências injetáveis do fluxo (todas com um default de produção). */
export interface UseOpenFileOptions {
  /** Parser de CSV/TSV; default {@link useCsvParser}. */
  parser?: OpenFileParser
  /** Store `files`; default {@link useFilesStore}. */
  filesStore?: Pick<
    ReturnType<typeof useFilesStore>,
    'saveFile' | 'getFile' | 'touchFile'
  >
  /** Estado do dataset atual; default {@link useCurrentDataset}. */
  currentDataset?: Pick<ReturnType<typeof useCurrentDataset>, 'setDataset'>
  /** Navegação ao Viewer; default `navigateTo` do Nuxt. */
  navigate?: (path: string) => unknown
}

// Estado compartilhado em escopo de módulo: erro/carregamento sobrevivem entre
// instâncias, para que a página e o fluxo compartilhem o mesmo feedback.
const error = ref<string | null>(null)
const isOpening = ref(false)
const progress = ref(0)

/** Verifica se o nome do arquivo tem uma extensão aceita. */
export function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function useOpenFile(options: UseOpenFileOptions = {}) {
  const parser = options.parser ?? useCsvParser()
  const filesStore = options.filesStore ?? useFilesStore()
  const current = options.currentDataset ?? useCurrentDataset()
  const navigate =
    options.navigate ?? ((path: string) => navigateTo(path))

  /** Reporta progresso do parse ao estado reativo. */
  const onProgress = (value: number): void => {
    progress.value = value
  }

  /** Carrega o dataset parseado no estado atual e navega ao Viewer. */
  async function loadAndNavigate(
    result: ParseResult,
    meta: DatasetMeta,
  ): Promise<void> {
    current.setDataset({ header: result.header, rows: result.rows }, meta)
    await navigate(VIEWER_ROUTE)
  }

  /** Traduz um erro capturado em mensagem legível para a UI. */
  function toMessage(err: unknown): string {
    if (err instanceof CsvParseError) return err.message
    return 'Não foi possível abrir o arquivo.'
  }

  /**
   * Abre um {@link File} solto/selecionado pelo usuário (US-1.1): valida a
   * extensão, parseia, persiste em `files`, carrega no dataset atual e navega
   * ao Viewer. Retorna `true` em sucesso; em falha, preenche {@link error} e
   * retorna `false` sem quebrar a tela (US-1.2).
   */
  async function openFile(file: File): Promise<boolean> {
    error.value = null

    if (!hasAcceptedExtension(file.name)) {
      error.value = `Tipo de arquivo não suportado. Formatos aceitos: ${ACCEPTED_LABEL}.`
      return false
    }

    isOpening.value = true
    progress.value = 0
    try {
      // Lê o conteúdo bruto uma vez: é persistido e re-parseado ao reabrir.
      const content = await file.text()
      const result = await parser.parseText(content, file.name, { onProgress })

      const id = await filesStore.saveFile({
        name: file.name,
        delimiter: result.delimiter,
        size_bytes: file.size,
        row_count: result.row_count,
        column_count: result.column_count,
        content,
      })

      await loadAndNavigate(result, {
        id,
        name: file.name,
        delimiter: result.delimiter,
        sizeBytes: file.size,
        rowCount: result.row_count,
        columnCount: result.column_count,
      })
      return true
    } catch (err) {
      error.value = toMessage(err)
      return false
    } finally {
      isOpening.value = false
    }
  }

  /**
   * Reabre um arquivo recente pelo id (US-4.1): recarrega o conteúdo
   * persistido, re-parseia (sem novo upload), atualiza `last_opened_at`
   * (LRU touch) e navega ao Viewer. Retorna `true` em sucesso.
   */
  async function reopenRecent(id: number): Promise<boolean> {
    error.value = null
    isOpening.value = true
    progress.value = 0
    try {
      const record = await filesStore.getFile(id)
      if (!record) {
        error.value = 'Arquivo não encontrado.'
        return false
      }

      const result = await parser.parseText(record.content, record.name, {
        onProgress,
      })

      // LRU touch: move o item para o topo dos recentes na reabertura.
      await filesStore.touchFile(id)

      await loadAndNavigate(result, {
        id,
        name: record.name,
        delimiter: result.delimiter,
        sizeBytes: record.size_bytes,
        rowCount: result.row_count,
        columnCount: result.column_count,
      })
      return true
    } catch (err) {
      error.value = toMessage(err)
      return false
    } finally {
      isOpening.value = false
    }
  }

  /** Limpa a mensagem de erro atual. */
  function clearError(): void {
    error.value = null
  }

  return {
    error: readonly(error),
    isOpening: readonly(isOpening),
    progress: readonly(progress),
    openFile,
    reopenRecent,
    clearError,
  }
}
