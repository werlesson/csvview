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
        <h1 class="upload__title">O explorador de CSV para quem vive nos dados</h1>
        <p class="upload__subtitle">
          Abra, filtre e analise arquivos CSV enormes direto no navegador —
          sem instalar nada e sem enviar seus dados para nenhum servidor.
        </p>
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
  max-width: 1040px;
  margin: 0 auto;
  padding: 40px 0;
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
  gap: 24px;
}

.upload__hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  text-align: left;
}

.upload__title {
  font-size: 44px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.01em;
  color: var(--text);
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
  }
}
</style>
