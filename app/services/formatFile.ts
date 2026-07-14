/**
 * Formatação dos metadados de arquivo exibidos na tela de Upload (Fase 6).
 *
 * Funções puras, sem dependência de DOM/estado — usadas pela lista de
 * arquivos recentes (nome · nº de linhas · tamanho · "há quanto tempo"),
 * fiéis à referência de design
 * (`.spec/init/design/README.md#screen-1--tela-inicial--upload`,
 * ex.: `transactions_2026.csv · 1,204,882 linhas · 8.4 MB · 2m`).
 */

/**
 * Formata a contagem de linhas com separador de milhar (ex.: `1204882`
 * → `1,204,882`). O rótulo "linhas" é adicionado por quem consome.
 */
export function formatRowCount(count: number): string {
  return count.toLocaleString('en-US')
}

/** Unidades usadas por {@link formatBytes}, em ordem crescente. */
const BYTE_UNITS = ['KB', 'MB', 'GB', 'TB'] as const

/**
 * Formata um tamanho em bytes de forma legível (ex.: `42` → `42 B`,
 * `8808038` → `8.4 MB`). Abaixo de 1 KB usa bytes inteiros; a partir daí
 * usa a maior unidade cabível com uma casa decimal (sem decimal quando ≥ 100).
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`

  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  // Uma casa decimal para valores pequenos; inteiro a partir de 100.
  const rounded =
    value >= 100 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${BYTE_UNITS[unitIndex]}`
}

/**
 * Formata "há quanto tempo" um timestamp (epoch ms) ocorreu, em relação a
 * `now` (ex.: `agora`, `2m`, `3h`, `5d`). Diferenças negativas (relógio
 * adiantado) são tratadas como `agora`.
 */
export function formatRelativeTime(
  timestamp: number,
  now: number = Date.now(),
): string {
  const diffSeconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (diffSeconds < 60) return 'agora'

  const minutes = Math.floor(diffSeconds / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  return `${days}d`
}
