<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

/**
 * Modal de "alterações não salvas": abre ao tentar sair do Viewer (logo/
 * "Voltar", "Comparar") com ao menos uma edição pendente. Diferente de
 * `ConfirmModal.vue` (binário confirmar/cancelar), oferece 3 ações — salvar
 * como cópia, salvar (sobrescrevendo o original), ou descartar — além de
 * cancelar.
 */
const props = withDefaults(
  defineProps<{
    /** Visibilidade do modal — controlada pelo pai. */
    open: boolean
    /** Nome do arquivo com edições pendentes, para a mensagem. */
    fileName: string
    /** `true` quando o dataset já foi persistido (tem `id`) — habilita "Salvar". */
    canOverwrite?: boolean
    /** `true` enquanto uma gravação está em andamento — desabilita todos os botões. */
    busy?: boolean
  }>(),
  {
    canOverwrite: true,
    busy: false,
  },
)

const emit = defineEmits<{
  (e: 'save-copy'): void
  (e: 'overwrite'): void
  (e: 'discard'): void
  (e: 'close'): void
}>()

function onDismiss(): void {
  if (props.busy) return
  emit('close')
}

function onSaveCopy(): void {
  if (props.busy) return
  emit('save-copy')
}

function onOverwrite(): void {
  if (props.busy || !props.canOverwrite) return
  emit('overwrite')
}

function onDiscard(): void {
  if (props.busy) return
  emit('discard')
}

// Foco inicial no modal ao abrir, para o Escape funcionar sem exigir clique antes.
const panel = ref<HTMLElement | null>(null)
watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    panel.value?.focus()
  },
)
</script>

<template>
  <Transition name="unsaved-overlay">
    <div v-if="open" class="unsaved-overlay" @click.self="onDismiss">
      <div
        ref="panel"
        class="unsaved-overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Alterações não salvas"
        tabindex="-1"
        @keydown.esc="onDismiss"
      >
        <h2 class="unsaved-overlay__title">Alterações não salvas</h2>
        <p class="unsaved-overlay__message">
          “{{ fileName }}” tem edições não salvas. Deseja salvar antes de sair, ou descartar as
          alterações?
        </p>

        <div class="unsaved-overlay__actions">
          <button
            v-if="canOverwrite"
            type="button"
            class="unsaved-overlay__overwrite"
            :disabled="busy"
            @click="onOverwrite"
          >
            <span v-if="busy" class="unsaved-overlay__spinner" aria-hidden="true" />
            Salvar e sair
          </button>
          <button
            type="button"
            class="unsaved-overlay__save-copy"
            :disabled="busy"
            @click="onSaveCopy"
          >
            Salvar como cópia e sair
          </button>
          <button
            type="button"
            class="unsaved-overlay__discard"
            :disabled="busy"
            @click="onDiscard"
          >
            Sair sem salvar
          </button>
        </div>

        <footer class="unsaved-overlay__footer">
          <button type="button" class="unsaved-overlay__cancel" :disabled="busy" @click="onDismiss">
            Cancelar
          </button>
        </footer>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Mesmo padrão de overlay centralizado de ConfirmModal.vue. */
.unsaved-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.unsaved-overlay__panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 400px;
  max-width: 90vw;
  padding: 20px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  outline: none;
}

.unsaved-overlay-enter-active,
.unsaved-overlay-leave-active {
  transition: opacity 0.2s ease;
}

.unsaved-overlay-enter-active .unsaved-overlay__panel,
.unsaved-overlay-leave-active .unsaved-overlay__panel {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
}

.unsaved-overlay-enter-from,
.unsaved-overlay-leave-to {
  opacity: 0;
}

.unsaved-overlay-enter-from .unsaved-overlay__panel,
.unsaved-overlay-leave-to .unsaved-overlay__panel {
  transform: scale(0.96);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .unsaved-overlay-enter-active,
  .unsaved-overlay-leave-active,
  .unsaved-overlay-enter-active .unsaved-overlay__panel,
  .unsaved-overlay-leave-active .unsaved-overlay__panel {
    transition-duration: 0s;
  }
}

.unsaved-overlay__title {
  margin: 0;
  font-family: var(--font);
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.unsaved-overlay__message {
  margin: 0;
  font-size: 14px;
  color: var(--text-2);
}

.unsaved-overlay__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.unsaved-overlay__save-copy,
.unsaved-overlay__overwrite,
.unsaved-overlay__discard,
.unsaved-overlay__cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

/* "Salvar e sair" (sobrescreve o original): ação principal, primeira opção —
   mesmo padrão accent-sólido do botão equivalente na toolbar. */
.unsaved-overlay__overwrite {
  background: var(--accent);
  border: 1px solid var(--accent);
  color: var(--accent-fg);
}

.unsaved-overlay__overwrite:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

/* "Salvar como cópia e sair": segunda opção — mesmo padrão neutro do botão
   "Sair sem salvar", menor ênfase visual que a ação principal. */
.unsaved-overlay__save-copy {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-2);
}

.unsaved-overlay__save-copy:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

/* "Sair sem salvar": descarta as edições — menor ênfase visual que as duas
   ações de gravação, mas ainda destacado por ser uma perda de dados. */
.unsaved-overlay__discard {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-2);
}

.unsaved-overlay__discard:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.unsaved-overlay__footer {
  display: flex;
}

.unsaved-overlay__cancel {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-2);
}

.unsaved-overlay__cancel:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.unsaved-overlay__save-copy:disabled,
.unsaved-overlay__overwrite:disabled,
.unsaved-overlay__discard:disabled,
.unsaved-overlay__cancel:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.unsaved-overlay__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: unsaved-overlay-spin 0.6s linear infinite;
}

@keyframes unsaved-overlay-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .unsaved-overlay__spinner {
    animation: none;
  }
}
</style>
