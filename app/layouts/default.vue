<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import LogoMark from '~/components/LogoMark.vue'
import { useCurrentDataset } from '~/composables/useCurrentDataset'
import { useTheme } from '~/composables/useTheme'

// Toggle de tema inline (a Fase 2 formaliza um componente ThemeToggle
// dedicado; aqui garantimos um controle presente e funcional no header).
const { theme, toggleTheme } = useTheme()

const isDark = computed(() => theme.value === 'dark')

// Na barra de título, exibimos o nome do arquivo quando estamos no Viewer
// (fiel ao design da Screen 2); nas demais rotas, a marca do produto.
const route = useRoute()
const { meta } = useCurrentDataset()
const isViewer = computed(() => route.path === '/viewer')
const currentFile = computed(() =>
  isViewer.value ? (meta.value?.name ?? null) : null,
)
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-header__inner" :class="{ 'app-header__inner--wide': isViewer }">
        <a class="brand" href="/">
          <LogoMark />
        </a>

        <span v-if="currentFile" class="brand__file" :title="currentFile">{{ currentFile }}</span>

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

    <main class="app-content" :class="{ 'app-content--wide': isViewer }">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  height: 100dvh;
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

/* No Viewer, header e conteúdo usam a largura total (só o respiro lateral),
   aproveitando o espaço horizontal; o filename fica alinhado à borda do card. */
.app-header__inner--wide {
  max-width: none;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text);
}

/* Nome do arquivo na barra de título (Viewer), ao lado do logo. */
.brand__file {
  margin-left: auto;
  font-family: var(--mono);
  font-weight: 600;
  font-size: 15px;
  color: var(--text);
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
  min-height: 0;
  display: flex;
  flex-direction: column;
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 20px;
  overflow-y: auto;
}

.app-content--wide {
  max-width: none;
}

/* Responsivo: reduz gaps em telas estreitas. */
@media (max-width: 640px) {
  .app-header__inner,
  .app-content {
    padding-left: 14px;
    padding-right: 14px;
  }
}
</style>
