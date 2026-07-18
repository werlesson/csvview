<script setup lang="ts">
import { computed, ref } from 'vue'
import SearchInput from '~/components/SearchInput.vue'
import Dropdown from '~/components/Dropdown.vue'
import ColumnChip from '~/components/ColumnChip.vue'
import Badge from '~/components/Badge.vue'
import { formatRowCount } from '~/services/formatFile'
import type { ViewerColumn } from '~/composables/useViewer'

/**
 * Toolbar do **Viewer** (Fase 7, US-2.1).
 *
 * Fiel à tela de referência (Screen 2): à esquerda o campo de busca
 * "Buscar em tudo…", o controle **Filtros** (badge de contagem, UI-02) e o
 * seletor de colunas; à direita, o controle **Exportar** (UI-04, abre o
 * modal de exportação via `open-export`) e o contador de linhas. O nome do
 * arquivo fica na barra de título (header do layout).
 *
 * Cada item do menu "Colunas" reusa {@link ColumnChip} (variação `pinned`) e
 * expõe um controle de fixar/desfixar equivalente ao botão de pin do
 * cabeçalho da tabela (`toggle-pin`, UI-05) — os dois controles operam sobre o
 * mesmo estado de fixação (`togglePin` em `useViewer`).
 *
 * Ref de design: `.spec/init/design/README.md#screen-2--visualizador-principal`.
 */
const props = withDefaults(
  defineProps<{
    /** Total de linhas do dataset (sem filtro). */
    rowCount: number
    /** Colunas do dataset, com tipo, visibilidade e fixação atuais. */
    columns: ViewerColumn[]
    /** Termo de busca (suporta `v-model:search`). */
    search: string
    /** Nº de filtros de coluna ativos (chips) — badge no controle "Filtros" (UI-02). */
    activeFilterCount?: number
    /** `true` quando há ao menos uma entrada desfazível no histórico do dataset atual (RF-09). */
    canUndo?: boolean
    /** `true` quando há ao menos uma entrada refazível no histórico do dataset atual (RF-09). */
    canRedo?: boolean
    /**
     * `true` quando há alteração ainda não persistida pelo último "Salvar
     * como cópia"/"Sobrescrever original" — independente de `canUndo`/
     * `canRedo` (que só refletem a existência de histórico, não se ele já
     * foi salvo). Controla se "Salvar" está habilitado.
     */
    hasUnsavedChanges?: boolean
    /** Mensagem de erro da última escrita de "Salvar nova versão"/"Sobrescrever original" (RNF-02). */
    saveError?: string | null
  }>(),
  {
    activeFilterCount: 0,
    canUndo: false,
    canRedo: false,
    hasUnsavedChanges: false,
    saveError: null,
  },
)

const emit = defineEmits<{
  (e: 'update:search', value: string): void
  (e: 'toggle-column', index: number): void
  (e: 'toggle-pin', index: number): void
  (e: 'toggle-filters'): void
  (e: 'open-export'): void
  (e: 'open-compare'): void
  (e: 'undo'): void
  (e: 'redo'): void
  (e: 'save-new-version'): void
  (e: 'overwrite-original'): void
}>()

function onToggleFilters(): void {
  emit('toggle-filters')
}

function onOpenExport(): void {
  emit('open-export')
}

function onOpenCompare(): void {
  emit('open-compare')
}

function onUndo(): void {
  if (!props.canUndo) return
  emit('undo')
}

function onRedo(): void {
  if (!props.canRedo) return
  emit('redo')
}

function onSaveNewVersion(): void {
  emit('save-new-version')
}

/**
 * Emite o pedido de sobrescrita — o pai (`viewer.vue`) é quem decide exibir
 * a confirmação (modal) antes de chamar `overwriteOriginal()` de fato. Sem
 * alteração pendente desde o último save (`hasUnsavedChanges` falso), não há
 * o que sobrescrever.
 */
function onOverwriteOriginal(): void {
  if (!props.hasUnsavedChanges) return
  emit('overwrite-original')
}

