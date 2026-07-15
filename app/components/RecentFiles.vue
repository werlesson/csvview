<script setup lang="ts">
import { ref } from 'vue'
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
 * estado vazio. Clicar num item emite `open` com o id (reabertura); o botão
 * de lixeira emite `delete` após uma confirmação (clique novamente).
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
  (e: 'delete', id: number): void
}>()

function onOpen(id: number): void {
  emit('open', id)
}

// Exclusão exige um segundo clique (o primeiro apenas arma a confirmação),
// para não perder um recente por engano. Perder o foco do botão cancela.
const confirmingId = ref<number | null>(null)

function onDeleteClick(id: number): void {
  if (confirmingId.value === id) {
    emit('delete', id)
    confirmingId.value = null
  } else {
    confirmingId.value = id
  }
}

function onDeleteBlur(id: number): void {
  if (confirmingId.value === id) confirmingId.value = null
}
</script>

<template>
  <section class="recents" aria-label="Arquivos recentes">
    <h2 class="recents__title">Arquivos recentes</h2>

    <ul v-if="files.length > 0" class="recents__list">
      <li v-for="file in files" :key="file.id" class="recent">
        <button
          type="button"
          class="recent__open"
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

        <button
          type="button"
          class="recent__delete"
          :class="{ 'recent__delete--confirm': confirmingId === file.id }"
          :aria-label="confirmingId === file.id ? `Confirmar exclusão de ${file.name}` : `Excluir ${file.name}`"
          :title="confirmingId === file.id ? 'Clique novamente para confirmar' : 'Excluir'"
          @click="onDeleteClick(file.id)"
          @blur="onDeleteBlur(file.id)"
        >
          <svg
            v-if="confirmingId !== file.id"
            viewBox="0 0 16 16"
            width="15"
            height="15"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M3.5 4.5h9M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M6.5 7.5v4M9.5 7.5v4M4.5 4.5l.6 8a1 1 0 0 0 1 .93h3.8a1 1 0 0 0 1-.93l.6-8"
              fill="none"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <svg
            v-else
            viewBox="0 0 16 16"
            width="15"
            height="15"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M3.5 8.5 6.5 11.5 12.5 4.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
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
  gap: 8px;
  width: 100%;
  padding: 8px 8px 8px 14px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: background 0.12s ease, border-color 0.12s ease;
}

.recent:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.recent__open {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  padding: 4px 0;
  text-align: left;
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

/* Botão de exclusão: discreto por padrão, alerta em vermelho ao ser armado
   (segundo clique confirma — evita perder um recente por engano). */
.recent__delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 30px;
  height: 30px;
  color: var(--text-3);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.recent__delete:hover {
  color: var(--error);
  background: var(--error-soft);
  border-color: var(--error);
}

.recent__delete:focus-visible {
  outline: none;
  border-color: var(--accent);
}

.recent__delete--confirm,
.recent__delete--confirm:hover {
  color: #ffffff;
  background: var(--error);
  border-color: var(--error);
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
