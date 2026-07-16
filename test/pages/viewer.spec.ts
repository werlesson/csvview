import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick, Suspense } from 'vue'
import ViewerPage from '~/pages/viewer.vue'
import {
  useCurrentDataset,
  type Dataset,
  type DatasetMeta,
} from '~/composables/useCurrentDataset'
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
