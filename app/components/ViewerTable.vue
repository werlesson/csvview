<script setup lang="ts">
import { computed, ref } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import CsvCell from '~/components/CsvCell.vue'
import type { SortDirection, SortKey, ViewerColumn } from '~/composables/useViewer'

/**
 * Tabela **virtualizada** do Viewer (Fase 7, US-2.1).
 *
 * Cabeçalho fixo e apenas as linhas visíveis (mais overscan) presentes no DOM,
 * via `@tanstack/vue-virtual` — para rolar de forma fluida datasets com ~1M
 * linhas sem materializar tudo. As células usam {@link CsvCell}; colunas
 * numéricas (tipo inferido na Fase 5) alinham à direita em fonte monoespaçada.
 *
 * Recebe apenas as colunas **visíveis** e as linhas **já filtradas/ordenadas**
 * pela busca e pela ordenação; quando não há linhas, exibe o estado "nenhuma
 * linha encontrada" (US-2.2).
 *
 * Clique simples no cabeçalho ordena (`sort`, RF-01); Shift+clique adiciona à
 * ordenação multi-coluna (`sort-additive`, RF-02). A seleção da coluna para o
 * painel de estatísticas é feita por um affordance dedicado no cabeçalho
 * (`select-column`, UI-06), separado do clique de ordenação.
 *
 * Ref de design: `.spec/init/design/README.md#screen-2--visualizador-principal`.
 */
const props = withDefaults(
  defineProps<{
    /** Colunas visíveis, na ordem do cabeçalho (cada uma com seu índice original). */
    columns: ViewerColumn[]
    /** Linhas já filtradas/ordenadas pela busca e ordenação; cada linha é o array completo de células. */
    rows: string[][]
    /** Índice da coluna selecionada (para o painel de estatísticas), ou `null`. */
    selectedIndex?: number | null
    /** Chaves de ordenação ativas, em ordem de prioridade decrescente (RF-01, RF-02). */
    sortKeys?: SortKey[]
  }>(),
  { selectedIndex: null, sortKeys: () => [] },
)

const emit = defineEmits<{
  /** Affordance dedicado de estatísticas acionado (abre/atualiza o painel de stats, UI-06). */
  (e: 'select-column', index: number): void
  /** Clique simples no cabeçalho: única chave de ordenação, avança asc → desc → sem ordenação (RF-01). */
  (e: 'sort', index: number): void
  /** Shift+clique no cabeçalho: adiciona/avança/remove a coluna nas chaves de ordenação (RF-02). */
  (e: 'sort-additive', index: number): void
}>()

/** Clique no cabeçalho: ordena (RF-01), ou adiciona à ordenação multi-coluna com Shift (RF-02). */
function onHeaderClick(index: number, event: MouseEvent): void {
  if (event.shiftKey) emit('sort-additive', index)
  else emit('sort', index)
}

/** Affordance dedicado (ícone) que seleciona a coluna para o painel de estatísticas (UI-06). */
function onSelectStats(index: number): void {
  emit('select-column', index)
}

/** A chave de ordenação ativa desta coluna (por índice original), ou `null`. */
function sortKeyFor(index: number): SortKey | null {
  return props.sortKeys.find((key) => key.index === index) ?? null
}

/** Direção de ordenação desta coluna, ou `null` quando não é chave de ordenação. */
function sortDirectionFor(index: number): SortDirection | null {
  return sortKeyFor(index)?.direction ?? null
}

/** Prioridade (1, 2, 3…) desta coluna em multi-sort, ou `null` quando não é chave (UI-02). */
function sortPriorityFor(index: number): number | null {
  const position = props.sortKeys.findIndex((key) => key.index === index)
  return position === -1 ? null : position + 1
}

/** `aria-sort` do cabeçalho, derivado da direção ativa. */
function ariaSortFor(index: number): 'ascending' | 'descending' | undefined {
  const direction = sortDirectionFor(index)
  if (direction === 'asc') return 'ascending'
  if (direction === 'desc') return 'descending'
  return undefined
}

/** Altura estimada de cada linha, em px (usada pela virtualização). */
const ROW_HEIGHT = 40

/** Largura fixa de cada coluna, em px (deve casar com `--col-w` no CSS). */
const COL_WIDTH = 180

