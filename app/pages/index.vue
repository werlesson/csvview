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

const { openFile, reopenRecent, error, isOpening } = useOpenFile({
  navigate: (path) => navigateTo(path),
})

const { listFiles } = useFilesStore()
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
</script>

<template>
  <section class="upload">
    <header class="upload__hero">
      <h1 class="upload__title">Solte um CSV e comece a explorar.</h1>
      <p class="upload__seal">
        <span class="upload__seal-dot" aria-hidden="true" />
        100% no navegador · seus dados não saem daqui
      </p>
    </header>

    <Dropzone :disabled="isOpening" @select="onSelect" />

    <p v-if="error" class="upload__error" role="alert">
      {{ error }}
    </p>

    <RecentFiles :files="recents" @open="onReopen" />
  </section>
</template>

<style scoped>
.upload {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 640px;
  margin: 0 auto;
  padding: 32px 0;
}

.upload__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.upload__title {
  font-size: 34px;
  font-weight: 600;
  line-height: 1.15;
  color: var(--text);
}

.upload__seal {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: var(--radius-pill);
  padding: 4px 12px;
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
</style>
