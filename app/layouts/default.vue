<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import LogoMark from '~/components/LogoMark.vue'
import ThemeToggle from '~/components/ThemeToggle.vue'
import { useCurrentDataset } from '~/composables/useCurrentDataset'

// Na barra de título, exibimos o nome do arquivo quando estamos no Viewer
// (fiel ao design da Screen 2); nas demais rotas, a marca do produto.
const route = useRoute()
const { meta } = useCurrentDataset()
const isViewer = computed(() => route.path === '/viewer')
const isUpload = computed(() => route.path === '/')
const currentFile = computed(() =>
  isViewer.value ? (meta.value?.name ?? null) : null,
)
const currentYear = new Date().getFullYear()

// Navegação client-side ao clicar na logo/voltar: evita o reload de página
// inteira de um <a href> puro, para que a transição "view" (fade, RF-07)
// realmente seja reproduzida ao sair do Viewer.
function goHome(event: MouseEvent): void {
  event.preventDefault()
  navigateTo('/')
}
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--glow': isUpload }">
    <header class="app-header">
      <div class="app-header__inner">
        <div class="brand-group">
          <a
            v-if="isViewer"
            class="back-button"
            href="/"
            aria-label="Voltar para a tela inicial"
            title="Voltar"
            @click="goHome"
          >
            <svg
              viewBox="0 0 16 16"
              width="16"
              height="16"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M9.5 3.5 5 8l4.5 4.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </a>

          <a class="brand" href="/" @click="goHome">
            <LogoMark />
          </a>

          <template v-if="currentFile">
            <span class="brand__divider" aria-hidden="true" />
            <span class="brand__file" :title="currentFile">{{ currentFile }}</span>
          </template>
        </div>

        <ThemeToggle />
      </div>
    </header>

    <main class="app-content" :class="{ 'app-content--wide': isViewer }">
      <slot />
    </main>

    <footer class="app-footer">
      <div class="app-footer__inner">
        <span>&copy; {{ currentYear }} Todos os direitos reservados.</span>
        <div class="app-footer__links">
          <a
            class="app-footer__link"
            href="https://www.linkedin.com/in/werlesson/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ver perfil no LinkedIn"
            title="LinkedIn"
          >
            <svg
              viewBox="0 0 16 16"
              width="16"
              height="16"
              aria-hidden="true"
              focusable="false"
            >
              <path
                fill="currentColor"
                d="M3.65 5.79H.6V15.4h3.05V5.79ZM2.13.6A1.77 1.77 0 0 0 .35 2.37
                   c0 .97.78 1.77 1.76 1.77h.02a1.77 1.77 0 1 0 0-3.54ZM15.4 9.95
                   c0-3.06-1.63-4.48-3.81-4.48-1.76 0-2.54.97-2.98 1.65V5.79H5.56
                   c.04.86 0 9.61 0 9.61h3.05v-5.37c0-.29.02-.57.11-.78.23-.57.77-1.17
                   1.67-1.17 1.18 0 1.65.9 1.65 2.21v5.11h3.05l.31-5.45Z"
              />
            </svg>
          </a>
          <a
            class="app-footer__link"
            href="https://github.com/werlesson/csvview"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ver repositório no GitHub"
            title="GitHub"
          >
            <svg
              viewBox="0 0 16 16"
              width="16"
              height="16"
              aria-hidden="true"
              focusable="false"
            >
              <path
                fill="currentColor"
                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                   0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
                   -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
                   .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
                   -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0
                   1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
                   1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01
                   1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
              />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  isolation: isolate;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
}

/* Glows radiais sutis no fundo da tela de Upload — vivem no shell (não na
   página) para se estenderem até a borda real da viewport, e não ficarem
   confinados à largura do conteúdo (.upload, max-width 1040px). Header e
   footer têm fundo opaco (--bg-1), então os glows só aparecem atrás do
   conteúdo central, como pretendido. Todas as camadas usam a cor primária
   (--accent) — só a marca, sem cores de status (info/success) — variando
   posição/tamanho pra dar profundidade. */
.app-shell--glow::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(760px 520px at 30% -8%, var(--accent-soft), transparent 70%),
    radial-gradient(620px 480px at 88% 100%, var(--accent-soft), transparent 70%);
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

.brand-group {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

/* Botão de voltar à tela inicial, ao lado do logo (Viewer). */
.back-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  color: var(--text-2);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.back-button:hover {
  background: var(--bg-hover);
  color: var(--text);
  border-color: var(--border-strong);
}

.back-button:focus-visible {
  outline: none;
  border-color: var(--accent);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.brand:hover {
  opacity: 0.85;
}

.brand:active {
  transform: scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .brand {
    transition: none;
  }
}

/* Separador vertical entre o logo e o nome do arquivo (Viewer). */
.brand__divider {
  width: 1px;
  height: 20px;
  background: var(--border);
  flex-shrink: 0;
}

/* Nome do arquivo na barra de título (Viewer), ao lado do logo. */
.brand__file {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--mono);
  font-weight: 600;
  font-size: 15px;
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

.app-footer {
  border-top: 1px solid var(--border);
  background: var(--bg-1);
}

.app-footer__inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font-size: 13px;
  color: var(--text-2);
}

.app-footer__links {
  display: flex;
  align-items: center;
  gap: 14px;
}

.app-footer__link {
  display: inline-flex;
  align-items: center;
  color: var(--text-2);
  text-decoration: none;
  transition: color 0.12s ease;
}

.app-footer__link:hover {
  color: var(--text);
}

.app-footer__link:focus-visible {
  outline: none;
  color: var(--accent);
}

/* Responsivo: reduz gaps em telas estreitas. */
@media (max-width: 640px) {
  .app-header__inner,
  .app-content,
  .app-footer__inner {
    padding-left: 14px;
    padding-right: 14px;
  }
}
</style>
