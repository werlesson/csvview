import { ref } from 'vue'
import { useCellEditing } from '~/composables/useCellEditing'
import { useCurrentDataset } from '~/composables/useCurrentDataset'
import { useFilesStore } from '~/composables/useFilesStore'
import { stringifyDataset, type Delimiter } from '~/services/csvParser'
import { nextCopyName } from '~/services/formatFile'

/** Dependências injetáveis do composable (todas com um default de produção). */
export interface UseSaveVersionOptions {
  /** Dataset atual; default {@link useCurrentDataset}. */
  currentDataset?: Pick<ReturnType<typeof useCurrentDataset>, 'dataset' | 'meta' | 'updateMeta'>
  /** Store `files`; default {@link useFilesStore}. */
  filesStore?: Pick<ReturnType<typeof useFilesStore>, 'saveFile' | 'overwriteFile'>
  /** Histórico de undo/redo; default {@link useCellEditing}. */
  cellEditing?: Pick<ReturnType<typeof useCellEditing>, 'markSaved'>
}

/**
 * Composable de persistência do dataset editado (Fase 2 de `cell-editing`):
 * "Salvar nova versão" (RF-11/RF-12) e "Sobrescrever original" (RF-15).
 *
 * Consome `useCurrentDataset()` (dataset + `meta`), `useFilesStore()`
 * (`saveFile`/`overwriteFile`) e `stringifyDataset` (T01). Segue o mesmo
 * padrão de estado (`isBusy`/`error`, sem bloquear a UI, RNF-02) já usado por
 * `useExportModal` (`isDownloading`/`downloadError`); dependências injetáveis
 * como em `useOpenFile`, para permitir testar falhas de escrita sem depender
 * de uma condição real de quota do IndexedDB.
 *
 * Referência: `.spec/features/cell-editing/SPEC.md` (RF-11, RF-12, RF-14,
 * RF-15, CT-03, CT-04, RNF-02); `.spec/features/cell-editing/PLAN.md` (T05).
 */
export function useSaveVersion(options: UseSaveVersionOptions = {}) {
  const { dataset, meta, updateMeta } = options.currentDataset ?? useCurrentDataset()
  const { saveFile, overwriteFile } = options.filesStore ?? useFilesStore()
  const { markSaved } = options.cellEditing ?? useCellEditing()

  /** `true` enquanto uma escrita (`saveNewVersion`/`overwriteOriginal`) está em voo. */
  const isBusy = ref(false)
  /** Mensagem de erro legível da última escrita, ou `null` se não houve falha. */
  const error = ref<string | null>(null)

  function serializeCurrent(): string {
    const current = dataset.value!
    return stringifyDataset(current, meta.value!.delimiter as Delimiter)
  }

  /**
   * Grava um novo registro em `files` com o conteúdo serializado do dataset
   * atual (RF-11) — **nunca** reutiliza `meta.value.id` (RF-12), respeitando
   * o LRU já implementado em `saveFile`. O nome vem de `customName` (digitado
   * pelo usuário no modal de nomeação, `SaveCopyModal`) quando informado —
   * inclusive repetindo o nome do original, já que `saveFile` não exige nomes
   * únicos — ou do sufixo "(cópia)" (`nextCopyName`) como default. A
   * visualização atual passa a apontar para o novo registro (`updateMeta`) —
   * um "Salvar" (sobrescrever) subsequente afeta a cópia, não o original. Em
   * sucesso, marca a posição atual como salva (`markSaved`): undo/redo
   * continuam disponíveis, mas `hasUnsavedChanges` volta a `false`. Não
   * dispara nenhuma exportação para disco (RF-14). Em falha, retorna `false`,
   * popula `error` e preserva o dataset/edições em memória (RNF-02).
   */
  async function saveNewVersion(customName?: string): Promise<boolean> {
    error.value = null

    if (!dataset.value || !meta.value) {
      error.value = 'Nenhum dataset carregado para salvar.'
      return false
    }

    isBusy.value = true
    try {
      const content = serializeCurrent()
      const name = customName?.trim() || nextCopyName(meta.value.name)
      const sizeBytes = content.length
      const rowCount = dataset.value.rows.length
      const columnCount = dataset.value.header.length
      const id = await saveFile({
        name,
        delimiter: meta.value.delimiter,
        size_bytes: sizeBytes,
        row_count: rowCount,
        column_count: columnCount,
        content,
      })
      updateMeta({ id, name, sizeBytes, rowCount, columnCount })
      markSaved()
      return true
    } catch (cause) {
      console.error('Falha ao salvar nova versão:', cause)
      error.value = 'Não foi possível salvar a nova versão. Tente novamente.'
      return false
    } finally {
      isBusy.value = false
    }
  }

  /**
   * Substitui o `content` do registro original (mesmo `id`) pelo dataset
   * atual serializado (RF-15), sem criar registro adicional. Exige
   * `meta.value.id` definido (dataset persistido). Em sucesso, marca a
   * posição atual como salva (`markSaved`) — ver {@link saveNewVersion}. Em
   * falha — incluindo `id` ausente ou inexistente em `files` — retorna
   * `false`, popula `error` e preserva o dataset/edições em memória (RNF-02).
   */
  async function overwriteOriginal(): Promise<boolean> {
    error.value = null

    if (!dataset.value || !meta.value) {
      error.value = 'Nenhum dataset carregado para sobrescrever.'
      return false
    }
    if (meta.value.id === undefined) {
      error.value = 'Este dataset ainda não foi persistido; use "Salvar como cópia".'
      return false
    }

    isBusy.value = true
    try {
      const content = serializeCurrent()
      const updated = await overwriteFile(meta.value.id, {
        content,
        delimiter: meta.value.delimiter,
        size_bytes: content.length,
        row_count: dataset.value.rows.length,
        column_count: dataset.value.header.length,
      })
      if (!updated) {
        error.value = 'Arquivo original não encontrado para sobrescrever.'
        return false
      }
      markSaved()
      return true
    } catch (cause) {
      console.error('Falha ao sobrescrever o arquivo original:', cause)
      error.value = 'Não foi possível sobrescrever o arquivo original. Tente novamente.'
      return false
    } finally {
      isBusy.value = false
    }
  }

  return {
    isBusy,
    error,
    saveNewVersion,
    overwriteOriginal,
  }
}
