<script setup lang="ts">
import { computed } from 'vue'
import { isEmptyCell } from '~/services/columnStats'

const props = defineProps<{
  value: string | number | null | undefined
  /**
   * Coluna numérica (tipo inferido na Fase 5): alinha à direita em fonte
   * monoespaçada, mantendo os dígitos tabulares (US-2.1).
   */
  numeric?: boolean
  /**
   * Célula da coluna atualmente selecionada (painel de stats aberto): recebe um
   * leve realce de fundo, alinhado ao destaque do cabeçalho.
   */
  selected?: boolean
}>()

const isEmpty = computed(() => isEmptyCell(props.value))

const display = computed(() => (isEmpty.value ? 'empty' : String(props.value)))
</script>

<template>
  <td
    class="csv-cell"
    :class="[
      isEmpty ? 'csv-cell--empty' : '',
      numeric ? 'csv-cell--numeric' : '',
      selected ? 'csv-cell--selected' : '',
    ]"
    :title="isEmpty ? undefined : display"
  >
    <span v-if="isEmpty" class="csv-cell__empty-label">{{ display }}</span>
    <template v-else>{{ display }}</template>
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
  /* Divisor vertical entre colunas (cara de grade, fiel ao design). */
  border-right: 1px solid var(--border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}

/* Célula vazia: padrão hachurado (listras diagonais) + rótulo "empty" (RF-01). */
.csv-cell--empty {
  position: relative;
  background-image: repeating-linear-gradient(
    45deg,
    var(--border) 0,
    var(--border) 4px,
    var(--bg-2) 4px,
    var(--bg-2) 8px
  );
}

.csv-cell__empty-label {
  display: block;
  width: 100%;
  text-align: center;
  color: var(--text-3);
  font-style: italic;
}

/* Colunas numéricas: alinhadas à direita, em mono com dígitos tabulares. */
.csv-cell--numeric {
  text-align: right;
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
}

/* Coluna selecionada (painel de stats aberto): faixa accent na coluna, alinhada
   ao destaque do cabeçalho. */
.csv-cell--selected {
  background: var(--accent-soft);
  border-right-color: var(--accent);
  border-left: 1px solid var(--accent);
}
</style>
