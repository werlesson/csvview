<script setup lang="ts">
import { computed } from 'vue'

/**
 * Badge do design system.
 *
 * Ref de design: `.spec/init/design/README.md`
 * (Biblioteca de componentes → Badges & column chips).
 *
 * Variantes:
 * - `default` — neutro (superfície + texto secundário)
 * - `accent` — cor de destaque
 * - `settled` / `pending` / `failed` — status de transação (US-2.1, US-3.1)
 * - `info` — informativo
 *
 * Cada variante de status usa a cor de status e o fundo `-soft` correspondentes
 * definidos nos tokens.
 */
export type BadgeVariant =
  | 'default'
  | 'accent'
  | 'settled'
  | 'pending'
  | 'failed'
  | 'info'

const props = withDefaults(
  defineProps<{
    variant?: BadgeVariant
  }>(),
  {
    variant: 'default',
  },
)

const classes = computed(() => ['badge', `badge--${props.variant}`])
</script>

<template>
  <span :class="classes">
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

.badge--default {
  background: var(--bg-2);
  color: var(--text-2);
}

.badge--accent {
  background: var(--accent-soft);
  color: var(--accent);
}

/* settled → success */
.badge--settled {
  background: var(--success-soft);
  color: var(--success);
}

/* pending → warning */
.badge--pending {
  background: var(--warning-soft);
  color: var(--warning);
}

/* failed → error */
.badge--failed {
  background: var(--error-soft);
  color: var(--error);
}

.badge--info {
  background: var(--info-soft);
  color: var(--info);
}
</style>
