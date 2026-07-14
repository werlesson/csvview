<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '~/composables/useTheme'

/**
 * Alternador de tema (dark/light) do design system.
 *
 * Integra com o estado de tema compartilhado da Fase 1 (`useTheme`):
 * clicar alterna o tema e o botão reflete o estado atual (ícone + `aria-pressed`).
 *
 * Ref de design: `.spec/init/design/README.md` (Produto / header).
 * Traça o campo `theme` do store `settings`.
 */
const { theme, toggleTheme } = useTheme()

const isDark = computed(() => theme.value === 'dark')
const label = computed(() =>
  isDark.value ? 'Mudar para tema claro' : 'Mudar para tema escuro',
)
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-pressed="isDark"
    :aria-label="label"
    :title="label"
    :data-theme-state="theme"
    @click="toggleTheme"
  >
    <!-- Lua no dark, sol no light: o ícone reflete o tema atual. -->
    <svg
      v-if="isDark"
      class="theme-toggle__icon"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z"
        fill="currentColor"
      />
    </svg>
    <svg
      v-else
      class="theme-toggle__icon"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="3.2" fill="currentColor" />
      <g stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
        <line x1="8" y1="1" x2="8" y2="2.6" />
        <line x1="8" y1="13.4" x2="8" y2="15" />
        <line x1="1" y1="8" x2="2.6" y2="8" />
        <line x1="13.4" y1="8" x2="15" y2="8" />
        <line x1="3.05" y1="3.05" x2="4.2" y2="4.2" />
        <line x1="11.8" y1="11.8" x2="12.95" y2="12.95" />
        <line x1="3.05" y1="12.95" x2="4.2" y2="11.8" />
        <line x1="11.8" y1="4.2" x2="12.95" y2="3.05" />
      </g>
    </svg>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  color: var(--text-2);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.theme-toggle:hover {
  background: var(--bg-hover);
  color: var(--text);
  border-color: var(--border-strong);
}

.theme-toggle:focus-visible {
  outline: none;
  border-color: var(--accent);
}

.theme-toggle__icon {
  flex: none;
}
</style>
