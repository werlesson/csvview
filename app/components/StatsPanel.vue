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

/**
 * Percentual de células preenchidas (fiel ao design: "Preenchido 99.8%").
 * Base = preenchidas + nulas; sem células, 0%.
 */
const filledPercent = computed(() => {
  const stats = props.stats
  if (!stats) return '0%'
  const total = stats.filled + stats.nulls
  if (total === 0) return '0%'
  const pct = (stats.filled / total) * 100
  const text = pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)
  return `${text}%`
})

/** Formata uma métrica numérica (min/máx/média) com até 4 casas decimais. */
function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

/** Classe de sinal para colorir min/máx/média (negativo → erro, positivo → sucesso). */
function signClass(value: number): string {
  if (value < 0) return 'is-negative'
  if (value > 0) return 'is-positive'
  return ''
}
</script>

<template>
  <aside class="stats-panel" aria-label="Estatísticas da coluna">
    <div v-if="hasSelection && stats" class="stats-panel__content">
      <p class="stats-panel__eyebrow">Estatísticas da coluna</p>

      <header class="stats-panel__header">
        <span class="stats-panel__hash" aria-hidden="true">#</span>
        <h2 class="stats-panel__title">{{ label }}</h2>
        <span class="stats-panel__type" data-type="type">{{ typeLabel }}</span>
      </header>

      <dl class="stats-panel__metrics">
        <div class="stats-panel__card" data-metric="nulls">
          <dt class="stats-panel__card-label">Nulos</dt>
          <dd class="stats-panel__card-value">{{ formatRowCount(stats.nulls) }}</dd>
        </div>
        <div class="stats-panel__card" data-metric="unique">
          <dt class="stats-panel__card-label">Únicos</dt>
          <dd class="stats-panel__card-value">{{ formatRowCount(stats.unique) }}</dd>
        </div>
        <div class="stats-panel__card" data-metric="duplicates">
          <dt class="stats-panel__card-label">Duplicados</dt>
          <dd
            class="stats-panel__card-value"
            :class="{ 'is-warning': stats.duplicates > 0 }"
          >{{ formatRowCount(stats.duplicates) }}</dd>
        </div>
        <div class="stats-panel__card" data-metric="filled">
          <dt class="stats-panel__card-label">Preenchido</dt>
          <dd class="stats-panel__card-value is-positive">
            {{ filledPercent }}
            <span class="stats-panel__card-sub">({{ formatRowCount(stats.filled) }})</span>
          </dd>
        </div>
      </dl>

      <template v-if="numeric">
        <dl class="stats-panel__rows">
          <div class="stats-panel__row" data-metric="min">
            <dt class="stats-panel__row-label">Mínimo</dt>
            <dd class="stats-panel__row-value" :class="signClass(numeric.min)">
              {{ formatNumber(numeric.min) }}
            </dd>
          </div>
          <div class="stats-panel__row" data-metric="max">
            <dt class="stats-panel__row-label">Máximo</dt>
            <dd class="stats-panel__row-value" :class="signClass(numeric.max)">
              {{ formatNumber(numeric.max) }}
            </dd>
          </div>
          <div class="stats-panel__row" data-metric="mean">
            <dt class="stats-panel__row-label">Média</dt>
            <dd class="stats-panel__row-value" :class="signClass(numeric.mean)">
              {{ formatNumber(numeric.mean) }}
            </dd>
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
/* Parte da superfície unificada do Viewer: colado à direita da tabela, separado
   só por uma linha de 1px (sem card/raio próprios). Preenche a altura e rola
   internamente se as estatísticas passarem do espaço disponível. */
.stats-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  background: var(--bg-1);
  border-left: 1px solid var(--border);
  padding: 16px;
}

/* Empilhado em telas estreitas: o divisor passa para o topo. */
@media (max-width: 900px) {
  .stats-panel {
    height: auto;
    border-left: none;
    border-top: 1px solid var(--border);
  }
}

.stats-panel__content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Eyebrow — título de seção do painel, em maiúsculas discretas. */
.stats-panel__eyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3);
}

.stats-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stats-panel__hash {
  font-family: var(--mono);
  font-size: 17px;
  font-weight: 600;
  color: var(--text-3);
}

.stats-panel__title {
  flex: 1;
  min-width: 0;
  font-family: var(--mono);
  font-size: 17px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Badge de tipo em pílula com contorno (fiel ao design). */
.stats-panel__type {
  flex: none;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--accent);
  background: transparent;
  border: 1px solid var(--accent);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
}

/* Métricas gerais em cartões 2×2 com borda. */
.stats-panel__metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin: 0;
}

.stats-panel__card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.stats-panel__card-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-3);
}

.stats-panel__card-value {
  margin: 0;
  font-family: var(--mono);
  font-size: 19px;
  font-weight: 600;
  color: var(--text);
}

.stats-panel__card-sub {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

/* Mín/Máx/Média em linhas rótulo–valor (fiel ao design). */
.stats-panel__rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.stats-panel__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.stats-panel__row-label {
  font-size: 13px;
  color: var(--text-2);
}

.stats-panel__row-value {
  margin: 0;
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

/* Coloração por sinal / status, compartilhada por cartões e linhas. */
.is-positive {
  color: var(--success);
}

.is-negative {
  color: var(--error);
}

.is-warning {
  color: var(--warning);
}

.stats-panel__distribution {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.stats-panel__subtitle {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3);
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
