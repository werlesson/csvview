<script setup lang="ts">
/**
 * Legenda fixa dos 4 tipos de destaque automático da tabela (UI-01).
 *
 * Componente apresentacional, sem lógica de negócio: os 4 pares
 * swatch+rótulo são sempre os mesmos, sem props dinâmicas (RF-06 — sem
 * toggle nesta fase). Referência visual: `.spec/init/design/screen-5-highlights.png`.
 */
</script>

<template>
  <div class="highlight-legend">
    <span class="highlight-legend__item">
      <span class="highlight-legend__swatch highlight-legend__swatch--empty" />
      <span class="highlight-legend__label">vazio</span>
    </span>
    <span class="highlight-legend__item">
      <span class="highlight-legend__swatch highlight-legend__swatch--duplicate" />
      <span class="highlight-legend__label">duplicado</span>
    </span>
    <span class="highlight-legend__item">
      <span class="highlight-legend__swatch highlight-legend__swatch--negative" />
      <span class="highlight-legend__label">negativo</span>
    </span>
    <span class="highlight-legend__item">
      <span class="highlight-legend__swatch highlight-legend__swatch--invalid-date" />
      <span class="highlight-legend__label">data inválida</span>
    </span>
  </div>
</template>

<style scoped>
.highlight-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 20px;
  padding: 10px 12px;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
}

.highlight-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-2);
}

.highlight-legend__swatch {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: var(--radius-sm, 4px);
  box-sizing: border-box;
}

.highlight-legend__swatch--empty {
  background-image: repeating-linear-gradient(
    45deg,
    var(--border) 0,
    var(--border) 3px,
    var(--bg-2) 3px,
    var(--bg-2) 6px
  );
  border: 1px solid var(--border);
}

.highlight-legend__swatch--duplicate {
  border: 1.5px solid var(--accent);
  background: var(--accent-soft);
}

.highlight-legend__swatch--negative {
  border: 1.5px solid var(--error);
  background: var(--error-soft);
}

.highlight-legend__swatch--invalid-date {
  border: 1.5px solid var(--warning);
  background: var(--warning-soft);
}
</style>
