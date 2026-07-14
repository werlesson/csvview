<script setup lang="ts">
import { computed, ref } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import CsvCell from '~/components/CsvCell.vue'
import type { ViewerColumn } from '~/composables/useViewer'

/**
 * Tabela **virtualizada** do Viewer (Fase 7, US-2.1).
 *
 * Cabeçalho fixo e apenas as linhas visíveis (mais overscan) presentes no DOM,
 * via `@tanstack/vue-virtual` — para rolar de forma fluida datasets com ~1M
 * linhas sem materializar tudo. As células usam {@link CsvCell}; colunas
 * numéricas (tipo inferido na Fase 5) alinham à direita em fonte monoespaçada.
 *
 * Recebe apenas as colunas **visíveis** e as linhas **já filtradas** pela busca;
 * quando não há linhas, exibe o estado "nenhuma linha encontrada" (US-2.2).
 *
 * Ref de design: `.spec/init/design/README.md#screen-2--visualizador-principal`.
 */
const props = withDefaults(
  defineProps<{
    /** Colunas visíveis, na ordem do cabeçalho (cada uma com seu índice original). */
    columns: ViewerColumn[]
    /** Linhas já filtradas pela busca; cada linha é o array completo de células. */
    rows: string[][]
    /** Índice da coluna selecionada (para o painel de estatísticas), ou `null`. */
    selectedIndex?: number | null
  }>(),
  { selectedIndex: null },
)

const emit = defineEmits<{
  /** Coluna selecionada pelo clique no cabeçalho (abre/atualiza o painel de stats). */
  (e: 'select-column', index: number): void
}>()

function onSelect(index: number): void {
  emit('select-column', index)
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
            }"
            scope="col"
            :aria-selected="column.index === selectedIndex"
          >
            <button
              type="button"
              class="viewer-table__th-button"
              @click="onSelect(column.index)"
            >
              <span class="viewer-table__th-label">{{ column.label }}</span>
              <span class="viewer-table__th-type">{{ column.type }}</span>
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
  height: 70vh;
  min-height: 320px;
  overflow: auto;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.viewer-table__grid {
  display: block;
  width: 100%;
  border-collapse: collapse;
}

.viewer-table__head {
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
  padding: 10px 12px;
  text-align: left;
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Colunas numéricas: cabeçalho à direita em mono, alinhado às células. */
.viewer-table__th--numeric {
  text-align: right;
  font-family: var(--mono);
}

/* Coluna selecionada: destaque do cabeçalho enquanto o painel de stats está aberto. */
.viewer-table__th--selected {
  background: var(--accent-soft);
  box-shadow: inset 0 -2px 0 var(--accent);
}

.viewer-table__th-button {
  display: block;
  width: 100%;
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
  display: block;
}

.viewer-table__th-type {
  display: block;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 400;
  color: var(--text-3);
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
