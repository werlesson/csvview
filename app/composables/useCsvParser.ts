import {
  CsvParseError,
  parseCsv,
  type ParseResult,
  type ParseWorkerMessage,
} from '~/services/csvParser'

/**
 * Composable de parsing CSV/TSV.
 *
 * Orquestra o parse **em Web Worker** (via {@link ../services/csvParser.worker})
 * para não bloquear a main thread (US-1.2). Se um Worker não puder ser criado
 * (ex.: ambiente de teste), degrada para o parse inline — que também roda em
 * streaming e não trava o event loop. O resultado é o mesmo em ambos os casos.
 */

/** Opções da operação de parse. */
export interface ParseFileOptions {
  /** Callback de progresso (fração 0..1) durante o parse. */
  onProgress?: (progress: number) => void
}

/** Sinaliza que o Web Worker não pôde ser usado; dispara o fallback inline. */
class WorkerUnavailableError extends Error {
  constructor() {
    super('Web Worker indisponível.')
    this.name = 'WorkerUnavailableError'
  }
}

/** Fábrica padrão do Web Worker de parsing (bundle relativo, sem CDN). */
function defaultCreateWorker(): Worker {
  return new Worker(
    new URL('../services/csvParser.worker.ts', import.meta.url),
    { type: 'module' },
  )
}

/** Configuração do composable (injeção da fábrica de Worker para testes). */
export interface UseCsvParserOptions {
  /** Fábrica do Web Worker; sobrescrevível em testes. */
  createWorker?: () => Worker
}

/**
 * Parseia usando um Web Worker. Rejeita com {@link CsvParseError} para erros de
 * parse e com {@link WorkerUnavailableError} quando o Worker não pôde ser
 * criado/rodar — este último dispara o fallback inline.
 */
function parseViaWorker(
  createWorker: () => Worker,
  content: string,
  fileName: string,
  onProgress?: (progress: number) => void,
): Promise<ParseResult> {
  return new Promise<ParseResult>((resolve, reject) => {
    let worker: Worker
    try {
      worker = createWorker()
    } catch {
      reject(new WorkerUnavailableError())
      return
    }

    const cleanup = () => {
      try {
        worker.terminate()
      } catch {
        // ignore
      }
    }

    worker.onmessage = (event: MessageEvent<ParseWorkerMessage>) => {
      const message = event.data
      if (message.type === 'progress') {
        onProgress?.(message.progress)
      } else if (message.type === 'result') {
        cleanup()
        resolve(message.result)
      } else if (message.type === 'error') {
        cleanup()
        reject(new CsvParseError(message.message))
      }
    }

    worker.onerror = () => {
      cleanup()
      reject(new WorkerUnavailableError())
    }

    worker.postMessage({ content, fileName })
  })
}

export function useCsvParser(options: UseCsvParserOptions = {}) {
  const createWorker = options.createWorker ?? defaultCreateWorker

  /**
   * Parseia um conteúdo bruto já em memória (usado ao reabrir um arquivo
   * persistido — Fase 6). Tenta o Web Worker e cai para o parse inline se
   * indisponível.
   */
  async function parseText(
    content: string,
    fileName = '',
    fileOptions: ParseFileOptions = {},
  ): Promise<ParseResult> {
    try {
      return await parseViaWorker(
        createWorker,
        content,
        fileName,
        fileOptions.onProgress,
      )
    } catch (error) {
      // Erro real de parse: propaga. Worker indisponível (ex.: ambiente sem
      // suporte a Worker): cai para o parse inline, com o mesmo resultado.
      if (error instanceof CsvParseError) throw error
    }
    return parseCsv(content, {
      fileName,
      onProgress: fileOptions.onProgress,
    })
  }

  /**
   * Lê e parseia um {@link File} selecionado/solto pelo usuário (US-1.1). O
   * trabalho de parse acontece fora da main thread quando há Web Worker.
   */
  async function parseFile(
    file: File,
    fileOptions: ParseFileOptions = {},
  ): Promise<ParseResult> {
    const content = await file.text()
    return parseText(content, file.name, fileOptions)
  }

  return {
    parseFile,
    parseText,
  }
}
