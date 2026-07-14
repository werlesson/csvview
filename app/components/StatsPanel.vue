<script setup lang="ts">
import { computed } from 'vue'
import StatsHistogram from '~/components/StatsHistogram.vue'
import { formatRowCount } from '~/services/formatFile'
import type { ColumnStats, ColumnType } from '~/services/columnStats'

/**
 * Painel de estatísticas de uma coluna do Viewer (Fase 8, US-3.1).
 *
 * Apresentacional: consome o {@link ColumnStats} já calculado pelo motor da
 * Fase 5 e exibe o tipo inferido, as quatro métricas gerais (nulos, únicos,
 * duplicados, preenchido) e — apenas para colunas numéricas — mínimo, máximo,
 * média e o mini-histograma de distribuição. Trocar a coluna selecionada
 * apenas troca as props: o painel reflete sempre a coluna atual.
 *
 * Sem coluna selecionada (`stats` nulo), exibe um estado vazio convidando a
 * selecionar uma coluna.
 *
 * Ref de design: `.spec/init/design/README.md#screen-2--visualizador-principal`.
 */
const props = defineProps<{
  /** Nome da coluna selecionada; `null` quando não há seleção. */
  label: string | null
  /** Estatísticas da coluna (Fase 5); `null` quando não há seleção. */
  stats: ColumnStats | null
}>()

/** Rótulos em pt para o tipo inferido, fiéis ao painel (`número`/`data`/`texto`). */
const TYPE_LABELS: Record<ColumnType, string> = {
  number: 'número',
  date: 'data',
  text: 'texto',
}

const hasSelection = computed(() => props.stats !== null)

const typeLabel = computed(() =>
  props.stats ? TYPE_LABELS[props.stats.type] : '',
)

/** As métricas numéricas só existem quando o tipo inferido é `number`. */
const numeric = computed(() => props.stats?.numeric ?? null)

/** Formata uma métrica numérica (min/máx/média) com até 4 casas decimais. */
function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 })
}
</script>

<template>
  <aside class="stats-panel" aria-label="Estatísticas da coluna">
    <div v-if="hasSelection && stats" class="stats-panel__content">
      <header class="stats-panel__header">
        <h2 class="stats-panel__title">{{ label }}</h2>
        <span class="stats-panel__type" data-type="type">{{ typeLabel }}</span>
      </header>

      <dl class="stats-panel__metrics">
        <div class="stats-panel__metric" data-metric="nulls">
          <dt class="stats-panel__metric-label">Nulos</dt>
          <dd class="stats-panel__metric-value">{{ formatRowCount(stats.nulls) }}</dd>
        </div>
        <div class="stats-panel__metric" data-metric="unique">
          <dt class="stats-panel__metric-label">Únicos</dt>
          <dd class="stats-panel__metric-value">{{ formatRowCount(stats.unique) }}</dd>
        </div>
        <div class="stats-panel__metric" data-metric="duplicates">
          <dt class="stats-panel__metric-label">Duplicados</dt>
          <dd class="stats-panel__metric-value">{{ formatRowCount(stats.duplicates) }}</dd>
        </div>
        <div class="stats-panel__metric" data-metric="filled">
          <dt class="stats-panel__metric-label">Preenchido</dt>
          <dd class="stats-panel__metric-value">{{ formatRowCount(stats.filled) }}</dd>
        </div>
      </dl>

      <template v-if="numeric">
        <dl class="stats-panel__metrics stats-panel__metrics--numeric">
          <div class="stats-panel__metric" data-metric="min">
            <dt class="stats-panel__metric-label">Mínimo</dt>
            <dd class="stats-panel__metric-value">{{ formatNumber(numeric.min) }}</dd>
          </div>
          <div class="stats-panel__metric" data-metric="max">
            <dt class="stats-panel__metric-label">Máximo</dt>
            <dd class="stats-panel__metric-value">{{ formatNumber(numeric.max) }}</dd>
          </div>
          <div class="stats-panel__metric" data-metric="mean">
            <dt class="stats-panel__metric-label">Média</dt>
            <dd class="stats-panel__metric-value">{{ formatNumber(numeric.mean) }}</dd>
          </div>
        </dl>

        <section class="stats-panel__distribution" data-section="histogram">
          <h3 class="stats-panel__subtitle">Distribuição</h3>
          <StatsHistogram :bins="numeric.histogram" />
        </section>
      </template>
    </div>

    <div v-else class="stats-panel__empty" role="status">
      <p class="stats-panel__empty-title">Nenhuma coluna selecionada</p>
      <p class="stats-panel__empty-hint">
        Selecione uma coluna na tabela para ver suas estatísticas.
      </p>
    </div>
  </aside>
</template>

<style scoped>
.stats-panel {
  display: flex;
  flex-direction: column;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
}

.stats-panel__content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.stats-panel__title {
  font-family: var(--mono);
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stats-panel__type {
  flex: none;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

.stats-panel__metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin: 0;
}

.stats-panel__metrics--numeric {
  grid-template-columns: repeat(3, 1fr);
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.stats-panel__metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stats-panel__metric-label {
  font-size: 12px;
  color: var(--text-3);
}

.stats-panel__metric-value {
  margin: 0;
  font-family: var(--mono);
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}

.stats-panel__distribution {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.stats-panel__subtitle {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}

.stats-panel__empty {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
  padding: 24px 12px;
}

.stats-panel__empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.stats-panel__empty-hint {
  font-size: 13px;
  color: var(--text-3);
}
</style>
