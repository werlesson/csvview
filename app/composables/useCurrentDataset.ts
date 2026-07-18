import { computed, readonly, ref } from 'vue'

/**
 * Dataset parseado em memória: cabeçalho + linhas de dados.
 * (O motor de parsing entra na Fase 4; aqui definimos apenas o contrato
 * de estado compartilhado entre as telas de Upload e Viewer.)
 */
export interface Dataset {
  /** Rótulos das colunas (primeira linha do arquivo). */
  header: string[]
  /** Linhas de dados, cada uma alinhada às colunas do cabeçalho. */
  rows: string[][]
}

/**
 * Metadados do dataset atualmente carregado. Espelham os campos
 * persistidos no store `files` (Fase 3), sem o conteúdo bruto.
 */
export interface DatasetMeta {
  /** Id do registro persistido em `files`, quando reaberto de um recente. */
  id?: number
  /** Nome original do arquivo. */
  name: string
  /** Delimitador inferido: comma | tab | semicolon. */
  delimiter: string
  /** Tamanho do conteúdo original, em bytes. */
  sizeBytes: number
  /** Nº de linhas de dados (sem o cabeçalho). */
  rowCount: number
  /** Nº de colunas do cabeçalho. */
  columnCount: number
}

// Estado compartilhado em escopo de módulo: navegar entre Upload e Viewer
// preserva o dataset carregado sem re-parsear o arquivo.
const dataset = ref<Dataset | null>(null)
const meta = ref<DatasetMeta | null>(null)

/**
 * Estado do dataset atual, compartilhado entre as telas.
 * Expõe o dataset, seus metadados e ações para defini-lo/limpá-lo.
 */
export function useCurrentDataset() {
  function setDataset(nextDataset: Dataset, nextMeta: DatasetMeta): void {
    dataset.value = nextDataset
    meta.value = nextMeta
  }

  function clearDataset(): void {
    dataset.value = null
    meta.value = null
  }

  /**
   * Mescla campos em `meta` sem trocar o dataset (ex.: "Salvar como cópia"
   * passa a apontar a visualização atual para o novo registro — RF-11/RF-12).
   * No-op sem dataset carregado.
   */
  function updateMeta(patch: Partial<DatasetMeta>): void {
    if (!meta.value) return
    meta.value = { ...meta.value, ...patch }
  }

  /**
   * Muta `dataset.value.rows[rowIndex][columnIndex]` in-place (CT-01). Sem
   * dataset carregado ou com índices fora dos limites, é um no-op silencioso
   * — nunca lança.
   */
  function updateCell(rowIndex: number, columnIndex: number, value: string): void {
    const current = dataset.value
    if (!current) return
    const row = current.rows[rowIndex]
    if (!row || columnIndex < 0 || columnIndex >= row.length) return
    row[columnIndex] = value
  }

  return {
    dataset: readonly(dataset),
    meta: readonly(meta),
    hasDataset: computed(() => dataset.value !== null),
    setDataset,
    clearDataset,
    updateCell,
    updateMeta,
  }
}
