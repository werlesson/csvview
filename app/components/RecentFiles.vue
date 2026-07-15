<script setup lang="ts">
import type { FileRecord } from '~/composables/useDatabase'
import {
  formatBytes,
  formatRelativeTime,
  formatRowCount,
} from '~/services/formatFile'

/**
 * Lista de **arquivos recentes** da tela de Upload (Fase 6, US-4.1).
 *
 * Recebe os arquivos já ordenados (mais recente → mais antigo) e exibe
 * nome · nº de linhas · tamanho · "há quanto tempo". Sem itens, mostra o
 * estado vazio. Clicar num item emite `open` com o id (reabertura).
 *
 * Ref de design: `.spec/init/design/README.md#screen-1--tela-inicial--upload`.
 */
withDefaults(
  defineProps<{
    /** Arquivos recentes, já ordenados do mais recente ao mais antigo. */
    files?: FileRecord[]
  }>(),
  {
    files: () => [],
  },
)

const emit = defineEmits<{
  (e: 'open', id: number): void
}>()

function onOpen(id: number): void {
  emit('open', id)
}
</script>

<template>
  <section class="recents" aria-label="Arquivos recentes">
    <h2 class="recents__title">Arquivos recentes</h2>

    <ul v-if="files.length > 0" class="recents__list">
      <li v-for="file in files" :key="file.id">
        <button
          type="button"
          class="recent"
          @click="onOpen(file.id)"
        >
          <span class="recent__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
              <path
                d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
              <path
                d="M14 3v5h5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
            </svg>
          </span>

          <span class="recent__body">
            <span class="recent__name">{{ file.name }}</span>
            <span class="recent__meta">
              <span class="recent__rows">{{ formatRowCount(file.row_count) }} linhas</span>
              <span class="recent__sep" aria-hidden="true">·</span>
              <span class="recent__size">{{ formatBytes(file.size_bytes) }}</span>
            </span>
          </span>

          <span class="recent__time">{{ formatRelativeTime(file.last_opened_at) }}</span>
        </button>
      </li>
    </ul>

    <div v-else class="recents__empty">
      <p class="recents__empty-title">Nenhum arquivo recente</p>
      <p class="recents__empty-hint">
        Os arquivos que você abrir aparecem aqui para reabrir sem novo upload.
      </p>
    </div>
  </section>
</template>

<style scoped>
.recents {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recents__title {
  flex: none;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3);
}

/* Quando o pai (.upload__recents em index.vue) tem altura definida, a lista
   ocupa o espaço restante e ganha scroll próprio em vez de empurrar a
   página — só ela rola quando há muitos arquivos recentes. */
.recents__list {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 10px;
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
}

.recent {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  text-align: left;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}

.recent:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

/* Ícone de arquivo em quadrado arredondado, sempre na cor primária/accent
   do tema — independente da posição na lista (RF-05). */
.recent__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  color: var(--accent);
  background: var(--accent-soft);
}

.recent__body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.recent__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent__meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-3);
}

.recent__time {
  flex: none;
  align-self: flex-start;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-3);
}

.recents__empty {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 24px;
  text-align: center;
  background: var(--bg-1);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
}

.recents__empty-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-2);
}

.recents__empty-hint {
  font-size: 13px;
  color: var(--text-3);
}
</style>
