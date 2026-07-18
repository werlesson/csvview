import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick, Suspense } from 'vue'
import ViewerPage from '~/pages/viewer.vue'
import {
  useCurrentDataset,
  type Dataset,
  type DatasetMeta,
} from '~/composables/useCurrentDataset'
import { useFilesStore } from '~/composables/useFilesStore'
import { deleteDatabase } from '~/composables/useDatabase'
import { useUnsavedChangesGuard } from '~/composables/useUnsavedChangesGuard'

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

describe('viewer.vue — entrada "Comparar" (file-comparison, T07)', () => {
  beforeEach(() => {
    useCurrentDataset().clearDataset()
    // happy-dom mede o scroller do ViewerTable com offsetHeight 0 — sem o stub
    // o virtualizador não renderiza nenhuma linha do corpo (ver MEMORY
    // viewertable-virtualizer-no-body-rows-jsdom).
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400)
  })

  afterEach(() => {
    useCurrentDataset().clearDataset()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('@open-compare da toolbar dispara navigateTo("/compare"), sem alterar nenhum outro estado do Viewer', async () => {
    const wrapper = await mountViewer()

    const navigateToSpy = vi
      .spyOn(globalThis as unknown as { navigateTo: (path: string) => void }, 'navigateTo')
      .mockImplementation(() => {})

    await wrapper.get('.toolbar__compare').trigger('click')

    expect(navigateToSpy).toHaveBeenCalledTimes(1)
    expect(navigateToSpy).toHaveBeenCalledWith('/compare')
    // Nenhum comportamento existente do Viewer muda (busca/filtros/exportação seguem intactos).
    expect(wrapper.find('.export-overlay').exists()).toBe(false)
    expect(wrapper.find('.filter-overlay').exists()).toBe(false)
    expect(wrapper.text()).toContain('4 linhas')
  })

  it('com edição pendente, @open-compare aciona o guard de alterações não salvas em vez de navegar direto', async () => {
    const wrapper = await mountViewer()
    await nextTick()
    await nextTick()

    const cell = wrapper.findAll('.viewer-table__body .viewer-table__row')[0]!.findAll('.csv-cell')[1]!
    await cell.trigger('dblclick')
    await nextTick()
    await cell.find('.csv-cell__input').setValue('pending')
    await cell.find('.csv-cell__input').trigger('keydown', { key: 'Enter' })
    await nextTick()
    await nextTick()

    const navigateToSpy = vi
      .spyOn(globalThis as unknown as { navigateTo: (path: string) => void }, 'navigateTo')
      .mockImplementation(() => {})

    await wrapper.get('.toolbar__compare').trigger('click')

    expect(navigateToSpy).not.toHaveBeenCalled()
    expect(useUnsavedChangesGuard().isOpen.value).toBe(true)
    useUnsavedChangesGuard().cancel()
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

describe('viewer.vue — fiação da sessão do Viewer (Fase 4, T07)', () => {
  /** Debounce padrão de `useViewerSession` (produção, `DEFAULT_DEBOUNCE_MS`). */
  const DEBOUNCE_MS = 300

  /** Dataset com 5 colunas — espaço suficiente para mutar os seis aspectos em colunas distintas. */
  function makeWideDataset(): Dataset {
    return {
      header: ['id', 'status', 'amount', 'category', 'region'],
      rows: [
        ['1', 'settled', '100', 'A', 'north'],
        ['2', 'failed', '250', 'B', 'south'],
        ['3', 'failed', '-50', 'A', 'east'],
        ['4', 'settled', '10', 'B', 'west'],
      ],
    }
  }

  function makeWideMeta(overrides: Partial<DatasetMeta> = {}): DatasetMeta {
    return {
      name: 'wide.csv',
      delimiter: 'comma',
      sizeBytes: 256,
      rowCount: 4,
      columnCount: 5,
      ...overrides,
    }
  }

  async function mountWideViewer(meta: DatasetMeta) {
    useCurrentDataset().setDataset(makeWideDataset(), meta)
    const wrapper = mount(
      {
        render: () => h(Suspense, null, { default: () => h(ViewerPage) }),
      },
      { attachTo: document.body },
    )
    // A restauração da sessão (RF-02/RF-03) encadeia várias voltas
    // assíncronas reais (abrir o IndexedDB, ler o registro, aplicar aos
    // refs) — um único `flushPromises()` não é suficiente para esvaziá-las.
    for (let i = 0; i < 5; i++) await flushPromises()
    return wrapper
  }

  /**
   * Muta os seis aspectos persistidos via UI, cada um numa coluna distinta:
   * filtra por `category`, ordena `id`+`amount` (Shift+clique), oculta
   * `region`, redimensiona `status`, reordena `category`↔`amount` e fixa `id`.
   */
  async function mutateAllSixAspects(
    wrapper: Awaited<ReturnType<typeof mountWideViewer>>,
  ): Promise<void> {
    // Filtro (RF-01/CT-01 `filters`): category == 'A'.
    await applyFilterViaUi(wrapper, '3', 'igual', 'A')

    // Ordenação (`sortKeys`): clique simples em "id", Shift+clique em "amount".
    await wrapper.findAll('.viewer-table__th-button')[0]!.trigger('click')
    await wrapper
      .findAll('.viewer-table__th-button')[2]!
      .trigger('click', { shiftKey: true })

    // Ocultar (`hidden`): desmarca "region" (índice 4) no menu "Colunas".
    await wrapper.get('.dropdown__trigger').trigger('click')
    await wrapper.findAll('.columns-menu__checkbox')[4]!.trigger('change')
    await wrapper.get('.dropdown__trigger').trigger('click')

    // Redimensionar (`widths`): "status" (agora posição 1, com "region" oculta) +50px.
    const resizeHandle = wrapper.findAll('.viewer-table__th-resize')[1]!
    await resizeHandle.trigger('pointerdown', { clientX: 100, pointerId: 1 })
    await resizeHandle.trigger('pointermove', { clientX: 150, pointerId: 1 })
    await resizeHandle.trigger('pointerup', { clientX: 150, pointerId: 1 })

    // Reordenar (`order`): troca "category" (posição 3) com "amount" (posição 2).
    const reorderButtons = wrapper.findAll('.viewer-table__th-button')
    const reorderHeaders = wrapper.findAll('.viewer-table__th')
    await reorderButtons[3]!.trigger('dragstart')
    await reorderHeaders[2]!.trigger('dragover')
    await reorderHeaders[2]!.trigger('drop')
    await reorderButtons[3]!.trigger('dragend')

    // Fixar (`pinned`): "id" (posição 0, não afetada pelas mutações acima).
    await wrapper.findAll('.viewer-table__th-pin')[0]!.trigger('click')
  }

  /** Espera a janela de debounce elapsar (escrita assíncrona, RF-01/RNF-01). */
  async function waitForDebounce(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 100))
    await flushPromises()
  }

  /** Assinatura observável (via DOM) dos seis aspectos, para comparar pré/pós remount. */
  function captureSignals(wrapper: Awaited<ReturnType<typeof mountWideViewer>>) {
    const headers = wrapper.findAll('.viewer-table__th')
    return {
      labels: headers.map((h) => h.get('.viewer-table__th-label').text()),
      styles: headers.map((h) => h.attributes('style')),
      pinned: headers.map((h) => h.classes().includes('viewer-table__th--pinned')),
      sortIcons: headers.map((h) => {
        const icon = h.find('.viewer-table__th-sort-icon')
        return icon.exists()
          ? icon.classes().find((c) => c.startsWith('viewer-table__th-sort-icon--'))
          : null
      }),
      priorities: headers.map((h) => {
        const priority = h.find('.viewer-table__th-priority')
        return priority.exists() ? priority.text() : null
      }),
      filterBadge: wrapper.find('.toolbar__filters-badge').exists()
        ? wrapper.get('.toolbar__filters-badge').text()
        : null,
      rowCountText: wrapper.get('.toolbar__count').text(),
    }
  }

  beforeEach(async () => {
    useCurrentDataset().clearDataset()
    await deleteDatabase()
  })

  afterEach(async () => {
    useCurrentDataset().clearDataset()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    await deleteDatabase()
  })

  it('mutar filtro + ordenação (2 colunas) + ocultar + redimensionar + reordenar + fixar, remontar restaura os seis aspectos idênticos', async () => {
    const meta = makeWideMeta({ id: 1 })
    const wrapper = await mountWideViewer(meta)

    await mutateAllSixAspects(wrapper)
    const before = captureSignals(wrapper)

    // Confere que as mutações realmente pegaram, antes de comparar com o remount.
    expect(before.filterBadge).toBe('1')
    expect(before.rowCountText).toContain('2 linhas')
    expect(before.pinned.some(Boolean)).toBe(true)
    expect(before.sortIcons.filter((icon) => icon !== null)).toHaveLength(2)
    expect(before.priorities.filter((p) => p !== null)).toHaveLength(2)
    expect(before.labels).not.toContain('region')

    await waitForDebounce()
    wrapper.unmount()

    // Remonta com o MESMO dataset/meta ainda em memória (mesma convenção de
    // "reload" já usada neste repo — ver PLAN.md "Open Questions").
    const remounted = await mountWideViewer(meta)
    const after = captureSignals(remounted)

    expect(after).toEqual(before)
  })

  it('reabrir com um meta.id diferente não herda a sessão do primeiro arquivo (isolamento por id)', async () => {
    const firstMeta = makeWideMeta({ id: 1 })
    const firstWrapper = await mountWideViewer(firstMeta)

    await mutateAllSixAspects(firstWrapper)
    await waitForDebounce()
    firstWrapper.unmount()

    const secondMeta = makeWideMeta({ id: 2 })
    const secondWrapper = await mountWideViewer(secondMeta)
    const signals = captureSignals(secondWrapper)

    // Estado padrão: nenhuma coluna fixada, nenhum ícone/prioridade de
    // ordenação, todas as colunas visíveis (inclusive "region") e sem filtro.
    expect(signals.pinned.every((p) => p === false)).toBe(true)
    expect(signals.sortIcons.every((icon) => icon === null)).toBe(true)
    expect(signals.priorities.every((p) => p === null)).toBe(true)
    expect(signals.labels).toEqual(['id', 'status', 'amount', 'category', 'region'])
    expect(signals.filterBadge).toBeNull()
    expect(signals.rowCountText).toContain('4 linhas')
  })

  it('um dataset com meta.id === undefined permanece funcional e não acessa IndexedDB/localStorage', async () => {
    const wrapper = await mountWideViewer(makeWideMeta({ id: undefined }))

    const openSpy = vi.spyOn(indexedDB, 'open')
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem')
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    await mutateAllSixAspects(wrapper)
    await waitForDebounce()

    const signals = captureSignals(wrapper)
    expect(signals.filterBadge).toBe('1')
    expect(signals.rowCountText).toContain('2 linhas')
    expect(signals.pinned.some(Boolean)).toBe(true)

    expect(openSpy).not.toHaveBeenCalled()
    expect(getItemSpy).not.toHaveBeenCalled()
    expect(setItemSpy).not.toHaveBeenCalled()
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
    await cell.trigger('dblclick')
    await nextTick()
    const input = cell.find('.csv-cell__input')
    await input.setValue('pending')
    await input.trigger('keydown', { key: 'Enter' })
    await nextTick()
    await nextTick()

    expect(cell.text()).toContain('pending')
    expect(wrapper.get('button[aria-label="Desfazer (Ctrl+Z)"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('button[aria-label="Refazer (Ctrl+R)"]').attributes('disabled')).toBeDefined()

    // Desfazer (RF-06), acionado pela toolbar.
    await wrapper.get('button[aria-label="Desfazer (Ctrl+Z)"]').trigger('click')
    await nextTick()

    expect(cell.text()).toContain('settled')
    expect(wrapper.get('button[aria-label="Desfazer (Ctrl+Z)"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[aria-label="Refazer (Ctrl+R)"]').attributes('disabled')).toBeUndefined()

    // Refazer (RF-07), acionado pela toolbar.
    await wrapper.get('button[aria-label="Refazer (Ctrl+R)"]').trigger('click')
    await nextTick()

    expect(cell.text()).toContain('pending')

    // "Salvar como cópia" (RF-11/RF-12): abre o modal de nomeação; só cria o
    // novo registro (preservando o original) ao confirmar, com o nome sugerido.
    await wrapper.get('.toolbar__save-version').trigger('click')
    await nextTick()
    expect(wrapper.find('.save-copy-overlay').exists()).toBe(true)
    await wrapper.get('.save-copy-overlay__confirm').trigger('click')
    await flushPromises()
    await nextTick()

    const filesAfterSave = await filesStore.listFiles()
    expect(filesAfterSave).toHaveLength(2)
    const newRecord = filesAfterSave.find((f) => f.id !== fileId)!
    expect(newRecord.content).toContain('pending')
    expect(newRecord.name).toBe('transactions (cópia).csv')
    const original = await filesStore.getFile(fileId)
    expect(original?.content).toBe(CONTENT)

    // A visualização passa a apontar para a cópia recém-salva: sem edição
    // pendente em relação a ela, "Salvar" (sobrescrever) fica desabilitado.
    expect(useCurrentDataset().meta.value?.id).toBe(newRecord.id)
    expect(useCurrentDataset().meta.value?.name).toBe('transactions (cópia).csv')
    expect(wrapper.get('.toolbar__overwrite').attributes('disabled')).toBeDefined()

    // Uma nova edição reabilita "Salvar" — e, como a visualização agora aponta
    // para a cópia, sobrescrever afeta a cópia, nunca o registro original (RF-15).
    await cell.trigger('dblclick')
    await nextTick()
    await cell.find('.csv-cell__input').setValue('confirmed')
    await cell.find('.csv-cell__input').trigger('keydown', { key: 'Enter' })
    await nextTick()
    await nextTick()

    await wrapper.get('.toolbar__overwrite').trigger('click')
    await nextTick()
    expect(wrapper.find('.confirm-overlay').exists()).toBe(true)
    await wrapper.get('.confirm-overlay__confirm').trigger('click')
    await flushPromises()

    const filesAfterOverwrite = await filesStore.listFiles()
    expect(filesAfterOverwrite).toHaveLength(2)
    const untouchedOriginal = await filesStore.getFile(fileId)
    expect(untouchedOriginal?.content).toBe(CONTENT)
    const overwrittenCopy = await filesStore.getFile(newRecord.id)
    expect(overwrittenCopy?.content).toContain('confirmed')
  })

  describe('atalhos de teclado globais (Ctrl/Cmd+Z, Ctrl/Cmd+R, Ctrl/Cmd+S)', () => {
    async function editFirstCell(
      wrapper: Awaited<ReturnType<typeof mountPersistedViewer>>['wrapper'],
      value: string,
    ): Promise<void> {
      const cell = wrapper
        .findAll('.viewer-table__body .viewer-table__row')[0]!
        .findAll('.csv-cell')[1]!
      await cell.trigger('dblclick')
      await nextTick()
      await cell.find('.csv-cell__input').setValue(value)
      await cell.find('.csv-cell__input').trigger('keydown', { key: 'Enter' })
      await nextTick()
      await nextTick()
    }

    function pressGlobal(key: string): void {
      window.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, cancelable: true }))
    }

    it('Ctrl+Z desfaz a edição confirmada mais recente', async () => {
      const { wrapper } = await mountPersistedViewer()
      const cell = wrapper
        .findAll('.viewer-table__body .viewer-table__row')[0]!
        .findAll('.csv-cell')[1]!
      await editFirstCell(wrapper, 'pending')
      expect(cell.text()).toContain('pending')

      pressGlobal('z')
      await nextTick()

      expect(cell.text()).toContain('settled')
    })

    it('Ctrl+R refaz a edição desfeita mais recente', async () => {
      const { wrapper } = await mountPersistedViewer()
      const cell = wrapper
        .findAll('.viewer-table__body .viewer-table__row')[0]!
        .findAll('.csv-cell')[1]!
      await editFirstCell(wrapper, 'pending')
      pressGlobal('z')
      await nextTick()
      expect(cell.text()).toContain('settled')

      pressGlobal('r')
      await nextTick()

      expect(cell.text()).toContain('pending')
    })

    it('Ctrl+S abre o modal de confirmação de sobrescrita, sem sobrescrever direto', async () => {
      const { wrapper } = await mountPersistedViewer()
      await editFirstCell(wrapper, 'pending')

      expect(wrapper.find('.confirm-overlay').exists()).toBe(false)
      pressGlobal('s')
      await nextTick()

      expect(wrapper.find('.confirm-overlay').exists()).toBe(true)
    })

    it('Ctrl+S é inerte sem alteração pendente (nenhuma edição desde o carregamento)', async () => {
      const { wrapper } = await mountPersistedViewer()

      pressGlobal('s')
      await nextTick()

      expect(wrapper.find('.confirm-overlay').exists()).toBe(false)
    })

    it('os atalhos são ignorados enquanto o foco está no input de edição de uma célula (não atropela a digitação/undo nativo)', async () => {
      const { wrapper } = await mountPersistedViewer()
      const cell = wrapper
        .findAll('.viewer-table__body .viewer-table__row')[0]!
        .findAll('.csv-cell')[1]!
      await cell.trigger('dblclick')
      await nextTick()
      const input = cell.find('.csv-cell__input')
      await input.setValue('pending')

      input.element.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }),
      )
      await nextTick()

      expect(wrapper.find('.confirm-overlay').exists()).toBe(false)
      // A edição segue em rascunho, não confirmada — Ctrl+S não a validou nem fechou o input.
      expect(cell.find('.csv-cell__input').exists()).toBe(true)
    })
  })
})

