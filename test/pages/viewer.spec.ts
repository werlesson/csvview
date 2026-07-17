import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick, Suspense } from 'vue'
import ViewerPage from '~/pages/viewer.vue'
import { useCurrentDataset, type Dataset } from '~/composables/useCurrentDataset'
import { useFilesStore } from '~/composables/useFilesStore'
import { deleteDatabase } from '~/composables/useDatabase'

/** Dataset de exemplo: id (number), status (text), amount (number). */
function makeDataset(): Dataset {
  return {
    header: ['id', 'status', 'amount'],
    rows: [
      ['1', 'settled', '100'],
      ['2', 'failed', '250'],
      ['3', 'failed', '-50'],
      ['4', 'settled', '10'],
    ],
  }
}

async function mountViewer() {
  useCurrentDataset().setDataset(makeDataset(), {
    name: 'transactions.csv',
    delimiter: 'comma',
    sizeBytes: 128,
    rowCount: 4,
    columnCount: 3,
  })

  // `viewer.vue` tem `await navigateTo(...)` no topo do `<script setup>`
  // (setup assíncrono) — precisa de um limite `<Suspense>` para montar.
  const wrapper = mount(
    {
      render: () => h(Suspense, null, { default: () => h(ViewerPage) }),
    },
    { attachTo: document.body },
  )
  await flushPromises()
  return wrapper
}

/** Aciona "Adicionar filtro" no drawer (edita só o rascunho) e ajusta coluna/operador/valor. */
async function editDraftFilterViaUi(
  wrapper: Awaited<ReturnType<typeof mountViewer>>,
  column: string,
  operator: string,
  value: string,
): Promise<void> {
  await wrapper.get('.filter-overlay__add').trigger('click')

  const card = wrapper.findAll('.filter-card').at(-1)!
  await card.get('select[aria-label="Coluna do filtro"]').setValue(column)
  await card.get('select[aria-label="Operador do filtro"]').setValue(operator)

  const valueInput = card.find('input[aria-label="Valor do filtro"]')
  if (valueInput.exists()) await valueInput.setValue(value)
}

/** Abre o drawer, monta um filtro no rascunho e confirma com "Filtrar" (RF-05: só aplica no clique). */
async function applyFilterViaUi(
  wrapper: Awaited<ReturnType<typeof mountViewer>>,
  column: string,
  operator: string,
  value: string,
): Promise<void> {
  await wrapper.get('.toolbar__filters').trigger('click')
  await editDraftFilterViaUi(wrapper, column, operator, value)
  await wrapper.get('.filter-overlay__apply').trigger('click')
}

