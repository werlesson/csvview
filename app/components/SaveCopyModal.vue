<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

/**
 * Passo de nomeação do "Salvar como cópia": aberto tanto pelo botão da
 * toolbar (`viewer.vue`) quanto por "Salvar como cópia e sair" do modal de
 * alterações não salvas (`UnsavedChangesModal.vue`, via `useUnsavedChangesGuard`).
 * O nome vem pré-preenchido com a sugestão (`nextCopyName`), mas é livremente
 * editável — inclusive para repetir o nome do arquivo original, já que o
 * store `files` não exige nomes únicos.
 */
const props = withDefaults(
  defineProps<{
    /** Visibilidade do modal — controlada pelo pai. */
    open: boolean
    /** Nome do arquivo original, para a mensagem explicativa. */
    fileName: string
    /** Nome sugerido para a cópia, pré-preenchido no campo (ex.: `nextCopyName`). */
    suggestedName: string
    /** `true` enquanto a gravação está em andamento — desabilita o formulário. */
    busy?: boolean
  }>(),
  {
    busy: false,
  },
)

const emit = defineEmits<{
  (e: 'confirm', name: string): void
  (e: 'close'): void
}>()

const name = ref(props.suggestedName)
const trimmedName = computed(() => name.value.trim())

const panel = ref<HTMLElement | null>(null)
const nameInput = ref<HTMLInputElement | null>(null)

// Reabastece o campo com a sugestão atual e foca/seleciona o texto a cada
// abertura — inclusive reaberturas seguidas com sugestões diferentes.
watch(
  () => props.open,
  async (open) => {
    if (!open) return
    name.value = props.suggestedName
    await nextTick()
    nameInput.value?.focus()
    nameInput.value?.select()
  },
)

function onDismiss(): void {
  if (props.busy) return
  emit('close')
}

function onConfirm(): void {
  if (props.busy || !trimmedName.value) return
  emit('confirm', trimmedName.value)
}
</script>

<template>
  <Transition name="save-copy-overlay">
    <div v-if="open" class="save-copy-overlay" @click.self="onDismiss">
      <div
        ref="panel"
        class="save-copy-overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Salvar como cópia"
        @keydown.esc="onDismiss"
      >
        <h2 class="save-copy-overlay__title">Salvar como cópia</h2>
        <p class="save-copy-overlay__message">
          Isso criará uma nova cópia de “{{ fileName }}” com as edições atuais. O arquivo
          original permanece intacto.
        </p>

        <label class="save-copy-overlay__field">
          <span class="save-copy-overlay__label">Nome da cópia</span>
          <input
            ref="nameInput"
            v-model="name"
            type="text"
            class="save-copy-overlay__input"
            :disabled="busy"
            autocomplete="off"
            spellcheck="false"
            @keydown.enter="onConfirm"
          >
        </label>

        <footer class="save-copy-overlay__footer">
          <button
            type="button"
            class="save-copy-overlay__cancel"
            :disabled="busy"
            @click="onDismiss"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="save-copy-overlay__confirm"
            :disabled="busy || !trimmedName"
            @click="onConfirm"
          >
            <span v-if="busy" class="save-copy-overlay__spinner" aria-hidden="true" />
            Salvar como cópia
          </button>
        </footer>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Mesmo padrão de overlay centralizado de ConfirmModal.vue. */
.save-copy-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.save-copy-overlay__panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 400px;
  max-width: 90vw;
  padding: 20px;
  margin: 0;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
}

.save-copy-overlay-enter-active,
.save-copy-overlay-leave-active {
  transition: opacity 0.2s ease;
}

.save-copy-overlay-enter-active .save-copy-overlay__panel,
.save-copy-overlay-leave-active .save-copy-overlay__panel {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
}

.save-copy-overlay-enter-from,
.save-copy-overlay-leave-to {
  opacity: 0;
}

.save-copy-overlay-enter-from .save-copy-overlay__panel,
.save-copy-overlay-leave-to .save-copy-overlay__panel {
  transform: scale(0.96);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .save-copy-overlay-enter-active,
  .save-copy-overlay-leave-active,
  .save-copy-overlay-enter-active .save-copy-overlay__panel,
  .save-copy-overlay-leave-active .save-copy-overlay__panel {
    transition-duration: 0s;
  }
}

.save-copy-overlay__title {
  margin: 0;
  font-family: var(--font);
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.save-copy-overlay__message {
  margin: 0;
  font-size: 14px;
  color: var(--text-2);
}

.save-copy-overlay__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.save-copy-overlay__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3);
}

.save-copy-overlay__input {
  height: 36px;
  min-width: 0;
  padding: 0 12px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
}

.save-copy-overlay__input:focus {
  outline: none;
  border-color: var(--accent);
}

.save-copy-overlay__input:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.save-copy-overlay__footer {
  display: flex;
  gap: 10px;
}

.save-copy-overlay__cancel,
.save-copy-overlay__confirm {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 1;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.save-copy-overlay__cancel {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-2);
}

.save-copy-overlay__cancel:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.save-copy-overlay__confirm {
  background: var(--accent);
  border: 1px solid var(--accent);
  color: var(--accent-fg);
}

.save-copy-overlay__confirm:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.save-copy-overlay__cancel:disabled,
.save-copy-overlay__confirm:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.save-copy-overlay__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: save-copy-overlay-spin 0.6s linear infinite;
}

@keyframes save-copy-overlay-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .save-copy-overlay__spinner {
    animation: none;
  }
}
</style>