describe('viewer.vue — guard nativo de recarregar/fechar aba (beforeunload)', () => {
  beforeEach(() => {
    useCurrentDataset().clearDataset()
    // happy-dom mede o scroller do ViewerTable com offsetHeight 0 — sem o stub
    // o virtualizador não renderiza nenhuma linha do corpo (ver MEMORY
    // viewertable-virtualizer-no-body-rows-jsdom).
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400)
  })

  afterEach(() => {
    useCurrentDataset().clearDataset()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('sem edição pendente, beforeunload não é interceptado', async () => {
    await mountViewer()

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it('com edição pendente, beforeunload é interceptado (preventDefault + returnValue)', async () => {
    const wrapper = await mountViewer()
    await nextTick()
    await nextTick()
    const cell = wrapper
      .findAll('.viewer-table__body .viewer-table__row')[0]!
      .findAll('.csv-cell')[1]!
    await cell.trigger('dblclick')
    await nextTick()
    await cell.find('.csv-cell__input').setValue('pending')
    await cell.find('.csv-cell__input').trigger('keydown', { key: 'Enter' })
    await nextTick()
    await nextTick()

    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(event.returnValue).toBe('')
  })
})

describe('viewer.vue — testes de integração cross-cutting (cell-editing, T10)', () => {
  // Nenhuma alteração de produção nesta suíte — só os 3 cenários que não cabem
  // isoladamente em nenhum componente/composable individual (RF-13, RF-10).
  // Mesmo stub de `offsetHeight` + duplo `nextTick` de `test/ViewerTable.spec.ts`
  // (ver MEMORY viewertable-virtualizer-no-body-rows-jsdom): sem ele o
  // virtualizador não renderiza nenhuma linha do corpo em happy-dom.
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

  it('RF-13: confirmar uma edição que deixa de satisfazer um filtro ativo remove a linha da view imediatamente', async () => {
    const wrapper = await mountViewer()
    await nextTick()
    await nextTick()

    // Filtra por status = "failed" (linhas originais 1 e 2, nesta ordem).
    await applyFilterViaUi(wrapper, '1', 'igual', 'failed')
    expect(wrapper.text()).toContain('2 linhas')

    let bodyRows = wrapper.findAll('.viewer-table__body .viewer-table__row')
    expect(bodyRows).toHaveLength(2)

    // Edita a coluna "status" da primeira linha filtrada (id=2, "failed" → "settled"),
    // deixando de satisfazer o filtro "status igual a failed".
    const cell = bodyRows[0]!.findAll('.csv-cell')[1]!
    await cell.trigger('dblclick')
    await nextTick()
    await cell.find('.csv-cell__input').setValue('settled')
    await cell.find('.csv-cell__input').trigger('keydown', { key: 'Enter' })
    await nextTick()
    await nextTick()

    // A linha some da view imediatamente, sem nenhuma ação adicional (refresh/reaplicar filtro).
    expect(wrapper.text()).toContain('1 linhas')
    bodyRows = wrapper.findAll('.viewer-table__body .viewer-table__row')
    expect(bodyRows).toHaveLength(1)
    expect(bodyRows[0]!.text()).toContain('failed')
    expect(bodyRows[0]!.text()).toContain('-50')
  })

  it('RF-13: confirmar uma edição que muda a posição relativa da linha sob ordenação ativa reposiciona a linha imediatamente', async () => {
    const wrapper = await mountViewer()
    await nextTick()
    await nextTick()

    // Ordena por "amount" (clique simples no cabeçalho, sem Shift) — ascendente.
    const headerButtons = wrapper.findAll('.viewer-table__th-button')
    await headerButtons[2]!.trigger('click')
    await nextTick()

    let bodyRows = wrapper.findAll('.viewer-table__body .viewer-table__row')
    expect(bodyRows).toHaveLength(4)
    expect(bodyRows[0]!.text()).toContain('-50')
    expect(bodyRows[1]!.text()).toContain('10')
    expect(bodyRows[2]!.text()).toContain('100')
    expect(bodyRows[3]!.text()).toContain('250')

    // Edita a linha de amount=10 (posição 1, id=4) para 5000 — passa a ser a maior.
    const cell = bodyRows[1]!.findAll('.csv-cell')[2]!
    await cell.trigger('dblclick')
    await nextTick()
    await cell.find('.csv-cell__input').setValue('5000')
    await cell.find('.csv-cell__input').trigger('keydown', { key: 'Enter' })
    await nextTick()
    await nextTick()

    // A linha se reposiciona imediatamente conforme a chave de ordenação ativa,
    // sem nenhum refresh/reaplicação explícita do usuário.
    bodyRows = wrapper.findAll('.viewer-table__body .viewer-table__row')
    expect(bodyRows).toHaveLength(4)
    expect(bodyRows[0]!.text()).toContain('-50')
    expect(bodyRows[1]!.text()).toContain('100')
    expect(bodyRows[2]!.text()).toContain('250')
    expect(bodyRows[3]!.text()).toContain('5000')
  })

  it('RF-10: reabrir um dataset diferente zera canUndo/canRedo e o indicador de "sujo" de qualquer célula editada no dataset anterior', async () => {
    const filesStore = useFilesStore()
    const fileIdA = await filesStore.saveFile({
      name: 'a.csv',
      delimiter: 'comma',
      size_bytes: CONTENT.length,
      row_count: 4,
      column_count: 3,
      content: CONTENT,
    })

    useCurrentDataset().setDataset(makeDataset(), {
      id: fileIdA,
      name: 'a.csv',
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

    // Edita e confirma uma célula do dataset A — registra 1 entrada desfazível e marca "sujo".
    const bodyRows = wrapper.findAll('.viewer-table__body .viewer-table__row')
    const cell = bodyRows[0]!.findAll('.csv-cell')[1]!
    await cell.trigger('dblclick')
    await nextTick()
    await cell.find('.csv-cell__input').setValue('pending')
    await cell.find('.csv-cell__input').trigger('keydown', { key: 'Enter' })
    await nextTick()
    await nextTick()

    expect(cell.find('.csv-cell__dirty-indicator').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="Desfazer (Ctrl+Z)"]').attributes('disabled')).toBeUndefined()

    // Reabre um dataset diferente (novo `id`) — simula reabrir outro arquivo no Viewer.
    const OTHER_CONTENT = 'x,y\n1,2\n3,4'
    const fileIdB = await filesStore.saveFile({
      name: 'b.csv',
      delimiter: 'comma',
      size_bytes: OTHER_CONTENT.length,
      row_count: 2,
      column_count: 2,
      content: OTHER_CONTENT,
    })

    useCurrentDataset().setDataset(
      { header: ['x', 'y'], rows: [['1', '2'], ['3', '4']] },
      {
        id: fileIdB,
        name: 'b.csv',
        delimiter: 'comma',
        sizeBytes: OTHER_CONTENT.length,
        rowCount: 2,
        columnCount: 2,
      },
    )
    await nextTick()
    await nextTick()

    // Undo/redo inertes (botões seguem visíveis, porém desabilitados) e nenhuma
    // célula "suja" sobrevive à troca de dataset (RF-10).
    expect(wrapper.get('button[aria-label="Desfazer (Ctrl+Z)"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[aria-label="Refazer (Ctrl+R)"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.csv-cell__dirty-indicator').exists()).toBe(false)
  })
})
