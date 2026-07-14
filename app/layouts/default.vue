<script setup lang="ts">
import { computed } from 'vue'
import { useCurrentDataset } from '~/composables/useCurrentDataset'

// Toggle de tema inline (a Fase 2 formaliza um componente ThemeToggle
// dedicado; aqui garantimos um controle presente e funcional no header).
const { theme, toggleTheme } = useTheme()

const isDark = computed(() => theme.value === 'dark')

// Na barra de título, exibimos o nome do arquivo quando estamos no Viewer
// (fiel ao design da Screen 2); nas demais rotas, a marca do produto.
const route = useRoute()
const { meta } = useCurrentDataset()
const currentFile = computed(() =>
  route.path === '/viewer' ? (meta.value?.name ?? null) : null,
)
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-header__inner">
        <a v-if="currentFile" class="brand" href="/" :title="`${currentFile} — voltar ao início`">
          <span class="brand__file">{{ currentFile }}</span>
        </a>
        <a v-else class="brand" href="/">
          <span class="brand__mark">csvview.app</span>
          <span class="brand__badge">100% no navegador</span>
        </a>

        <button
          type="button"
          class="theme-toggle"
          :aria-pressed="isDark"
          :title="isDark ? 'Tema escuro' : 'Tema claro'"
          aria-label="Alternar tema"
          @click="toggleTheme"
        >
          {{ isDark ? '☾' : '☀' }}
        </button>
      </div>
    </header>

    <main class="app-content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
}

.app-header__inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text);
}

.brand__mark {
  font-family: var(--mono);
  font-weight: 600;
  font-size: 15px;
}

/* Nome do arquivo na barra de título (Viewer). */
.brand__file {
  font-family: var(--mono);
  font-weight: 600;
  font-size: 15px;
  color: var(--text);
}

.brand__badge {
  font-size: 12px;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: var(--radius-pill);
  padding: 2px 10px;
  white-space: nowrap;
}

.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  font-size: 15px;
  color: var(--text-2);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
}

.theme-toggle:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.app-content {
  flex: 1;
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 20px;
}

/* Responsivo: reduz gaps e esconde o selo em telas estreitas. */
@media (max-width: 640px) {
  .app-header__inner,
  .app-content {
    padding-left: 14px;
    padding-right: 14px;
  }

  .brand__badge {
    display: none;
  }
}
</style>
