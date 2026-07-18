<script setup lang="ts">
import { computed, ref } from 'vue'
import SearchInput from '~/components/SearchInput.vue'
import type { FileRecord } from '~/composables/useDatabase'
import {
  extractHeaderTags,
  formatBytes,
  formatRelativeTime,
  formatRowCount,
  type HeaderTags,
} from '~/services/formatFile'

/**
 * Lista de **arquivos recentes** da tela de Upload (Fase 6, US-4.1).
 *
 * Recebe os arquivos já ordenados (mais recente → mais antigo) e exibe, por
 * card, nome · nº de linhas · tamanho · "há quanto tempo" · nomes das
 * colunas do cabeçalho (derivados do `content` já persistido). Um campo de
 * busca filtra os cards por nome. Sem itens, mostra o estado vazio. Clicar
 * num card emite `open` com o id (reabertura); o botão de lixeira (revelado
 * no hover/foco do card) emite `delete` após uma confirmação (clique
 * novamente).
 *
 * Ref de design: mock "1a · Split editorial" (handoff Claude Design).
 */
const props = withDefaults(
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

/** Termo de busca digitado no campo "Buscar arquivos…". */
const query = ref('')

/** Recentes filtrados por nome (case-insensitive); a lista completa sem busca. */
const filteredFiles = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.files
  return props.files.filter((file) => file.name.toLowerCase().includes(q))
})

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

/**
 * Nomes de coluna do cabeçalho de um recente — só a primeira linha de
 * `content` é olhada (barato mesmo para arquivos grandes), então recalcular
 * a cada render é preferível a um cache que ficaria stale após uma
 * sobrescrita (RF-15) sem trocar o `id`.
 */
function tagsFor(file: FileRecord): HeaderTags {
  return extractHeaderTags(file.content, file.delimiter)
}
</script>

<template>
  <section class="recents" aria-label="Arquivos recentes">
    <div class="recents__header">
      <h2 class="recents__title">Arquivos recentes</h2>
      <span v-if="files.length > 0" class="recents__count">
        {{ files.length }} {{ files.length === 1 ? 'arquivo' : 'arquivos' }}
      </span>
    </div>

    <SearchInput
      v-if="files.length > 0"
      v-model="query"
      class="recents__search"
      placeholder="Buscar arquivos…"
      aria-label="Buscar arquivos recentes"
    />

    <ul v-if="filteredFiles.length > 0" class="recents__list">
      <li v-for="file in filteredFiles" :key="file.id" class="recent" @click="onOpen(file.id)">
        <button
          type="button"
          class="recent__open"
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
          @click.stop="onDeleteClick(file.id)"
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

        <div v-if="tagsFor(file).names.length > 0" class="recent__tags">
          <span v-for="name in tagsFor(file).names" :key="name" class="recent__tag">{{ name }}</span>
          <span v-if="tagsFor(file).overflow > 0" class="recent__tag recent__tag--more">
            +{{ tagsFor(file).overflow }}
          </span>
        </div>
      </li>
    </ul>

    <div v-else-if="files.length > 0" class="recents__empty">
      <p class="recents__empty-title">Nenhum arquivo encontrado</p>
      <p class="recents__empty-hint">Tente buscar por outro nome.</p>
    </div>

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

.recents__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  flex: none;
}

.recents__title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3);
}

.recents__count {
  font-size: 12px;
  color: var(--text-3);
}

.recents__search {
  flex: none;
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
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, transform 0.12s ease;
}

.recent:hover {
  /* Deriva do próprio --bg-1 do card (em vez de saltar para o token neutro
     --bg-2) misturando um toque de --glow, pra "acender" combinando com o
     fundo atual do card em vez de trocar para uma cor neutra desencontrada. */
  background: color-mix(in srgb, var(--bg-1) 75%, var(--glow) 25%);
  border-color: var(--border-strong);
  transform: translateY(-1px);
}

@media (prefers-reduced-motion: reduce) {
  .recent:hover {
    transform: none;
  }
}

.recent__open {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 0;
  text-align: left;
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

/* Botão de exclusão: fica oculto até o card ganhar hover/foco (fiel ao
   mock, que não reserva espaço fixo para ele), alerta em vermelho ao ser
   armado (segundo clique confirma — evita perder um recente por engano). */
.recent__delete {
  position: absolute;
  bottom: 10px;
  right: 10px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 28px;
  height: 28px;
  color: var(--text-3);
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  opacity: 0;
  /* Some invisível para o mouse enquanto oculto: sem isso, este canto do
     card ficaria "roubando" cliques do botão de abrir por baixo mesmo sem
     estar visível. Tab ainda alcança o botão (pointer-events não afeta
     foco por teclado). */
  pointer-events: none;
  transition: opacity 0.12s ease, background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.recent:hover .recent__delete,
.recent:focus-within .recent__delete,
.recent__delete--confirm {
  opacity: 1;
  pointer-events: auto;
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
  color: var(--accent-fg);
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

.recent__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-left: 50px;
}

.recent__tag {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-2);
  background: var(--bg-2);
  border: 1px solid var(--border);
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

.recent__tag--more {
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
