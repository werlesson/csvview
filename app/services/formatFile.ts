import { DELIMITER_CHARS, type Delimiter } from '~/services/csvParser'

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

/** Reconhece um sufixo "(cópia)"/"(cópia N)" já presente no nome base (sem extensão). */
const COPY_SUFFIX_RE = /^(.*) \(cópia(?: (\d+))?\)$/

/**
 * Deriva o nome do arquivo para "Salvar como cópia" (RF-11): insere/incrementa
 * o sufixo "(cópia)" antes da extensão, para distinguir a cópia do original
 * na lista de recentes — ex.: `transactions.csv` → `transactions (cópia).csv`
 * → `transactions (cópia 2).csv`.
 */
export function nextCopyName(name: string): string {
  const dotIndex = name.lastIndexOf('.')
  const hasExt = dotIndex > 0
  const base = hasExt ? name.slice(0, dotIndex) : name
  const ext = hasExt ? name.slice(dotIndex) : ''

  const match = base.match(COPY_SUFFIX_RE)
  if (!match) return `${base} (cópia)${ext}`

  const nextN = match[2] ? Number(match[2]) + 1 : 2
  return `${match[1]} (cópia ${nextN})${ext}`
}

/** Resultado de {@link extractHeaderTags}: nomes exibidos + quantos ficaram de fora. */
export interface HeaderTags {
  /** Primeiros nomes de coluna, na ordem do cabeçalho. */
  names: string[]
  /** Quantas colunas além de `names` existem (badge "+N"); `0` se nenhuma. */
  overflow: number
}

/** Remove um par de aspas retas ou curvas envolvendo o nome, se houver. */
function stripQuotes(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    const first = trimmed[0]
    const last = trimmed[trimmed.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1)
    }
  }
  return trimmed
}

/**
 * Deriva os nomes de coluna de um arquivo recente a partir do seu `content`
 * bruto já persistido (Fase 6, mock 1a "Split editorial") — sem re-parsear o
 * arquivo inteiro: olha só a primeira linha (o cabeçalho, US-1.1) e separa
 * pelo caractere do delimitador. Não é aspas-aware (não trata um delimitador
 * escapado dentro de um nome de coluna entre aspas) — aceitável para uma
 * prévia decorativa, já que o dado "de verdade" é reparseado ao abrir.
 *
 * Retorna os primeiros `limit` nomes e a contagem restante para o badge
 * "+N" do design.
 */
export function extractHeaderTags(
  content: string,
  // `FileRecord.delimiter` é `string` no schema (persistido como texto),
  // por isso aceitamos `string` aqui em vez do union `Delimiter` — com
  // fallback para vírgula caso o valor guardado seja inesperado.
  delimiter: Delimiter | string,
  limit = 3,
): HeaderTags {
  if (!content) return { names: [], overflow: 0 }

  const newlineIndex = content.indexOf('\n')
  const headerLine = newlineIndex === -1 ? content : content.slice(0, newlineIndex)
  const trimmedLine = headerLine.replace(/\r$/, '')
  if (!trimmedLine) return { names: [], overflow: 0 }

  const delimiterChar =
    (DELIMITER_CHARS as Record<string, string>)[delimiter] ?? DELIMITER_CHARS.comma

  const names = trimmedLine
    .split(delimiterChar)
    .map(stripQuotes)
    .filter((name) => name.length > 0)

  return {
    names: names.slice(0, limit),
    overflow: Math.max(0, names.length - limit),
  }
}
