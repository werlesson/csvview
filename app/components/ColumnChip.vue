<script setup lang="ts">
/**
 * Chip de coluna do design system.
 *
 * Ref de design: `.spec/init/design/README.md`
 * (Biblioteca de componentes → Badges & column chips).
 *
 * Exibe o rótulo da coluna e o seu tipo (ex.: `date`, `amount`, `id`).
 * Base para o seletor de colunas do Viewer (US-2.3) e cabeçalhos da
 * tabela (US-2.1, US-3.1).
 */
export type ColumnType =
  | 'id'
  | 'date'
  | 'amount'
  | 'number'
  | 'text'
  | 'status'

withDefaults(
  defineProps<{
    /** Rótulo (nome) da coluna. */
    label: string
    /** Tipo inferido da coluna. */
    type?: ColumnType | string
    /** Coluna fixada (pinned) — variação vista no design (`id · pinned`). */
    pinned?: boolean
  }>(),
  {
    type: 'text',
    pinned: false,
  },
)
</script>

<template>
  <span class="chip" :class="{ 'chip--pinned': pinned }">
    <span class="chip__label">{{ label }}</span>
    <span class="chip__type">{{ type }}</span>
    <span v-if="pinned" class="chip__pin" aria-hidden="true">pinned</span>
  </span>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font);
  font-size: 12px;
  line-height: 1;
  padding: 5px 8px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  white-space: nowrap;
}

.chip--pinned {
  border-color: var(--accent);
}

.chip__label {
  font-weight: 500;
}

.chip__type {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-3);
}

.chip__pin {
  font-size: 11px;
  color: var(--accent);
}
</style>
