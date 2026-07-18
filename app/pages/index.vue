<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Dropzone from '~/components/Dropzone.vue'
import RecentFiles from '~/components/RecentFiles.vue'
import { useOpenFile } from '~/composables/useOpenFile'
import { useFilesStore } from '~/composables/useFilesStore'
import type { FileRecord } from '~/composables/useDatabase'

/**
 * Tela inicial de **Upload** (Fase 6).
 *
 * Título, selo de privacidade, dropzone (arrastar-e-soltar + seletor) e lista
 * de arquivos recentes reabríveis. O fluxo de abrir/reabrir vive em
 * {@link useOpenFile} (parsear → persistir → carregar → navegar ao Viewer).
 *
 * Ref de design: `.spec/init/design/README.md#screen-1--tela-inicial--upload`.
 */

definePageMeta({ pageTransition: { name: 'view', mode: 'out-in' } })

const { openFile, reopenRecent, error, isOpening } = useOpenFile({
  navigate: (path) => navigateTo(path),
})

const { listFiles, deleteFile } = useFilesStore()
const recents = ref<FileRecord[]>([])

/** Recarrega a lista de recentes do store `files`. */
async function refreshRecents(): Promise<void> {
  recents.value = await listFiles()
}

onMounted(refreshRecents)

async function onSelect(file: File): Promise<void> {
  const opened = await openFile(file)
  // Em falha, atualiza a lista (nada persistido) e mantém a tela na Upload.
  if (!opened) await refreshRecents()
}

async function onReopen(id: number): Promise<void> {
  await reopenRecent(id)
}

async function onDeleteRecent(id: number): Promise<void> {
  await deleteFile(id)
  await refreshRecents()
}
</script>

<template>
  <section class="upload">
    <div class="upload__main">
      <header class="upload__hero">
        <p class="upload__seal">
          <span class="upload__seal-dot" aria-hidden="true" />
          100% no navegador · seus dados não saem daqui
        </p>
        <h1 class="upload__title">
          O explorador de <span class="upload__title-accent">CSV</span><br>
          para quem vive nos dados
        </h1>
        <p class="upload__subtitle">
          Abra, filtre e analise arquivos CSV enormes direto no navegador —
          sem instalar nada e sem enviar seus dados para nenhum servidor.
        </p>

        <dl class="upload__stats">
          <div class="upload__stat">
            <dt class="upload__stat-value">2M+</dt>
            <dd class="upload__stat-label">linhas suportadas</dd>
          </div>
          <span class="upload__stat-divider" aria-hidden="true" />
          <div class="upload__stat">
            <dt class="upload__stat-value">0kb</dt>
            <dd class="upload__stat-label">enviados à rede</dd>
          </div>
          <span class="upload__stat-divider" aria-hidden="true" />
          <div class="upload__stat">
            <dt class="upload__stat-value">.csv .tsv</dt>
            <dd class="upload__stat-label">e .txt</dd>
          </div>
        </dl>
      </header>

      <Dropzone :disabled="isOpening" @select="onSelect" />

      <p v-if="error" class="upload__error" role="alert">
        {{ error }}
      </p>
    </div>

    <RecentFiles
      class="upload__recents"
      :files="recents"
      @open="onReopen"
      @delete="onDeleteRecent"
    />
  </section>
</template>

<style scoped>
/* Layout de duas colunas fiel ao design: à esquerda o hero + dropzone,
   à direita os arquivos recentes. Em telas estreitas, empilha. */
.upload {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  gap: 44px;
  align-items: start;
  padding: 24px 0;
  flex: 1;
  min-height: 0;
}

/* Só a coluna de recentes estica para a altura da linha do grid; o hero
   continua alinhado ao topo (align-items: start acima). Isso confina o
   scroll à lista quando há muitos arquivos recentes (ver .recents__list
   em RecentFiles.vue), em vez de rolar a tela inteira. */
.upload__recents {
  align-self: stretch;
  min-height: 0;
}

.upload__main {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.upload__hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  text-align: left;
}

.upload__title {
  /* clamp em vez de um valor fixo: encolhe para dar mais margem antes do
     limite de nowrap abaixo. white-space:nowrap não afasta o <br> forçado
     (ele sempre quebra) — só impede que "para quem vive nos dados" quebre
     de novo por falta de espaço. */
  font-size: clamp(30px, 3.6vw, 44px);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--text);
  white-space: nowrap;
}

/* "CSV" em destaque com texto em gradiente accent, fiel ao mock 1a. */
.upload__title-accent {
  background: linear-gradient(120deg, var(--accent-hover), var(--accent));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

.upload__subtitle {
  max-width: 44ch;
  font-size: 15px;
  line-height: 1.5;
  color: var(--text-2);
}

.upload__seal {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-2);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 5px 12px;
}

.upload__seal-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 10px var(--success);
  animation: upload-seal-pulse 2.4s ease-in-out infinite;
}

@keyframes upload-seal-pulse {
  0%, 100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  .upload__seal-dot {
    animation: none;
    opacity: 1;
  }
}

/* Faixa de estatísticas (2M+ linhas · 0kb enviados · formatos), fiel ao
   mock 1a — logo abaixo do subtítulo, antes da dropzone. */
.upload__stats {
  display: flex;
  align-items: center;
  gap: 22px;
  margin: 4px 0 0;
}

.upload__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.upload__stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--accent);
}

.upload__stat-label {
  margin: 0;
  font-size: 12px;
  color: var(--text-3);
}

.upload__stat-divider {
  width: 1px;
  height: 28px;
  background: var(--border);
}

.upload__error {
  padding: 10px 14px;
  font-size: 13px;
  color: var(--error);
  background: var(--error-soft);
  border: 1px solid var(--error);
  border-radius: var(--radius);
}

/* Empilha em telas estreitas: hero+dropzone e recentes um sobre o outro. */
@media (max-width: 900px) {
  .upload {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
    max-width: 640px;
    padding: 24px 0;
  }

  .upload__title {
    font-size: 34px;
    /* Empilhado (1 coluna) há espaço de sobra na vertical — deixa "para
       quem vive nos dados" quebrar normalmente em telas estreitas, em vez
       de arriscar overflow horizontal com nowrap. */
    white-space: normal;
  }

  .upload__stats {
    flex-wrap: wrap;
    gap: 14px 22px;
  }
}
</style>
