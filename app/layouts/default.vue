<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import LogoMark from '~/components/LogoMark.vue'
import ThemeToggle from '~/components/ThemeToggle.vue'
import UnsavedChangesModal from '~/components/UnsavedChangesModal.vue'
import SaveCopyModal from '~/components/SaveCopyModal.vue'
import { useCurrentDataset } from '~/composables/useCurrentDataset'
import { useUnsavedChangesGuard } from '~/composables/useUnsavedChangesGuard'

// Na barra de título, exibimos o nome do arquivo quando estamos no Viewer
// (fiel ao design da Screen 2); nas demais rotas, a marca do produto.
const route = useRoute()
const { meta } = useCurrentDataset()
const isViewer = computed(() => route.path === '/viewer')
const isUpload = computed(() => route.path === '/')
// Viewer/Compare têm tabelas virtualizadas (@tanstack/vue-virtual) cujo
// scroller mede a altura do ancestral (`.app-content`) — precisam do shell
// com altura travada (100dvh) para o scroll ficar confinado à tabela. Só a
// Upload não precisa: o footer aí segue o fluxo normal da página.
const isBoundedContent = computed(() => route.path !== '/')
const currentFile = computed(() =>
  isViewer.value ? (meta.value?.name ?? null) : null,
)
const currentYear = new Date().getFullYear()

/**
 * Guarda de saída do Viewer com edições pendentes (mesmo composable
 * consumido por `viewer.vue` para o "Comparar") — o modal vive aqui, no
 * layout, por ser o ancestral comum a todas as rotas.
 */
const {
  isOpen: showUnsavedChanges,
  showSaveCopyModal,
  suggestedCopyName,
  fileName: unsavedFileName,
  canOverwrite,
  isBusy: isSavingBeforeLeave,
  guardNavigation,
  openSaveCopyModal,
  cancelSaveCopyModal,
  confirmSaveCopy,
  confirmOverwrite,
  discard,
  cancel,
} = useUnsavedChangesGuard()

// Navegação client-side ao clicar na logo/voltar: evita o reload de página
// inteira de um <a href> puro, para que a transição "view" (fade, RF-07)
// realmente seja reproduzida ao sair do Viewer — passa pelo guard de
// alterações não salvas antes de navegar de fato.
function goHome(event: MouseEvent): void {
  event.preventDefault()
  guardNavigation('/')
}

/**
 * Header nasce transparente (revela o glow do shell) e ganha fundo sólido
 * depois de ~70px de scroll — precisa observar tanto a janela (Upload, onde
 * a página inteira rola) quanto `.app-content` (Viewer/Compare, onde é esse
 * elemento que rola dentro do shell travado em 100dvh).
 */
const HEADER_SCROLL_THRESHOLD = 60
const contentRef = ref<HTMLElement | null>(null)
const isHeaderScrolled = ref(false)

function updateHeaderScrolled(): void {
  const contentScrollTop = contentRef.value?.scrollTop ?? 0
  const windowScrollTop = window.scrollY
  isHeaderScrolled.value = Math.max(contentScrollTop, windowScrollTop) > HEADER_SCROLL_THRESHOLD
}

onMounted(() => {
  window.addEventListener('scroll', updateHeaderScrolled, { passive: true })
  contentRef.value?.addEventListener('scroll', updateHeaderScrolled, { passive: true })
  updateHeaderScrolled()
})

onUnmounted(() => {
  window.removeEventListener('scroll', updateHeaderScrolled)
  contentRef.value?.removeEventListener('scroll', updateHeaderScrolled)
})

// Ao trocar de rota o scroll do novo elemento pode já começar em outro
// ponto (ex.: volta pro Upload no topo) — recalcula sem esperar um scroll.
watch(
  () => route.path,
  () => nextTick(updateHeaderScrolled),
)
</script>

<template>
  <div
    class="app-shell"
    :class="{ 'app-shell--glow': isUpload, 'app-shell--bounded': isBoundedContent }"
  >
    <header class="app-header" :class="{ 'app-header--scrolled': isHeaderScrolled }">
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

        <div class="app-header__actions">
          <span class="app-header__version">v2.4</span>
          <ThemeToggle />
        </div>
      </div>
    </header>

    <main
      ref="contentRef"
      class="app-content"
      :class="{ 'app-content--wide': isViewer, 'app-content--bounded': isBoundedContent }"
    >
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

    <UnsavedChangesModal
      :open="showUnsavedChanges"
      :file-name="unsavedFileName"
      :can-overwrite="canOverwrite"
      :busy="isSavingBeforeLeave"
      @save-copy="openSaveCopyModal"
      @overwrite="confirmOverwrite"
      @discard="discard"
      @close="cancel"
    />

    <SaveCopyModal
      :open="showSaveCopyModal"
      :file-name="unsavedFileName"
      :suggested-name="suggestedCopyName"
      :busy="isSavingBeforeLeave"
      @confirm="confirmSaveCopy"
      @close="cancelSaveCopyModal"
    />
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  isolation: isolate;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
}

/* Viewer/Compare: altura travada na viewport, para o scroll ficar confinado
   à tabela (.app-content flex:1 + overflow-y:auto vira uma janela de altura
   fixa). Upload: sem essa classe, o shell só cresce (min-height acima) e o
   footer segue o fluxo normal — a página toda rola se precisar. */
.app-shell--bounded {
  height: 100dvh;
}

/* Fundo do sistema todo (todas as rotas) — vive no shell (não na página)
   para se estender até a borda real da viewport, e não ficar confinado à
   largura do conteúdo. Posição do glow fiel ao mock "1a · Split editorial";
   a cor usa --accent-soft (em vez do roxo fixo do mock) para o glow ficar no
   mesmo tom do resto da paleta (botão Exportar, badge "dup", toggle de
   tema) — dark e claro seguem a mesma regra, só os tokens mudam de valor. */
.app-shell::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(1100px 560px at 78% -8%, var(--glow), transparent 60%),
    var(--bg);
}

/* Fundo transparente em todas as rotas, para o fundo do shell
   (.app-shell::before) atravessar o header por igual em qualquer página —
   até passar de ~60px de scroll (ver `isHeaderScrolled`), quando ganha um
   fundo translúcido com leve desfoque (efeito "vidro"), pra continuar
   legível sobre o conteúdo que passa a rolar por baixo dele. A borda
   inferior fica sempre visível, independente do scroll. */
.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: transparent;
  border-bottom: 1px solid var(--border);
  transition: background-color 0.25s ease, backdrop-filter 0.25s ease, box-shadow 0.25s ease;
}

.app-header--scrolled {
  background: color-mix(in srgb, var(--bg-1) 85%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow);
}

@media (prefers-reduced-motion: reduce) {
  .app-header {
    transition: none;
  }
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

.app-header__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-header__version {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-3);
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
  display: flex;
  flex-direction: column;
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 20px;
}

/* Só Viewer/Compare: vira uma janela de altura fixa (o shell tem
   height:100dvh nessa rota) para o scroll ficar confinado à tabela. */
.app-content--bounded {
  min-height: 0;
  overflow-y: auto;
}

.app-content--wide {
  max-width: none;
}

.app-footer {
  border-top: 1px solid var(--border);
  background: var(--bg-1);
}

.app-shell--glow .app-footer {
  background: transparent;
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
