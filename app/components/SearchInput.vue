<script setup lang="ts">
/**
 * Campo de busca do design system ("Buscar em tudo…").
 *
 * Ref de design: `.spec/init/design/README.md`
 * (Biblioteca de componentes → Inputs & select). Base do "Buscar em tudo…"
 * da toolbar do Viewer (US-2.2).
 *
 * Suporta `v-model` e emite o valor digitado.
 */
withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    disabled?: boolean
    /** Rótulo acessível quando não há um `<label>` visível associado. */
    ariaLabel?: string
  }>(),
  {
    modelValue: '',
    placeholder: 'Buscar em tudo…',
    disabled: false,
    ariaLabel: 'Buscar em tudo',
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <label class="search">
    <svg
      class="search__icon"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
    <input
      class="search__input"
      type="search"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-label="ariaLabel"
      @input="onInput"
    >
  </label>
</template>

<style scoped>
.search {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0 12px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-3);
  transition: border-color 0.12s ease;
}

.search:focus-within {
  border-color: var(--accent);
}

.search__icon {
  flex: none;
  color: var(--text-3);
}

.search__input {
  flex: 1;
  min-width: 0;
  height: 36px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
}

.search__input::placeholder {
  color: var(--text-3);
}

/* Esconde o "x" nativo do type=search para manter o visual consistente. */
.search__input::-webkit-search-decoration,
.search__input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
}

.search__input:disabled {
  cursor: not-allowed;
}
</style>