function onSearch(value: string): void {
  emit('update:search', value)
}

/** Termo de busca do menu "Colunas" — filtra a lista, independente da busca da tabela. */
const columnSearch = ref('')

/** Colunas cujo rótulo casa com `columnSearch` (case-insensitive); sem termo, todas. */
const filteredColumns = computed(() => {
  const term = columnSearch.value.trim().toLowerCase()
  if (!term) return props.columns
  return props.columns.filter((column) => column.label.toLowerCase().includes(term))
})

/** Limpa a busca ao fechar o menu, para reabrir sempre com a lista completa. */
function onColumnsMenuClose(): void {
  columnSearch.value = ''
}

function onToggle(index: number): void {
  emit('toggle-column', index)
}

function onTogglePin(index: number): void {
  emit('toggle-pin', index)
}
</script>

<template>
  <div class="toolbar">
    <div class="toolbar__controls">
      <div class="toolbar__search">
        <SearchInput
          :model-value="search"
          placeholder="Buscar em tudo…"
          @update:model-value="onSearch"
        />
      </div>

      <button
        type="button"
        class="toolbar__filters"
        aria-label="Filtros"
        @click="onToggleFilters"
      >
        <svg
          class="toolbar__icon"
          viewBox="0 0 16 16"
          width="15"
          height="15"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M2 3 H14 L9.5 8.2 V13 L6.5 11.5 V8.2 Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linejoin="round"
          />
        </svg>
        <span>Filtros</span>
        <Badge v-if="activeFilterCount > 0" variant="accent" class="toolbar__filters-badge">
          {{ activeFilterCount }}
        </Badge>
      </button>

      <Dropdown label="Colunas" @close="onColumnsMenuClose">
        <template #trigger>
          <svg
            class="toolbar__icon"
            viewBox="0 0 16 16"
            width="15"
            height="15"
            aria-hidden="true"
            focusable="false"
          >
            <rect x="2" y="2.5" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3" />
            <line x1="6.5" y1="2.5" x2="6.5" y2="13.5" stroke="currentColor" stroke-width="1.3" />
            <line x1="10" y1="2.5" x2="10" y2="13.5" stroke="currentColor" stroke-width="1.3" />
          </svg>
          <span>Colunas</span>
        </template>
        <div class="columns-menu__search">
          <SearchInput
            v-model="columnSearch"
            placeholder="Buscar coluna…"
            aria-label="Buscar coluna"
          />
        </div>
        <ul class="columns-menu" role="none">
          <li v-if="filteredColumns.length === 0" class="columns-menu__empty" role="none">
            Nenhuma coluna encontrada
          </li>
          <li v-for="column in filteredColumns" :key="column.index" role="none">
            <div
              class="columns-menu__item"
              :class="{ 'columns-menu__item--pinned': column.pinned }"
            >
              <label class="columns-menu__visibility">
                <input
                  type="checkbox"
                  class="columns-menu__checkbox"
                  :checked="column.visible"
                  @change="onToggle(column.index)"
                >
                <ColumnChip
                  class="columns-menu__chip"
                  :label="column.label"
                  :type="column.type"
                  :pinned="column.pinned"
                />
              </label>
              <button
                type="button"
                class="columns-menu__pin"
                :class="{ 'columns-menu__pin--active': column.pinned }"
                :aria-pressed="column.pinned"
                :aria-label="column.pinned ? `Desfixar coluna ${column.label}` : `Fixar coluna ${column.label}`"
                @click="onTogglePin(column.index)"
              >
                <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                  <path
                    d="M4 1.5 H8 L7.4 5 L9.5 6.8 H6.5 L5.8 10.5 H5.2 L4.5 6.8 H1.5 L3.6 5 Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </li>
        </ul>
      </Dropdown>
    </div>

    <div class="toolbar__meta">
      <span v-if="saveError" class="toolbar__save-error" role="alert">{{ saveError }}</span>

      <span class="toolbar__count">{{ formatRowCount(rowCount) }} linhas</span>

      <span class="toolbar__divider" aria-hidden="true"></span>

      <button
        type="button"
        class="toolbar__export"
        aria-label="Exportar"
        @click="onOpenExport"
      >
        <svg
          class="toolbar__icon"
          viewBox="0 0 16 16"
          width="15"
          height="15"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M8 1.5 V10 M8 10 L5 7 M8 10 L11 7"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M2.5 11.5 V13.5 H13.5 V11.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>Exportar</span>
      </button>

      <span class="toolbar__divider" aria-hidden="true"></span>

      <!-- Menu "Mais ações" (Comparar, Desfazer, Refazer, Sobrescrever
           original, Salvar nova versão): botão só de ícone (3 pontos),
           sempre presente — reaproveita Dropdown.vue, como "Colunas". -->
      <Dropdown class="toolbar__more" aria-label="Mais ações">
        <template #trigger>
          <svg
            class="toolbar__icon"
            viewBox="0 0 16 16"
            width="15"
            height="15"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="8" cy="3.5" r="1.3" fill="currentColor" />
            <circle cx="8" cy="8" r="1.3" fill="currentColor" />
            <circle cx="8" cy="12.5" r="1.3" fill="currentColor" />
          </svg>
        </template>
        <ul class="more-menu" role="none">
          <li role="none">
            <button
              type="button"
              class="toolbar__overwrite"
              aria-label="Salvar (Ctrl+S)"
              :disabled="!hasUnsavedChanges"
              @click="onOverwriteOriginal"
            >
              <svg
                class="toolbar__icon"
                viewBox="0 0 16 16"
                width="15"
                height="15"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M2.5 2.5 H11 L13.5 5 V13.5 H2.5 Z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.3"
                  stroke-linejoin="round"
                />
                <path
                  d="M4.5 2.5 V6.5 H10 V2.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.3"
                  stroke-linejoin="round"
                />
                <rect x="5" y="9" width="6" height="4.5" fill="none" stroke="currentColor" stroke-width="1.3" />
              </svg>
              <span>Salvar</span>
              <span class="more-menu__shortcut" aria-hidden="true">Ctrl+S</span>
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              class="toolbar__save-version"
              aria-label="Salvar como cópia"
              @click="onSaveNewVersion"
            >
              <svg
                class="toolbar__icon"
                viewBox="0 0 16 16"
                width="15"
                height="15"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M4 2 H9.5 L12 4.5 V14 H4 Z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.3"
                  stroke-linejoin="round"
                />
                <path
                  d="M9.5 2 V4.5 H12"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.3"
                  stroke-linejoin="round"
                />
                <path
                  d="M8 8 V11.5 M6.25 9.75 H9.75"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.3"
                  stroke-linecap="round"
                />
              </svg>
              <span>Salvar como cópia</span>
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              class="toolbar__compare"
              aria-label="Comparar"
              @click="onOpenCompare"
            >
              <svg
                class="toolbar__icon"
                viewBox="0 0 16 16"
                width="15"
                height="15"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M5.5 2 2 5.5 5.5 9 M2 5.5 H9.5 M10.5 7 14 10.5 10.5 14 M14 10.5 H6.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span>Comparar</span>
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              class="toolbar__history-btn"
              aria-label="Desfazer (Ctrl+Z)"
              :disabled="!canUndo"
              @click="onUndo"
            >
              <svg
                class="toolbar__icon"
                viewBox="0 0 16 16"
                width="15"
                height="15"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M6 3.5 2.5 7 6 10.5 M2.5 7 H10 A3.5 3.5 0 0 1 10 14 H8"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span>Desfazer</span>
              <span class="more-menu__shortcut" aria-hidden="true">Ctrl+Z</span>
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              class="toolbar__history-btn"
              aria-label="Refazer (Ctrl+R)"
              :disabled="!canRedo"
              @click="onRedo"
            >
              <svg
                class="toolbar__icon"
                viewBox="0 0 16 16"
                width="15"
                height="15"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M10 3.5 13.5 7 10 10.5 M13.5 7 H6 A3.5 3.5 0 0 0 6 14 H8"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span>Refazer</span>
              <span class="more-menu__shortcut" aria-hidden="true">Ctrl+R</span>
            </button>
          </li>
        </ul>
      </Dropdown>
    </div>
  </div>