/**
 * Largura definida da grade = nº de colunas × largura da coluna.
 *
 * Precisa ser um valor *definido* (não `max-content`): com `table-layout: fixed`
 * o navegador só respeita as larguras fixas das colunas se a tabela tiver largura
 * definida. Com `max-content`, ele cai no layout automático e uma célula de texto
 * longo expande a coluna, desalinhando as linhas.
 */
const gridWidth = computed(() => `${props.columns.length * COL_WIDTH}px`)

const scroller = ref<HTMLElement | null>(null)

const rowVirtualizer = useVirtualizer(
  computed(() => ({
    count: props.rows.length,
    getScrollElement: () => scroller.value,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })),
)

/** Apenas as linhas atualmente visíveis (mais overscan). */
const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())
/** Altura total da lista, para dimensionar a área de rolagem. */
const totalSize = computed(() => rowVirtualizer.value.getTotalSize())

/** Sem nenhuma linha para exibir (busca sem resultados ou dataset vazio). */
const isEmpty = computed(() => props.rows.length === 0)
</script>

<template>
  <div ref="scroller" class="viewer-table" role="region" aria-label="Tabela de dados">
    <table class="viewer-table__grid">
      <thead class="viewer-table__head">
        <tr class="viewer-table__row" :style="{ width: gridWidth }">
          <th
            v-for="column in columns"
            :key="column.index"
            class="viewer-table__th"
            :class="{
              'viewer-table__th--numeric': column.type === 'number',
              'viewer-table__th--selected': column.index === selectedIndex,
              'viewer-table__th--sorted': sortDirectionFor(column.index) !== null,
            }"
            scope="col"
            :aria-selected="column.index === selectedIndex"
            :aria-sort="ariaSortFor(column.index)"
          >
            <button
              type="button"
              class="viewer-table__th-button"
              @click="onHeaderClick(column.index, $event)"
            >
              <span class="viewer-table__th-label">{{ column.label }}</span>
              <span class="viewer-table__th-type">{{ column.type }}</span>
              <svg
                v-if="sortDirectionFor(column.index)"
                class="viewer-table__th-sort-icon"
                :class="`viewer-table__th-sort-icon--${sortDirectionFor(column.index)}`"
                viewBox="0 0 10 10"
                width="10"
                height="10"
                aria-hidden="true"
              >
                <path
                  v-if="sortDirectionFor(column.index) === 'asc'"
                  d="M5 2 L9 8 L1 8 Z"
                  fill="currentColor"
                />
                <path v-else d="M5 8 L1 2 L9 2 Z" fill="currentColor" />
              </svg>
              <span
                v-if="sortPriorityFor(column.index) !== null"
                class="viewer-table__th-priority"
              >{{ sortPriorityFor(column.index) }}</span>
            </button>
            <button
              type="button"
              class="viewer-table__th-stats"
              :aria-label="`Ver estatísticas de ${column.label}`"
              @click="onSelectStats(column.index)"
            >
              <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                <rect x="1" y="6" width="2.5" height="5" fill="currentColor" />
                <rect x="5" y="3" width="2.5" height="8" fill="currentColor" />
                <rect x="9" y="1" width="2.5" height="10" fill="currentColor" />
              </svg>
            </button>
          </th>
        </tr>
      </thead>
      <tbody
        v-if="!isEmpty"
        class="viewer-table__body"
        :style="{ height: `${totalSize}px` }"
      >
        <tr
          v-for="virtualRow in virtualRows"
          :key="virtualRow.key"
          class="viewer-table__row"
          :style="{ width: gridWidth, transform: `translateY(${virtualRow.start}px)` }"
        >
          <CsvCell
            v-for="column in columns"
            :key="column.index"
            :value="rows[virtualRow.index]?.[column.index]"
            :numeric="column.type === 'number'"
            :selected="column.index === selectedIndex"
          />
        </tr>
      </tbody>
    </table>

    <div v-if="isEmpty" class="viewer-table__empty" role="status">
      <p class="viewer-table__empty-title">Nenhuma linha encontrada</p>
      <p class="viewer-table__empty-hint">
        Nenhuma linha casa com a busca. Ajuste o termo ou limpe o campo.
      </p>
    </div>
  </div>
</template>

<style scoped>
.viewer-table {
  /* Largura de cada coluna. Custom property herda para o CsvCell (filho),
     mantendo cabeçalho e células alinhados mesmo com estilos scoped. */
  --col-w: 180px;
  position: relative;
  /* Sem card próprio: a tabela é parte da superfície unificada do Viewer e
     preenche a altura do body. Esta é a única área de scroll da tela. */
  height: 100%;
  overflow: auto;
  background: var(--bg-1);
}

