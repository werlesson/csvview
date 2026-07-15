<script setup lang="ts">
import { computed } from 'vue'
import ViewerToolbar from '~/components/ViewerToolbar.vue'
import ViewerTable from '~/components/ViewerTable.vue'
import StatsPanel from '~/components/StatsPanel.vue'
import { useCurrentDataset } from '~/composables/useCurrentDataset'
import { useViewer } from '~/composables/useViewer'

/**
 * Tela do **Viewer** (Fase 7).
 *
 * Toolbar (nome do arquivo, contagem de linhas, busca e seletor de colunas)
 * sobre uma tabela virtualizada. A lógica de busca/colunas/tipos vive em
 * {@link useViewer}; o dataset vem do estado compartilhado {@link useCurrentDataset}
 * carregado pela tela de Upload (Fase 6). Sem dataset (acesso direto à URL),
 * volta à tela de Upload.
 *
 * Ref de design: `.spec/init/design/README.md#screen-2--visualizador-principal`.
 */
const { dataset, hasDataset } = useCurrentDataset()

// Acesso direto ao Viewer sem um dataset carregado → volta ao Upload.
if (!hasDataset.value) {
  await navigateTo('/')
}

const {
  search,
  columns,
  totalRows,
  toggleColumn,
  selectedIndex,
  selectedColumn,
  selectedStats,
  selectColumn,
  sortKeys,
  sortedRows,
  sortColumn,
  sortColumnAdditive,
  resizeColumn,
  columnWidth,
  reorderColumn,
  togglePin,
  displayColumns,
} = useViewer(() => dataset.value)

const selectedLabel = computed(() => selectedColumn.value?.label ?? null)
</script>

<template>
  <section v-if="hasDataset" class="viewer">
    <ViewerToolbar
      v-model:search="search"
      :row-count="totalRows"
      :columns="columns"
      @toggle-column="toggleColumn"
      @toggle-pin="togglePin"
    />

    <div class="viewer__body">
      <ViewerTable
        :columns="displayColumns"
        :rows="sortedRows"
        :selected-index="selectedIndex"
        :sort-keys="sortKeys"
        @select-column="selectColumn"
        @sort="sortColumn"
        @sort-additive="sortColumnAdditive"
        @resize="resizeColumn"
        @reorder="reorderColumn"
        @toggle-pin="togglePin"
      />

      <StatsPanel :label="selectedLabel" :stats="selectedStats" />
    </div>
  </section>
</template>

<style scoped>
/* Superfície única do Viewer (fiel à Screen 2): toolbar no topo e, abaixo,
   tabela + painel de stats colados — separados só por linhas de 1px, sem gaps.
   O card preenche a altura disponível (`.app-content` é flex full-height) e o
   scroll fica confinado à área da tabela. */
.viewer {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.viewer__body {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* A tabela ocupa o espaço restante; o painel tem largura fixa e um divisor à
   esquerda (o próprio painel desenha a borda — ver StatsPanel). Estilizamos as
   raízes dos componentes filhos: em CSS scoped, o Vue aplica o escopo do pai à
   raiz do filho, então `.viewer-table`/`.stats-panel` são alcançáveis daqui. */
.viewer__body > .viewer-table {
  flex: 1;
  min-width: 0;
}

.viewer__body > .stats-panel {
  flex: none;
  width: 320px;
}

/* Empilha em telas estreitas: o divisor do painel vira borda superior. */
@media (max-width: 900px) {
  .viewer__body {
    flex-direction: column;
  }

  .viewer__body > .stats-panel {
    width: auto;
  }
}
</style>
