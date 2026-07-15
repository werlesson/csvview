<script setup lang="ts">
import { computed } from 'vue'
import type { HistogramBin } from '~/services/columnStats'

/**
 * Mini-histograma de distribuição de uma coluna numérica (Fase 8, US-3.1).
 *
 * Renderiza uma barra por bin da Fase 5, com altura proporcional ao maior
 * `count` da distribuição. É puramente apresentacional: recebe os bins já
 * calculados pelo motor de estatísticas e não faz nenhum cálculo de negócio.
 *
 * Ref de design: `.spec/init/design/README.md#screen-2--visualizador-principal`.
 */
const props = defineProps<{
  /** Bins da distribuição, na ordem do motor da Fase 5. */
  bins: HistogramBin[]
}>()

/** Maior contagem entre os bins — referência de 100% da altura das barras. */
const maxCount = computed(() =>
  props.bins.reduce((max, bin) => Math.max(max, bin.count), 0),
)

/** Altura percentual de cada barra (mínimo 2% para um bin não vazio ficar visível). */
function barHeight(count: number): string {
  if (maxCount.value === 0) return '0%'
  if (count === 0) return '0%'
  const pct = (count / maxCount.value) * 100
  return `${Math.max(2, pct)}%`
}

/** Faixa da barra, para o `title` (tooltip nativo). */
function barLabel(bin: HistogramBin): string {
  return `${bin.start} – ${bin.end}: ${bin.count}`
}
</script>

<template>
  <div class="histogram" role="img" aria-label="Distribuição da coluna">
    <div
      v-for="(bin, i) in bins"
      :key="i"
      class="histogram__bar"
      :class="{ 'histogram__bar--peak': bin.count === maxCount && maxCount > 0 }"
      :style="{ height: barHeight(bin.count) }"
      :title="barLabel(bin)"
      :data-count="bin.count"
    />
  </div>
</template>

<style scoped>
.histogram {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 56px;
  padding: 4px 0;
}

.histogram__bar {
  flex: 1;
  min-width: 2px;
  background: var(--accent);
  opacity: 0.55;
  border-radius: 2px 2px 0 0;
  transition: height 0.15s ease;
}

/* Barra mais alta em destaque, como no design. */
.histogram__bar--peak {
  opacity: 1;
}
</style>
