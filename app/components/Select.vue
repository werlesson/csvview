<script setup lang="ts">
/**
 * Select base do design system.
 *
 * Ref de design: `.spec/init/design/README.md`
 * (Biblioteca de componentes → Inputs & select).
 *
 * Envolve um `<select>` nativo (acessível por teclado por natureza) e o
 * estiliza com os tokens do design. Suporta `v-model`. As `options` podem
 * ser strings simples ou objetos `{ label, value }`.
 */
export interface SelectOption {
  label: string
  value: string
}

withDefaults(
  defineProps<{
    modelValue?: string
    options?: Array<SelectOption | string>
    disabled?: boolean
    ariaLabel?: string
  }>(),
  {
    modelValue: '',
    options: () => [],
    disabled: false,
    ariaLabel: undefined,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

function optionValue(option: SelectOption | string): string {
  return typeof option === 'string' ? option : option.value
}

function optionLabel(option: SelectOption | string): string {
  return typeof option === 'string' ? option : option.label
}

function onChange(event: Event): void {
  emit('update:modelValue', (event.target as HTMLSelectElement).value)
}
</script>

<template>
  <div class="select">
    <select
      class="select__control"
      :value="modelValue"
      :disabled="disabled"
      :aria-label="ariaLabel"
      @change="onChange"
    >
      <slot>
        <option
          v-for="option in options"
          :key="optionValue(option)"
          :value="optionValue(option)"
        >
          {{ optionLabel(option) }}
        </option>
      </slot>
    </select>
    <svg
      class="select__chevron"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        points="4,6 8,10 12,6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>
</template>

<style scoped>
.select {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.select__control {
  appearance: none;
  -webkit-appearance: none;
  height: 36px;
  width: 100%;
  padding: 0 34px 0 12px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease;
}

.select__control:hover:not(:disabled) {
  background: var(--bg-hover);
}

.select__control:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--bg-1);
}

.select__control:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.select__chevron {
  position: absolute;
  right: 12px;
  color: var(--text-3);
  pointer-events: none;
}
</style>
