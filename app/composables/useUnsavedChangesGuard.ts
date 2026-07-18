import { computed, readonly, ref } from 'vue'
import { useCellEditing } from '~/composables/useCellEditing'
import { useCurrentDataset } from '~/composables/useCurrentDataset'
import { useSaveVersion } from '~/composables/useSaveVersion'
import { nextCopyName } from '~/services/formatFile'

/**
 * Guarda de navegação para alterações não salvas: intercepta a saída do
 * Viewer (logo/"Voltar" em `default.vue`, "Comparar" em `viewer.vue`) quando
 * há alteração ainda não persistida (`hasUnsavedChanges` — diferente de
 * `canUndo`: reflete se o histórico já foi salvo, não só se ele existe),
 * abrindo `UnsavedChangesModal` em vez de navegar direto.
 *
 * Estado em escopo de módulo (mesmo padrão de `useCurrentDataset`/
 * `useCellEditing`): permite que `default.vue` (sempre montado) e `viewer.vue`
 * compartilhem o mesmo modal sem prop-drilling entre layout e página.
 */
const isOpen = ref(false)
const showSaveCopyModal = ref(false)
const pendingPath = ref<string | null>(null)

export function useUnsavedChangesGuard() {
  const { hasUnsavedChanges } = useCellEditing()
  const { meta } = useCurrentDataset()
  const { isBusy, error, saveNewVersion, overwriteOriginal } = useSaveVersion()

  function leaveNow(): void {
    isOpen.value = false
    showSaveCopyModal.value = false
    const path = pendingPath.value
    pendingPath.value = null
    if (path) navigateTo(path)
  }

  /** Navega direto sem alteração pendente; do contrário, abre o modal e guarda o destino. */
  function guardNavigation(path: string): void {
    if (!hasUnsavedChanges.value) {
      navigateTo(path)
      return
    }
    pendingPath.value = path
    isOpen.value = true
  }

  /**
   * Clique em "Salvar como cópia e sair" no `UnsavedChangesModal`: troca-o
   * pelo modal de nomeação (`SaveCopyModal`) — o salvamento em si só
   * acontece ao confirmar lá (`confirmSaveCopy`), com o nome escolhido.
   */
  function openSaveCopyModal(): void {
    isOpen.value = false
    showSaveCopyModal.value = true
  }

  /** Cancela o passo de nomeação sem salvar nem navegar (mesmo efeito de "Cancelar" no modal de alterações não salvas). */
  function cancelSaveCopyModal(): void {
    showSaveCopyModal.value = false
    pendingPath.value = null
  }

  async function confirmSaveCopy(name?: string): Promise<void> {
    if (await saveNewVersion(name)) leaveNow()
  }

  async function confirmOverwrite(): Promise<void> {
    if (await overwriteOriginal()) leaveNow()
  }

  function discard(): void {
    leaveNow()
  }

  function cancel(): void {
    isOpen.value = false
    pendingPath.value = null
  }

  return {
    isOpen: readonly(isOpen),
    showSaveCopyModal: readonly(showSaveCopyModal),
    /** Nome sugerido (editável) para o modal de nomeação, pré-preenchido via `nextCopyName`. */
    suggestedCopyName: computed(() => nextCopyName(meta.value?.name ?? '')),
    fileName: computed(() => meta.value?.name ?? ''),
    canOverwrite: computed(() => meta.value?.id !== undefined),
    isBusy,
    error,
    guardNavigation,
    openSaveCopyModal,
    cancelSaveCopyModal,
    confirmSaveCopy,
    confirmOverwrite,
    discard,
    cancel,
  }
}
