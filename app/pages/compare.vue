<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import CompareFileSelector from '~/components/CompareFileSelector.vue'
import CompareSummary from '~/components/CompareSummary.vue'
import CompareTable, { type CompareTableColumn } from '~/components/CompareTable.vue'
import Select from '~/components/Select.vue'
import { useCurrentDataset } from '~/composables/useCurrentDataset'
import { useComparisonDatasets } from '~/composables/useComparisonDatasets'
import { useFilesStore } from '~/composables/useFilesStore'
import { inferColumnType } from '~/services/columnStats'
import type { FileRecord } from '~/composables/useDatabase'

/**
 * Tela de **Comparação** (feature `file-comparison`, Fase 4, T06).
 *
 * Rota dedicada `/compare` (RF-02). Sem dataset A carregado (acesso direto à
 * URL), volta ao Upload — mesmo padrão de `viewer.vue`. Todo o estado vem de
 * {@link useComparisonDatasets}: enquanto o dataset B não está carregado,
 * exibe `CompareFileSelector` (T03) alimentado pelos recentes de A; com B
 * carregado, exibe o seletor de coluna-chave (CT-02), o resumo (T04) e a
 * tabela de diff (T05), filtrada por "Somente diferenças" (UI-04).
 */
definePageMeta({ pageTransition: { name: 'view', mode: 'out-in' } })

const { hasDataset } = useCurrentDataset()

if (!hasDataset.value) {
  await navigateTo('/')
}

const {
  datasetA,
  datasetB,
  keyColumn,
  availableKeyColumns,
  result,
  summary,
  hasDatasetB,
  comparisonError,
  isOpeningB,
  openFileB,
  reopenRecentB,
} = useComparisonDatasets()

const { listFiles } = useFilesStore()
const recents = ref<FileRecord[]>([])

/** Recarrega os recentes de A — mesma fonte usada em `index.vue`. */
async function refreshRecents(): Promise<void> {
  recents.value = await listFiles()
}

onMounted(refreshRecents)

async function onSelect(file: File): Promise<void> {
  await openFileB(file)
}

async function onOpenRecent(id: number): Promise<void> {
  await reopenRecentB(id)
}

/** Fechar o seletor sem escolher B cancela a comparação — volta ao Viewer. */
function onCloseSelector(): void {
  navigateTo('/viewer')
}

function onKeyColumnChange(value: string): void {
  keyColumn.value = value || null
}

/** UI-04: filtro "somente diferenças" — nenhuma persistência, default desligado. */
const onlyDifferences = ref(false)

/** Colunas comuns exibidas na tabela, com o tipo inferido a partir de A (Fase 1, T01). */
const commonColumns = computed<CompareTableColumn[]>(() => {
  if (!datasetA.value || !datasetB.value || !result.value) return []
  return result.value.commonColumns.map((name) => {
    const indexA = datasetA.value!.header.indexOf(name)
    const indexB = datasetB.value!.header.indexOf(name)
    return {
      name,
      type: inferColumnType(datasetA.value!.rows.map((row) => row[indexA] ?? '')),
      indexA,
      indexB,
    }
  })
})

/** Registros exibidos na tabela: todos, ou só added/removed/changed quando o filtro está ativo (UI-04 AC). */
const filteredRecords = computed(() => {
  if (!result.value) return []
  return onlyDifferences.value
    ? result.value.records.filter((record) => record.status !== 'unchanged')
    : result.value.records
})

const noResults = computed(() => filteredRecords.value.length === 0)
</script>

<template>
  <section v-if="hasDataset" class="compare">
    <CompareFileSelector
      :open="!hasDatasetB"
      :recents="recents"
      :is-opening="isOpeningB"
      :error="comparisonError"
      @select="onSelect"
      @open-recent="onOpenRecent"
      @close="onCloseSelector"
    />

    <template v-if="hasDatasetB">
      <header class="compare__header">
        <Select
          class="compare__key-select"
          :model-value="keyColumn ?? ''"
          :options="availableKeyColumns"
          aria-label="Coluna-chave"
          @update:model-value="onKeyColumnChange"
        />

        <CompareSummary
          :counts="summary ?? { added: 0, removed: 0, changed: 0, unchanged: 0 }"
        />

        <label class="compare__toggle">
          <input v-model="onlyDifferences" type="checkbox" />
          Somente diferenças
        </label>
      </header>

      <CompareTable
        class="compare__table"
        :common-columns="commonColumns"
        :records="filteredRecords"
        :no-results="noResults"
      />
    </template>
  </section>
</template>

<style scoped>
.compare {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 16px;
}

.compare__header {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.compare__key-select {
  min-width: 200px;
}

.compare__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  font-size: 13px;
  color: var(--text-2);
  cursor: pointer;
}

.compare__table {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
</style>
