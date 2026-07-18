<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

/**
 * Modal de confirmação genérico, para ações destrutivas ou irreversíveis
 * (ex.: "Sobrescrever original" em `viewer.vue`) — mesmo padrão de overlay
 * (backdrop `@click.self`, foco inicial para o Escape funcionar, `Transition`
 * de abertura/fechamento) de `ExportModal.vue`/`FilterPanel.vue`.
 */
const props = withDefaults(
  defineProps<{
    /** Visibilidade do modal — controlada pelo pai. */
    open: boolean
    /** Título do modal. */
    title: string
    /** Mensagem explicando a ação e sua consequência. */
    message: string
    /** Rótulo do botão de confirmação. */
    confirmLabel?: string
    /** Rótulo do botão de cancelamento. */
    cancelLabel?: string
    /** `true` estiliza o botão de confirmação como ação destrutiva (aviso). */
    danger?: boolean
    /** `true` enquanto a ação confirmada está em andamento — desabilita os botões. */
    busy?: boolean
  }>(),
  {
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    danger: false,
    busy: false,
  },
)

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'close'): void
}>()

function onDismiss(): void {
  if (props.busy) return
  emit('close')
}

function onConfirm(): void {
  if (props.busy) return
  emit('confirm')
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
  <Transition name="confirm-overlay">
    <div v-if="open" class="confirm-overlay" @click.self="onDismiss">
      <div
        ref="panel"
        class="confirm-overlay__panel"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        tabindex="-1"
        @keydown.esc="onDismiss"
      >
        <h2 class="confirm-overlay__title">{{ title }}</h2>
        <p class="confirm-overlay__message">{{ message }}</p>

        <footer class="confirm-overlay__footer">
          <button
            type="button"
            class="confirm-overlay__cancel"
            :disabled="busy"
            @click="onDismiss"
          >
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            class="confirm-overlay__confirm"
            :class="{ 'confirm-overlay__confirm--danger': danger }"
            :disabled="busy"
            @click="onConfirm"
          >
            <span v-if="busy" class="confirm-overlay__spinner" aria-hidden="true" />
            {{ confirmLabel }}
          </button>
        </footer>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Mesmo padrão de overlay centralizado de ExportModal.vue. */
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.confirm-overlay__panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 380px;
  max-width: 90vw;
  padding: 20px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  outline: none;
}

.confirm-overlay-enter-active,
.confirm-overlay-leave-active {
  transition: opacity 0.2s ease;
}

.confirm-overlay-enter-active .confirm-overlay__panel,
.confirm-overlay-leave-active .confirm-overlay__panel {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
}

.confirm-overlay-enter-from,
.confirm-overlay-leave-to {
  opacity: 0;
}

.confirm-overlay-enter-from .confirm-overlay__panel,
.confirm-overlay-leave-to .confirm-overlay__panel {
  transform: scale(0.96);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .confirm-overlay-enter-active,
  .confirm-overlay-leave-active,
  .confirm-overlay-enter-active .confirm-overlay__panel,
  .confirm-overlay-leave-active .confirm-overlay__panel {
    transition-duration: 0s;
  }
}

.confirm-overlay__title {
  margin: 0;
  font-family: var(--font);
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.confirm-overlay__message {
  margin: 0;
  font-size: 14px;
  color: var(--text-2);
}

.confirm-overlay__footer {
  display: flex;
  gap: 10px;
}

.confirm-overlay__cancel,
.confirm-overlay__confirm {
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

.confirm-overlay__cancel {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-2);
}

.confirm-overlay__cancel:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.confirm-overlay__confirm {
  background: var(--accent);
  border: 1px solid var(--accent);
  color: var(--accent-fg);
}

.confirm-overlay__confirm:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.confirm-overlay__confirm--danger {
  background: var(--warning);
  border-color: var(--warning);
  color: #ffffff;
}

.confirm-overlay__confirm--danger:hover {
  background: var(--warning);
  border-color: var(--warning);
  opacity: 0.9;
}

.confirm-overlay__cancel:disabled,
.confirm-overlay__confirm:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.confirm-overlay__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: confirm-overlay-spin 0.6s linear infinite;
}

@keyframes confirm-overlay-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .confirm-overlay__spinner {
    animation: none;
  }
}
</style>