describe('viewer.vue — fiação dos filtros (Fase 4, T06)', () => {
  beforeEach(() => {
    useCurrentDataset().clearDataset()
  })

  afterEach(() => {
    useCurrentDataset().clearDataset()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('abre o drawer ao acionar "Filtros" na toolbar; editar o rascunho não muda a tabela até clicar em "Filtrar"', async () => {
    const wrapper = await mountViewer()

    expect(wrapper.find('.filter-overlay').exists()).toBe(false)

    await wrapper.get('.toolbar__filters').trigger('click')
    expect(wrapper.find('.filter-overlay').exists()).toBe(true)

    expect(wrapper.findAll('.viewer-table__row').length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('4 linhas')

    await editDraftFilterViaUi(wrapper, '1', 'igual', 'failed')

    // Só editar o rascunho não filtra nada ainda — nem fecha o drawer.
    expect(wrapper.text()).toContain('4 linhas')
    expect(wrapper.find('.toolbar__filters-badge').exists()).toBe(false)
    expect(wrapper.find('.filter-overlay').exists()).toBe(true)

    await wrapper.get('.filter-overlay__apply').trigger('click')

    // "Filtrar" aplica de uma vez: contador atualiza, badge aparece, drawer fecha.
    expect(wrapper.text()).toContain('2 linhas')
    expect(wrapper.get('.toolbar__filters-badge').text()).toBe('1')
    expect(wrapper.find('.filter-overlay').exists()).toBe(false)

    // O filtro aplicado aparece como badge acima da tabela (FilterChips).
    expect(wrapper.get('.filter-chips__label').text()).toContain('status')
  })

  it('combinação sem resultado renderiza "Nenhuma linha encontrada" com ação de limpar filtros, que restaura as linhas (RF-06, UI-03)', async () => {
    const wrapper = await mountViewer()

    await applyFilterViaUi(wrapper, '1', 'igual', 'inexistente')

    expect(wrapper.text()).toContain('Nenhuma linha encontrada')
    expect(wrapper.text()).toContain('0 linhas')

    const clearButton = wrapper.get('.viewer-table__empty-clear')
    await clearButton.trigger('click')

    expect(wrapper.find('.viewer-table__empty').exists()).toBe(false)
    expect(wrapper.text()).toContain('4 linhas')
    expect(wrapper.find('.filter-chips').exists()).toBe(false)
    expect(wrapper.find('.toolbar__filters-badge').exists()).toBe(false)
  })

  it('o "×" do badge acima da tabela remove aquele filtro imediatamente, sem precisar reabrir o drawer nem clicar em "Filtrar" (RF-03)', async () => {
    const wrapper = await mountViewer()

    await applyFilterViaUi(wrapper, '1', 'igual', 'failed')
    expect(wrapper.text()).toContain('2 linhas')

    await wrapper.get('.filter-chips__remove').trigger('click')

    expect(wrapper.text()).toContain('4 linhas')
    expect(wrapper.find('.filter-chips').exists()).toBe(false)
    expect(wrapper.find('.toolbar__filters-badge').exists()).toBe(false)
  })

  it('"Limpar" no drawer só esvazia o rascunho — a tabela só reflete isso após "Filtrar" (RF-05)', async () => {
    const wrapper = await mountViewer()

    await applyFilterViaUi(wrapper, '1', 'igual', 'failed')
    expect(wrapper.text()).toContain('2 linhas')

    await wrapper.get('.toolbar__filters').trigger('click')
    await wrapper.get('.filter-overlay__clear').trigger('click')

    // Rascunho vazio, mas a tabela e o badge ainda refletem o filtro aplicado.
    expect(wrapper.find('.filter-card').exists()).toBe(false)
    expect(wrapper.text()).toContain('2 linhas')
    expect(wrapper.get('.toolbar__filters-badge').text()).toBe('1')

    await wrapper.get('.filter-overlay__apply').trigger('click')

    expect(wrapper.text()).toContain('4 linhas')
    expect(wrapper.find('.filter-chips').exists()).toBe(false)
    expect(wrapper.find('.toolbar__filters-badge').exists()).toBe(false)
  })

  it('não acessa IndexedDB nem localStorage ao aplicar/remover filtros (RF-07)', async () => {
    const wrapper = await mountViewer()

    const openSpy = vi.spyOn(indexedDB, 'open')
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem')
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    await applyFilterViaUi(wrapper, '1', 'igual', 'failed')
    await wrapper.get('.filter-chips__remove').trigger('click')

    expect(openSpy).not.toHaveBeenCalled()
    expect(getItemSpy).not.toHaveBeenCalled()
    expect(setItemSpy).not.toHaveBeenCalled()
  })
})

describe('viewer.vue — fiação da exportação (T06)', () => {
  beforeEach(() => {
    useCurrentDataset().clearDataset()
  })

  afterEach(() => {
    useCurrentDataset().clearDataset()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('clicar em "Exportar" na toolbar abre o ExportModal; fechar reverte para fechado', async () => {
    const wrapper = await mountViewer()

    expect(wrapper.find('.export-overlay').exists()).toBe(false)

    await wrapper.get('.toolbar__export').trigger('click')
    expect(wrapper.find('.export-overlay').exists()).toBe(true)

    await wrapper.get('.export-overlay__cancel').trigger('click')
    expect(wrapper.find('.export-overlay').exists()).toBe(false)
  })

  it('o ExportModal recebe filteredRows/dataset.rows/displayColumns/meta.name correntes do Viewer', async () => {
    const wrapper = await mountViewer()

    await wrapper.get('.toolbar__export').trigger('click')

    expect(wrapper.get('.export-overlay__title').text()).toBe('Exportar dados')
    expect(wrapper.text()).toContain('Linhas filtradas (4)')
    expect(wrapper.text()).toContain('Todas as linhas (4)')
  })
})

describe('viewer.vue — fiação dos destaques visuais (Fase 4, T08)', () => {
  beforeEach(() => {
    useCurrentDataset().clearDataset()
    // happy-dom não calcula layout real: sem isto, o scroller do ViewerTable
    // mede offsetHeight 0 e o virtualizador não renderiza nenhuma linha do
    // corpo (ver `test/ViewerTable.spec.ts`, describe "T06").
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400)
  })

  afterEach(() => {
    useCurrentDataset().clearDataset()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  /** Dataset com as quatro condições de destaque: vazio, duplicado, negativo, data inválida. */
  function makeHighlightDataset(): Dataset {
    return {
      header: ['id', 'name', 'amount', 'created'],
      rows: [
        ['1', 'Ana', '100', '2026-01-04'],
        ['2', 'Ana', '-50', '05/13/26'],
        ['3', '', '20', '2026-02-01'],
      ],
    }
  }

  async function mountHighlightViewer() {
    useCurrentDataset().setDataset(makeHighlightDataset(), {
      name: 'highlights.csv',
      delimiter: 'comma',
      sizeBytes: 128,
      rowCount: 3,
      columnCount: 4,
    })

    const wrapper = mount(
      {
        render: () => h(Suspense, null, { default: () => h(ViewerPage) }),
      },
      { attachTo: document.body },
    )
    await flushPromises()
    return wrapper
  }

  it('monta sem erro com um dataset contendo as quatro condições e repassa columnDuplicateCounts não vazio ao ViewerTable', async () => {
    const wrapper = await mountHighlightViewer()
    await nextTick()
    await nextTick()

    // Célula duplicada ("Ana", coluna name): badge "dup ×2" no DOM — só aparece
    // se `columnDuplicateCounts` chegou não vazio ao ViewerTable.
    expect(wrapper.get('.csv-cell__dup-badge').text()).toBe('dup ×2')
  })
})

describe('viewer.vue — fiação da edição de célula (cell-editing, T09)', () => {
  // `useCellEditing`/`useCurrentDataset`/`useFilesStore` são singletons de
  // módulo (mesmo padrão de `test/ViewerTable.spec.ts`, describe "T07") — cada
  // teste abre uma conexão de IndexedDB limpa (`deleteDatabase`) e carrega um
  // dataset já persistido (com `id`), para exercitar tanto "Salvar nova
  // versão" (RF-11, sempre cria um registro novo) quanto "Sobrescrever
  // original" (RF-15, exige `meta.id`). happy-dom mede o scroller do
  // ViewerTable com offsetHeight 0 — sem o stub abaixo o virtualizador não
  // renderiza nenhuma linha do corpo (ver MEMORY
  // viewertable-virtualizer-no-body-rows-jsdom): stub + duplo nextTick.
  const CONTENT = 'id,status,amount\n1,settled,100\n2,failed,250\n3,failed,-50\n4,settled,10'

  beforeEach(async () => {
    await deleteDatabase()
    useCurrentDataset().clearDataset()
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400)
  })

  afterEach(async () => {
    useCurrentDataset().clearDataset()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    await deleteDatabase()
  })

  /** Persiste o dataset de exemplo em `files` e monta o Viewer já apontando para esse registro. */
  async function mountPersistedViewer(): Promise<{
    wrapper: Awaited<ReturnType<typeof mountViewer>>
    fileId: number
  }> {
    const fileId = await useFilesStore().saveFile({
      name: 'transactions.csv',
      delimiter: 'comma',
      size_bytes: CONTENT.length,
      row_count: 4,
      column_count: 3,
      content: CONTENT,
    })

    useCurrentDataset().setDataset(makeDataset(), {
      id: fileId,
      name: 'transactions.csv',
      delimiter: 'comma',
      sizeBytes: CONTENT.length,
      rowCount: 4,
      columnCount: 3,
    })

    const wrapper = mount(
      { render: () => h(Suspense, null, { default: () => h(ViewerPage) }) },
      { attachTo: document.body },
    )
    await flushPromises()
    await nextTick()
    await nextTick()
    return { wrapper, fileId }
  }

  it('fluxo completo: editar → confirmar → undo → redo → "Salvar nova versão" → "Sobrescrever original"', async () => {
    const { wrapper, fileId } = await mountPersistedViewer()
    const filesStore = useFilesStore()

    const bodyRows = wrapper.findAll('.viewer-table__body .viewer-table__row')
    const cell = bodyRows[0]!.findAll('.csv-cell')[1]! // coluna "status" da linha 0 ("settled")

    // Editar → confirmar (RF-01/RF-02/RF-05).
    await cell.trigger('click')
    await nextTick()
    const input = cell.find('.csv-cell__input')
    await input.setValue('pending')
    await input.trigger('keydown', { key: 'Enter' })
    await nextTick()
    await nextTick()

    expect(cell.text()).toContain('pending')
    expect(wrapper.get('button[aria-label="Desfazer"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('button[aria-label="Refazer"]').attributes('disabled')).toBeDefined()

    // Desfazer (RF-06), acionado pela toolbar.
    await wrapper.get('button[aria-label="Desfazer"]').trigger('click')
    await nextTick()

    expect(cell.text()).toContain('settled')
    expect(wrapper.get('button[aria-label="Desfazer"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[aria-label="Refazer"]').attributes('disabled')).toBeUndefined()

    // Refazer (RF-07), acionado pela toolbar.
    await wrapper.get('button[aria-label="Refazer"]').trigger('click')
    await nextTick()

    expect(cell.text()).toContain('pending')

    // "Salvar nova versão" (RF-11/RF-12): cria um novo registro, preserva o original.
    await wrapper.get('.toolbar__save-version').trigger('click')
    await flushPromises()

    const filesAfterSave = await filesStore.listFiles()
    expect(filesAfterSave).toHaveLength(2)
    const newRecord = filesAfterSave.find((f) => f.id !== fileId)
    expect(newRecord?.content).toContain('pending')
    const original = await filesStore.getFile(fileId)
    expect(original?.content).toBe(CONTENT)

    // "Sobrescrever original" (RF-15): substitui o content do mesmo id, sem novo registro.
    await wrapper.get('.toolbar__overwrite').trigger('click')
    await flushPromises()

    const filesAfterOverwrite = await filesStore.listFiles()
    expect(filesAfterOverwrite).toHaveLength(2)
    const overwritten = await filesStore.getFile(fileId)
    expect(overwritten?.content).toContain('pending')
  })
})
