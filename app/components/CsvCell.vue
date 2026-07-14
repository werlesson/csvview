<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: string | number | null | undefined
  /**
   * Coluna numérica (tipo inferido na Fase 5): alinha à direita em fonte
   * monoespaçada, mantendo os dígitos tabulares (US-2.1).
   */
  numeric?: boolean
}>()

const display = computed(() =>
  props.value === null || props.value === undefined || props.value === ''
    ? '—'
    : String(props.value),
)

const isEmpty = computed(() => display.value === '—')
</script>

<template>
  <td
    class="csv-cell border-b border-gray-200 px-3 py-2 text-sm"
    :class="[
      isEmpty ? 'text-gray-400 italic' : 'text-gray-800',
      numeric ? 'csv-cell--numeric' : '',
    ]"
  >
    {{ display }}
  </td>
</template>

<style scoped>
/* Colunas numéricas: alinhadas à direita, em mono com dígitos tabulares. */
.csv-cell--numeric {
  text-align: right;
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
}
</style>
