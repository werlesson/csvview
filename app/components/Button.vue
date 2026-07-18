<script setup lang="ts">
import { computed } from 'vue'

/**
 * Botão base do design system.
 *
 * Variantes e tamanhos fiéis a
 * `.spec/init/design/README.md` (Biblioteca de componentes → Buttons).
 * Cores/raios vêm exclusivamente dos tokens definidos em
 * `app/assets/css/main.css`.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'medium' | 'small'

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    size?: ButtonSize
    disabled?: boolean
    /** Tipo nativo do botão (default `button` para não submeter forms). */
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    variant: 'primary',
    size: 'medium',
    disabled: false,
    type: 'button',
  },
)

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

function onClick(event: MouseEvent): void {
  // Estado disabled bloqueia o clique (além do atributo nativo).
  if (props.disabled) return
  emit('click', event)
}

const classes = computed(() => [
  'btn',
  `btn--${props.variant}`,
  { 'btn--small': props.size === 'small' },
])
</script>

<template>
  <button
    :type="type"
    :class="classes"
    :disabled="disabled"
    @click="onClick"
  >
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  padding: 9px 14px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.btn--small {
  font-size: 12.5px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
}

/* Primary — accent sólido */
.btn--primary {
  background: var(--accent);
  color: var(--accent-fg);
  border-color: var(--accent);
}

.btn--primary:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

/* Secondary — superfície com borda */
.btn--secondary {
  background: var(--bg-2);
  color: var(--text);
  border-color: var(--border);
}

.btn--secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

/* Ghost — transparente */
.btn--ghost {
  background: transparent;
  color: var(--text-2);
  border-color: transparent;
}

.btn--ghost:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text);
}

/* Danger — erro sólido */
.btn--danger {
  background: var(--error);
  color: var(--accent-fg);
  border-color: var(--error);
}

.btn--danger:hover:not(:disabled) {
  background: var(--error-soft);
  color: var(--error);
  border-color: var(--error);
}

/* Estado disabled — reduz opacidade e bloqueia interação */
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
</style>