.viewer-table__grid {
  display: block;
  width: 100%;
  border-collapse: collapse;
}

.viewer-table__head {
  /* `display: block` (como o tbody) para que o `min-width: 100%` da linha do
     cabeçalho resolva contra a mesma largura do scroller que as linhas do corpo.
     Sem isso, o thead (table-header-group) encolhe para a largura natural e, com
     a grade esticada (poucas colunas), as colunas do cabeçalho desalinham das do
     corpo. */
  display: block;
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bg-2);
}

/* Cabeçalho e linhas são tabelas de largura fixa, para alinhar as colunas.
   A largura é *definida* via style inline (nº de colunas × --col-w) — condição
   para o `table-layout: fixed` respeitar as larguras das colunas e truncar texto
   longo (com `max-content`/`auto` o navegador cai no layout automático e uma
   célula longa expande a coluna, desalinhando as linhas). A grade pode crescer
   além do container (scroll horizontal, ex.: 70 colunas); `min-width: 100%`
   evita encolher quando há poucas colunas. */
.viewer-table__head .viewer-table__row,
.viewer-table__body .viewer-table__row {
  display: table;
  min-width: 100%;
  table-layout: fixed;
}

.viewer-table__body {
  display: block;
  position: relative;
}

.viewer-table__body .viewer-table__row {
  position: absolute;
  top: 0;
  left: 0;
}

.viewer-table__th {
  width: var(--col-w);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
  font-family: var(--font);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-3);
  border-bottom: 1px solid var(--border);
  /* Divisor vertical entre colunas (cara de grade, fiel ao design). */
  border-right: 1px solid var(--border);
}

/* Colunas numéricas: cabeçalho à direita em mono, alinhado às células. */
.viewer-table__th--numeric {
  font-family: var(--mono);
}

.viewer-table__th--numeric .viewer-table__th-button {
  justify-content: flex-end;
}

.viewer-table__th--numeric .viewer-table__th-label {
  text-align: right;
}

/* Cabeçalho ordenado: rótulo ganha destaque (o ícone de direção já indica o
   estado — cor não é o único sinal, UI-01). */
.viewer-table__th--sorted .viewer-table__th-label {
  color: var(--text);
}

/* Coluna selecionada: destaque do cabeçalho enquanto o painel de stats está
   aberto. Faixa accent (borda inferior + laterais) para virar uma coluna
   realçada de ponta a ponta, fiel ao design. */
.viewer-table__th--selected {
  background: var(--accent-soft);
  box-shadow: inset 0 -2px 0 var(--accent);
  border-right-color: var(--accent);
  border-left: 1px solid var(--accent);
}

.viewer-table__th--selected .viewer-table__th-label {
  color: var(--accent);
}

/* Hover de linha: realça a linha inteira sob o cursor (fiel ao design). */
.viewer-table__body .viewer-table__row:hover :deep(.csv-cell) {
  background: var(--bg-hover);
}

.viewer-table__th-button {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
  padding: 0;
  margin: 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
}

.viewer-table__th-button:hover .viewer-table__th-label {
  color: var(--text);
}

.viewer-table__th-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-2);
}

/* Indicador de direção (UI-01): forma distinta por asc/desc (triângulo para
   cima/para baixo), não dependente apenas de cor. */
.viewer-table__th-sort-icon {
  flex: none;
  color: var(--accent);
}

/* Número de prioridade em multi-sort (UI-02). */
.viewer-table__th-priority {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 7px;
  background: var(--accent);
  color: var(--bg-1);
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  text-transform: none;
  letter-spacing: normal;
}

/* Affordance dedicado do painel de estatísticas (UI-06): distinto do clique
   de ordenação — botão próprio, fora da área clicável de `.viewer-table__th-button`. */
.viewer-table__th-stats {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--text-3);
  cursor: pointer;
}

.viewer-table__th-stats:hover {
  color: var(--accent);
  background: var(--accent-soft);
}

/* O tipo da coluna não aparece no cabeçalho (fiel ao design da Screen 2): fica
   só no leitor de tela / DOM. O tipo é exibido no painel de estatísticas ao
   selecionar a coluna. */
.viewer-table__th-type {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.viewer-table__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 48px 24px;
  text-align: center;
}

.viewer-table__empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}

.viewer-table__empty-hint {
  font-size: 13px;
  color: var(--text-3);
}
</style>