</template>

<style scoped>
/* Faixa de topo da superfície do Viewer: colada ao topo do card, separada da
   tabela apenas por uma linha de 1px (sem borda/raio próprios). */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
}

.toolbar__controls {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

/* Só a busca deve ceder espaço aqui — Filtros e Colunas (abaixo) nunca
   encolhem, senão seu texto é espremido/cortado antes do breakpoint mobile
   (640px) empilhar a toolbar. */
.toolbar__search {
  flex: 0 1 360px;
  min-width: 0;
}

.toolbar__controls :deep(.dropdown) {
  flex: none;
}

.toolbar__meta {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Controle "Exportar" (UI-04): destaque primary (accent sólido), para se
   diferenciar dos demais controles da toolbar como ação principal. */
.toolbar__export {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  padding: 8px 12px;
  background: var(--accent);
  color: var(--accent-fg);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
}

.toolbar__export:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.toolbar__export .toolbar__icon {
  color: var(--accent-fg);
}

/* "Salvar nova versão"/"Salvar" (sobrescrever original) trocam de cor conforme o
   contexto (accent sólido/accent/warning) — o ícone acompanha em vez de ficar
   preso ao cinza padrão de `.toolbar__icon`. */
.toolbar__save-version .toolbar__icon,
.toolbar__overwrite .toolbar__icon {
  color: inherit;
}

.toolbar__count {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--text-3);
  white-space: nowrap;
}

/* Separador entre linhas/Exportar/Mais ações, na ordem pedida em UI-04. */
.toolbar__divider {
  width: 1px;
  height: 20px;
  background: var(--border);
  flex: none;
}

/* Mensagem de erro de "Salvar nova versão"/"Sobrescrever original" (RNF-02): exibida
   sem bloquear os demais controles da toolbar. */
.toolbar__save-error {
  font-size: 12.5px;
  color: var(--error);
  white-space: nowrap;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Controle "Comparar" (RF-02, T07): mesmo padrão visual secundário dos botões
   de "Desfazer"/"Refazer" — navega para a tela de comparação (`/compare`),
   sem alterar nenhum estado existente do Viewer. */
.toolbar__compare {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  padding: 8px 12px;
  background: var(--bg-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
}

.toolbar__compare:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

/* Grupo "Desfazer"/"Refazer" (RF-06, RF-07, RF-09). */
.toolbar__history {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.toolbar__history-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 500;
  padding: 7px 10px;
  background: var(--bg-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
}

.toolbar__history-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.toolbar__history-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* "Salvar nova versão" (RF-11): mesmo padrão visual accent-sólido do controle
   "Exportar" — ação de gravação principal, não-destrutiva (cria um registro novo). */
.toolbar__save-version {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  padding: 8px 12px;
  background: var(--accent);
  color: var(--accent-fg);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
}

.toolbar__save-version:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

/* "Sobrescrever original" (RF-15, CT-04): visualmente distinto de "Salvar nova
   versão" — borda de aviso, fundo transparente, para sinalizar uma ação destrutiva
   (substitui o registro original) que nunca é disparada pelo botão padrão. */
.toolbar__overwrite {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  padding: 8px 12px;
  background: transparent;
  color: var(--warning);
  border: 1px solid var(--warning);
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
}

.toolbar__overwrite:hover:not(:disabled) {
  background: var(--warning-soft);
}

.toolbar__overwrite:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolbar__icon {
  flex: none;
  color: var(--text-2);
}

/* Controle "Filtros" (UI-02): mesma aparência do gatilho do Dropdown, com
   badge de contagem (Badge.vue) quando há filtros ativos. */
.toolbar__filters {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: none;
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  padding: 8px 12px;
  background: var(--bg-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
}

.toolbar__filters:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.toolbar__filters-badge {
  padding: 2px 6px;
}

/* Busca do menu "Colunas": mesmo `SearchInput` do campo principal, num
   invólucro compacto (sem o padding do menu ao redor, para ficar rente aos
   itens da lista logo abaixo). */
.columns-menu__search {
  padding: 4px 4px 6px;
}

.columns-menu__empty {
  padding: 10px 8px;
  font-size: 13px;
  color: var(--text-3);
  text-align: center;
}

.columns-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 320px;
  overflow-y: auto;
}

.columns-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text);
}

.columns-menu__item:hover {
  background: var(--bg-hover);
}

/* Item de coluna fixada (UI-05): mesma variação visual do chip (`chip--pinned`,
   borda accent), aplicada também à linha do item inteira no menu. */
.columns-menu__item--pinned {
  border: 1px solid var(--accent);
}

.columns-menu__visibility {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
  cursor: pointer;
}

.columns-menu__checkbox {
  flex: none;
  accent-color: var(--accent);
}

.columns-menu__chip {
  flex: 1;
  min-width: 0;
}

.columns-menu__chip :deep(.chip__label) {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Controle de fixar/desfixar (UI-05): equivalente ao botão de pin do
   cabeçalho da tabela — mesmo estado (`toggle-pin`), reutilizado aqui no menu
   "Colunas". */
.columns-menu__pin {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--text-3);
  cursor: pointer;
}

.columns-menu__pin:hover {
  color: var(--accent);
  background: var(--accent-soft);
}

.columns-menu__pin--active {
  color: var(--accent);
}

/* Gatilho "Mais ações": botão só de ícone (3 pontos) — mesma aparência
   secundária dos outros controles, porém quadrado e sem rótulo visível (o
   nome acessível vem de `aria-label`, ver Dropdown.vue). */
.toolbar__more :deep(.dropdown__trigger) {
  width: 34px;
  height: 34px;
  padding: 0;
  justify-content: center;
}

/* Menu "Mais ações" (Salvar nova versão, Sobrescrever original, Comparar,
   Desfazer, Refazer) — reaproveita os mesmos botões/classes usados antes
   soltos na toolbar; aqui o layout vira "linha inteira", como item de menu. */
.more-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
  list-style: none;
  margin: 0;
  padding: 0;
  min-width: 200px;
}

/* Sem o fundo accent-sólido, o texto branco (--accent-fg) de "Salvar nova
   versão" ficaria ilegível sobre o painel do menu (esp. no tema claro); e o
   texto de aviso (--warning) de "Sobrescrever original" destacaria demais
   uma ação usada no dia a dia — aqui os dois viram texto neutro, como as
   demais ações (Comparar, Desfazer, Refazer). */
.more-menu .toolbar__save-version,
.more-menu .toolbar__overwrite {
  color: var(--text);
}

.more-menu .toolbar__save-version,
.more-menu .toolbar__compare,
.more-menu .toolbar__history-btn,
.more-menu .toolbar__overwrite {
  width: 100%;
  justify-content: flex-start;
  background: none;
  border: none;
}

.more-menu .toolbar__save-version:hover,
.more-menu .toolbar__compare:hover,
.more-menu .toolbar__history-btn:hover:not(:disabled),
.more-menu .toolbar__overwrite:hover:not(:disabled) {
  background: var(--bg-hover);
}

/* Dica de atalho de teclado (Ctrl+Z/Ctrl+R/Ctrl+S) — alinhada à direita do
   item de menu, para o usuário descobrir o atalho sem precisar clicar. */
.more-menu__shortcut {
  margin-left: auto;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
}

@media (max-width: 640px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar__search {
    flex: 1 1 auto;
  }

  .toolbar__meta {
    justify-content: flex-end;
  }
}
</style>
