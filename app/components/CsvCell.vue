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
    class="csv-cell"
    :class="[
      isEmpty ? 'csv-cell--empty' : '',
      numeric ? 'csv-cell--numeric' : '',
    ]"
    :title="isEmpty ? undefined : display"
  >
    {{ display }}
  </td>
</template>

<style scoped>
/*
 * Célula de **linha única**: a virtualização assume altura fixa (ROW_HEIGHT em
 * ViewerTable), então o conteúdo NUNCA pode quebrar linha — senão a linha cresce
 * e se sobrepõe às vizinhas. Texto longo é truncado com reticências; o valor
 * completo fica no `title` (tooltip no hover).
 */
.csv-cell {
  width: var(--col-w, 180px);
  height: 40px;
  padding: 0 12px;
  font-size: 13px;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}

/* Célula vazia (—): tom apagado, itálico. */
.csv-cell--empty {
  color: var(--text-3);
  font-style: italic;
}

/* Colunas numéricas: alinhadas à direita, em mono com dígitos tabulares. */
.csv-cell--numeric {
  text-align: right;
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
}
</style>
