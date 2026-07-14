<script setup lang="ts">
import { computed } from 'vue'
import ViewerToolbar from '~/components/ViewerToolbar.vue'
import ViewerTable from '~/components/ViewerTable.vue'
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
const { dataset, meta, hasDataset } = useCurrentDataset()

// Acesso direto ao Viewer sem um dataset carregado → volta ao Upload.
if (!hasDataset.value) {
  await navigateTo('/')
}

const {
  search,
  columns,
  visibleColumns,
  filteredRows,
  totalRows,
  toggleColumn,
} = useViewer(() => dataset.value)

const fileName = computed(() => meta.value?.name ?? '')
</script>

<template>
  <section v-if="hasDataset" class="viewer">
    <ViewerToolbar
      v-model:search="search"
      :file-name="fileName"
      :row-count="totalRows"
      :columns="columns"
      @toggle-column="toggleColumn"
    />

    <ViewerTable :columns="visibleColumns" :rows="filteredRows" />
  </section>
</template>

<style scoped>
.viewer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
