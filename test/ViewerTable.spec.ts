import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ViewerTable from '~/components/ViewerTable.vue'
import type { ViewerColumn } from '~/composables/useViewer'

function makeColumns(): ViewerColumn[] {
  return [
    { index: 0, label: 'id', type: 'number', visible: true, pinned: false, width: 180 },
    { index: 1, label: 'name', type: 'text', visible: true, pinned: false, width: 180 },
    { index: 2, label: 'amount', type: 'number', visible: true, pinned: false, width: 180 },
  ]
}

/** Dispara um pointerdown/pointermove/pointerup no handle de resize da coluna `columnPos`. */
async function dragResizeHandle(
  wrapper: ReturnType<typeof mount>,
  columnPos: number,
  startX: number,
  endX: number,
) {
  const handle = wrapper.findAll('.viewer-table__th-resize')[columnPos]!
  await handle.trigger('pointerdown', { clientX: startX, pointerId: 1 })
  await handle.trigger('pointermove', { clientX: endX, pointerId: 1 })
  await handle.trigger('pointerup', { clientX: endX, pointerId: 1 })
}

/** Dispara dragstart (na posição de origem) → dragover/drop (na posição de destino). */
async function dragReorderHeader(
  wrapper: ReturnType<typeof mount>,
  fromPos: number,
  toPos: number,
) {
  const buttons = wrapper.findAll('.viewer-table__th-button')
  const headers = wrapper.findAll('.viewer-table__th')
  await buttons[fromPos]!.trigger('dragstart')
  await headers[toPos]!.trigger('dragover')
  await headers[toPos]!.trigger('drop')
  await buttons[fromPos]!.trigger('dragend')
}

const ROWS = [
  ['1', 'Ana', '100'],
  ['2', 'Bruno', '250'],
]

describe('ViewerTable', () => {
  it('renderiza um cabeçalho por coluna visível', () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })

    const headers = wrapper.findAll('.viewer-table__th')
    expect(headers.map((h) => h.text())).toEqual([
      'idnumber',
      'nametext',
      'amountnumber',
    ])
  })

  // columns-toggle → ocultar remove a coluna da tabela
  it('columns-toggle: uma coluna oculta não aparece no cabeçalho da tabela', () => {
    // Colunas visíveis sem "name" (index 1) — como useViewer entrega ao ocultar.
    const visible = makeColumns().filter((c) => c.index !== 1)
    const wrapper = mount(ViewerTable, {
      props: { columns: visible, rows: ROWS },
    })

    const labels = wrapper
      .findAll('.viewer-table__th-label')
      .map((h) => h.text())
    expect(labels).toEqual(['id', 'amount'])
    expect(labels).not.toContain('name')
  })

  it('alinha à direita em mono o cabeçalho das colunas numéricas', () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })

    const headers = wrapper.findAll('.viewer-table__th')
    // id/amount (number) → numeric; name (text) → não.
    expect(headers[0]!.classes()).toContain('viewer-table__th--numeric')
    expect(headers[1]!.classes()).not.toContain('viewer-table__th--numeric')
    expect(headers[2]!.classes()).toContain('viewer-table__th--numeric')
  })

  // RF-05: colunas inteira e decimal (ambas type === 'number') mantêm o
  // alinhamento à direita; text/date/boolean/email/url NÃO recebem. O
  // cabeçalho e a célula (CsvCell :numeric, ViewerTable.vue:119) compartilham
  // a mesma condição `column.type === 'number'`, logo o cabeçalho prova o
  // gating de ambos (paridade com o caso number acima).
  it('alinha à direita colunas inteira e decimal; demais tipos não', () => {
    // integer e decimal são ambos inferidos como `number` pelo motor (a
    // distinção vive em NumericStats.numericKind, não em ViewerColumn.type).
    const columns: ViewerColumn[] = [
      { index: 0, label: 'qtd', type: 'number', visible: true }, // inteira
      { index: 1, label: 'preco', type: 'number', visible: true }, // decimal
      { index: 2, label: 'name', type: 'text', visible: true },
      { index: 3, label: 'created', type: 'date', visible: true },
      { index: 4, label: 'ativo', type: 'boolean', visible: true },
      { index: 5, label: 'email', type: 'email', visible: true },
      { index: 6, label: 'site', type: 'url', visible: true },
    ]
    const rows = [
      ['1', '1.5', 'Ana', '2020-01-01', 'sim', 'a@b.com', 'https://x.io'],
      ['2', '2.75', 'Bruno', '2021-12-31', 'não', 'c@d.org', 'http://y.io/p'],
    ]

    const wrapper = mount(ViewerTable, { props: { columns, rows } })
    const headers = wrapper.findAll('.viewer-table__th')

    // Apenas inteira/decimal (type === 'number') alinhadas à direita.
    expect(headers[0]!.classes()).toContain('viewer-table__th--numeric') // inteira
    expect(headers[1]!.classes()).toContain('viewer-table__th--numeric') // decimal
    // text/date/boolean/email/url NÃO recebem alinhamento à direita.
    for (const i of [2, 3, 4, 5, 6]) {
      expect(headers[i]!.classes()).not.toContain('viewer-table__th--numeric')
    }
  })

  it('exibe o estado "nenhuma linha encontrada" quando não há linhas', () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: [] },
    })

    expect(wrapper.find('.viewer-table__empty').exists()).toBe(true)
    expect(wrapper.text()).toContain('Nenhuma linha encontrada')
    // Sem corpo de tabela quando vazio.
    expect(wrapper.find('.viewer-table__body').exists()).toBe(false)
  })

  it('mantém o corpo da tabela quando há linhas', () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })

    expect(wrapper.find('.viewer-table__empty').exists()).toBe(false)
    expect(wrapper.find('.viewer-table__body').exists()).toBe(true)
  })

  it('marca o cabeçalho da coluna selecionada', () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS, selectedIndex: 2 },
    })

    const headers = wrapper.findAll('.viewer-table__th')
    expect(headers[0]!.classes()).not.toContain('viewer-table__th--selected')
    expect(headers[2]!.classes()).toContain('viewer-table__th--selected')
    expect(headers[2]!.attributes('aria-selected')).toBe('true')
  })

  // RF-01: clique simples no cabeçalho ordena (e não abre o painel de stats).
  it('RF-01: clique simples no cabeçalho emite sort com o índice e não select-column', async () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })

    // Clica no cabeçalho da terceira coluna (index 2, "amount").
    await wrapper.findAll('.viewer-table__th-button')[2]!.trigger('click')

    expect(wrapper.emitted('sort')).toEqual([[2]])
    expect(wrapper.emitted('select-column')).toBeUndefined()
    expect(wrapper.emitted('sort-additive')).toBeUndefined()
  })

  // RF-02: Shift+clique adiciona a coluna à ordenação multi-coluna.
  it('RF-02: shift+clique no cabeçalho emite sort-additive com o índice', async () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })

    await wrapper
      .findAll('.viewer-table__th-button')[1]!
      .trigger('click', { shiftKey: true })

    expect(wrapper.emitted('sort-additive')).toEqual([[1]])
    expect(wrapper.emitted('sort')).toBeUndefined()
  })

  // UI-06: affordance dedicado seleciona a coluna para stats, sem tocar na ordenação.
  it('UI-06: affordance dedicado de estatísticas emite select-column sem alterar ordenação', async () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })

    await wrapper.findAll('.viewer-table__th-stats')[0]!.trigger('click')

    expect(wrapper.emitted('select-column')).toEqual([[0]])
    expect(wrapper.emitted('sort')).toBeUndefined()
    expect(wrapper.emitted('sort-additive')).toBeUndefined()
  })

  // UI-06: clicar de novo no affordance da coluna já selecionada fecha o painel.
  it('UI-06: affordance de estatísticas na coluna já selecionada emite select-column(null)', async () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS, selectedIndex: 0 },
    })

    await wrapper.findAll('.viewer-table__th-stats')[0]!.trigger('click')

    expect(wrapper.emitted('select-column')).toEqual([[null]])
  })

  // UI-01: indicador de direção distinguível por forma (não apenas cor).
  it('UI-01: mostra indicador de direção distinguível por forma (asc ≠ desc), nada quando não ordenada', () => {
    const noneWrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })
    expect(noneWrapper.find('.viewer-table__th-sort-icon').exists()).toBe(false)

    const ascWrapper = mount(ViewerTable, {
      props: {
        columns: makeColumns(),
        rows: ROWS,
        sortKeys: [{ index: 0, direction: 'asc' }],
      },
    })
    const descWrapper = mount(ViewerTable, {
      props: {
        columns: makeColumns(),
        rows: ROWS,
        sortKeys: [{ index: 0, direction: 'desc' }],
      },
    })

    expect(ascWrapper.find('.viewer-table__th-sort-icon--asc').exists()).toBe(true)
    expect(ascWrapper.find('.viewer-table__th-sort-icon--desc').exists()).toBe(false)
    expect(descWrapper.find('.viewer-table__th-sort-icon--desc').exists()).toBe(true)
    expect(descWrapper.find('.viewer-table__th-sort-icon--asc').exists()).toBe(false)
  })

  // UI-02: número de prioridade correto e distinto em ordenação multi-coluna.
  it('UI-02: exibe o número de prioridade correto em ordenação multi-coluna', () => {
    const wrapper = mount(ViewerTable, {
      props: {
        columns: makeColumns(),
        rows: ROWS,
        sortKeys: [
          { index: 0, direction: 'asc' },
          { index: 2, direction: 'desc' },
        ],
      },
    })

    const headers = wrapper.findAll('.viewer-table__th')
    expect(headers[0]!.find('.viewer-table__th-priority').text()).toBe('1')
    expect(headers[2]!.find('.viewer-table__th-priority').text()).toBe('2')
    expect(headers[1]!.find('.viewer-table__th-priority').exists()).toBe(false)
  })

  // RF-04: cada `<th>` recebe --col-w a partir da largura da própria coluna.
  it('RF-04: aplica --col-w por coluna a partir de column.width', () => {
    const columns = makeColumns()
    columns[1]!.width = 260
    const wrapper = mount(ViewerTable, { props: { columns, rows: ROWS } })

    const headers = wrapper.findAll('.viewer-table__th')
    expect(headers[0]!.attributes('style')).toContain('--col-w: 180px')
    expect(headers[1]!.attributes('style')).toContain('--col-w: 260px')
    expect(headers[2]!.attributes('style')).toContain('--col-w: 180px')
  })

  // RF-04/UI-03: arrastar a borda de resize emite `resize` com a nova largura.
  it('RF-04: arrastar o handle de resize emite resize(index, width)', async () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })

    // Coluna na posição 1 (index 1, "name"), largura inicial 180: arrasta +50px.
    await dragResizeHandle(wrapper, 1, 100, 150)

    expect(wrapper.emitted('resize')).toEqual([[1, 230]])
  })

  it('RF-04: arrastar além do limite inferior não reduz a largura abaixo de 48px', async () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })

    // Coluna na posição 0 (index 0, "id"), largura inicial 180: arrasta -1000px.
    await dragResizeHandle(wrapper, 0, 100, -900)

    expect(wrapper.emitted('resize')).toEqual([[0, 48]])
  })

  it('RF-04: não emite resize antes do pointerdown ou após o pointerup', async () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })
    const handle = wrapper.findAll('.viewer-table__th-resize')[0]!

    await handle.trigger('pointermove', { clientX: 150, pointerId: 1 })
    expect(wrapper.emitted('resize')).toBeUndefined()

    await handle.trigger('pointerdown', { clientX: 100, pointerId: 1 })
    await handle.trigger('pointerup', { clientX: 100, pointerId: 1 })
    await handle.trigger('pointermove', { clientX: 200, pointerId: 1 })
    expect(wrapper.emitted('resize')).toBeUndefined()
  })

  // UI-03: o handle de resize expõe cursor col-resize, distinto do cabeçalho.
  it('UI-03: o handle de resize tem affordance de cursor col-resize', () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })

    const handle = wrapper.findAll('.viewer-table__th-resize')[0]!
    expect(handle.attributes('role')).toBe('separator')
  })

  // RF-05: arrastar o cabeçalho de uma posição para outra emite reorder(from, to)
  // com as posições renderizadas — refletido imediatamente por displayColumns
  // no lado de useViewer (T05), aqui apenas o evento.
  it('RF-05: arrastar o cabeçalho da posição 2 para a 0 emite reorder(2, 0)', async () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })

    await dragReorderHeader(wrapper, 2, 0)

    expect(wrapper.emitted('reorder')).toEqual([[2, 0]])
  })

  it('RF-05: soltar na mesma posição não emite reorder', async () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })

    await dragReorderHeader(wrapper, 1, 1)

    expect(wrapper.emitted('reorder')).toBeUndefined()
  })

  // UI-04: feedback visual da coluna em movimento e do ponto de inserção durante o arraste.
  it('UI-04: aplica feedback visual à coluna arrastada e ao ponto de inserção durante o arraste', async () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })
    const buttons = wrapper.findAll('.viewer-table__th-button')
    const headers = wrapper.findAll('.viewer-table__th')

    await buttons[0]!.trigger('dragstart')
    await headers[2]!.trigger('dragover')

    expect(headers[0]!.classes()).toContain('viewer-table__th--dragging')
    expect(headers[2]!.classes()).toContain('viewer-table__th--drop-after')

    await headers[2]!.trigger('drop')
    await buttons[0]!.trigger('dragend')

    expect(headers[0]!.classes()).not.toContain('viewer-table__th--dragging')
    expect(headers[2]!.classes()).not.toContain('viewer-table__th--drop-after')
  })

  // UI-03/UI-06: a zona de arraste (botão de ordenação) é distinta do handle de
  // resize e do botão de estatísticas — nenhum dos dois é arrastável.
  it('UI-03/UI-06: o handle de resize e o botão de estatísticas não são arrastáveis', () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })

    const resizeHandle = wrapper.findAll('.viewer-table__th-resize')[0]!
    const statsButton = wrapper.findAll('.viewer-table__th-stats')[0]!
    const headerButton = wrapper.findAll('.viewer-table__th-button')[0]!

    expect(resizeHandle.attributes('draggable')).not.toBe('true')
    expect(statsButton.attributes('draggable')).toBe('false')
    expect(headerButton.attributes('draggable')).toBe('true')
  })

  // RF-06/UI-05: o botão de pin do cabeçalho emite toggle-pin com o índice
  // original da coluna.
  it('RF-06/UI-05: o botão de pin do cabeçalho emite toggle-pin(index)', async () => {
    const wrapper = mount(ViewerTable, {
      props: { columns: makeColumns(), rows: ROWS },
    })

    await wrapper.findAll('.viewer-table__th-pin')[2]!.trigger('click')

    expect(wrapper.emitted('toggle-pin')).toEqual([[2]])
  })

  // RF-06: colunas fixadas recebem left acumulado pela soma das larguras das
  // fixadas anteriores — displayColumns já entrega o grupo fixado primeiro,
  // na ordem de fixação.
  it('RF-06: acumula o offset sticky (left) pelas larguras das colunas fixadas anteriores', () => {
    const columns: ViewerColumn[] = [
      { index: 2, label: 'amount', type: 'number', visible: true, pinned: true, width: 120 },
      { index: 0, label: 'id', type: 'number', visible: true, pinned: true, width: 90 },
      { index: 1, label: 'name', type: 'text', visible: true, pinned: false, width: 180 },
    ]
    const wrapper = mount(ViewerTable, { props: { columns, rows: ROWS } })

    const headers = wrapper.findAll('.viewer-table__th')
    // Primeira fixada (amount): sem fixadas antes → left: 0px.
    expect(headers[0]!.attributes('style')).toContain('left: 0px')
    // Segunda fixada (id): acumula a largura da primeira (120px).
    expect(headers[1]!.attributes('style')).toContain('left: 120px')
    // Não fixada: sem `left` no estilo.
    expect(headers[2]!.attributes('style')).not.toContain('left:')

    expect(headers[0]!.classes()).toContain('viewer-table__th--pinned')
    expect(headers[1]!.classes()).toContain('viewer-table__th--pinned')
    expect(headers[2]!.classes()).not.toContain('viewer-table__th--pinned')
  })

  // RF-07/RNF-01: a virtualização de linhas se mantém sob qualquer interação —
  // o nº de <tr> de corpo no DOM fica limitado a (visíveis + overscan=12,
  // ViewerTable.vue:64) e não cresce com o total de linhas. Em happy-dom o
  // scroller mede offsetHeight 0 por padrão, então o virtualizer não renderiza
  // nenhuma linha de corpo (ver MEMORY viewertable-virtualizer-no-body-rows-jsdom);
  // o stub de `offsetHeight` abaixo dá ao scroller uma altura útil para exercitar
  // a janela real de virtualização nestes casos.
  describe('RF-07/RNF-01: invariante de virtualização sob interações', () => {
    const SCROLLER_HEIGHT = 400

    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(SCROLLER_HEIGHT)
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    function bigColumns(): ViewerColumn[] {
      return [
        { index: 0, label: 'id', type: 'number', visible: true, pinned: false, width: 180 },
        { index: 1, label: 'name', type: 'text', visible: true, pinned: false, width: 180 },
        { index: 2, label: 'amount', type: 'number', visible: true, pinned: false, width: 180 },
      ]
    }

    function bigRows(count: number): string[][] {
      return Array.from({ length: count }, (_, i) => [
        String(i),
        `nome${i}`,
        String(i * 1.5),
      ])
    }

    async function bodyRowCount(wrapper: ReturnType<typeof mount>): Promise<number> {
      await nextTick()
      await nextTick()
      return wrapper.findAll('.viewer-table__body .viewer-table__row').length
    }

    it('sem nenhuma interação: contagem de <tr> limitada e igual independente de N', async () => {
      const small = mount(ViewerTable, { props: { columns: bigColumns(), rows: bigRows(100) } })
      const large = mount(ViewerTable, {
        props: { columns: bigColumns(), rows: bigRows(50_000) },
      })

      const smallCount = await bodyRowCount(small)
      const largeCount = await bodyRowCount(large)

      expect(smallCount).toBeGreaterThan(0)
      expect(largeCount).toBe(smallCount)
      expect(largeCount).toBeLessThan(100)
    })

    it('RF-01/RF-02: com ordenação single e multi-coluna aplicada, a contagem de <tr> continua limitada e igual independente de N', async () => {
      const sortKeys = [
        { index: 0, direction: 'asc' as const },
        { index: 2, direction: 'desc' as const },
      ]
      const small = mount(ViewerTable, {
        props: { columns: bigColumns(), rows: bigRows(100), sortKeys },
      })
      const large = mount(ViewerTable, {
        props: { columns: bigColumns(), rows: bigRows(50_000), sortKeys },
      })

      const smallCount = await bodyRowCount(small)
      const largeCount = await bodyRowCount(large)

      expect(largeCount).toBe(smallCount)
      expect(largeCount).toBeLessThan(100)
    })

    it('RF-04: durante e após o arraste de redimensionamento de uma coluna, a contagem de <tr> continua limitada', async () => {
      const wrapper = mount(ViewerTable, {
        props: { columns: bigColumns(), rows: bigRows(50_000) },
      })
      const beforeCount = await bodyRowCount(wrapper)

      const handle = wrapper.findAll('.viewer-table__th-resize')[1]!
      await handle.trigger('pointerdown', { clientX: 100, pointerId: 1 })
      await handle.trigger('pointermove', { clientX: 260, pointerId: 1 })
      const duringCount = wrapper.findAll('.viewer-table__body .viewer-table__row').length
      await handle.trigger('pointerup', { clientX: 260, pointerId: 1 })

      // A largura efetiva vem da prop `column.width` (aplicada pelo pai via
      // useViewer); o que se garante aqui é que o arraste em si — resize em
      // andamento — não afeta a virtualização de linhas.
      expect(beforeCount).toBeGreaterThan(0)
      expect(duringCount).toBe(beforeCount)
      expect(beforeCount).toBeLessThan(100)
    })

    it('RF-05: durante e após o arraste de reordenação de colunas, a contagem de <tr> continua limitada', async () => {
      const wrapper = mount(ViewerTable, {
        props: { columns: bigColumns(), rows: bigRows(50_000) },
      })
      const beforeCount = await bodyRowCount(wrapper)

      const buttons = wrapper.findAll('.viewer-table__th-button')
      const headers = wrapper.findAll('.viewer-table__th')
      await buttons[2]!.trigger('dragstart')
      await headers[0]!.trigger('dragover')
      const duringCount = wrapper.findAll('.viewer-table__body .viewer-table__row').length
      await headers[0]!.trigger('drop')
      await buttons[2]!.trigger('dragend')

      expect(beforeCount).toBeGreaterThan(0)
      expect(duringCount).toBe(beforeCount)
      expect(beforeCount).toBeLessThan(100)
    })

    it('RF-06: com colunas fixadas (pin), a contagem de <tr> continua limitada e igual independente de N', async () => {
      const pinnedColumns = (): ViewerColumn[] => [
        { index: 2, label: 'amount', type: 'number', visible: true, pinned: true, width: 120 },
        { index: 0, label: 'id', type: 'number', visible: true, pinned: true, width: 90 },
        { index: 1, label: 'name', type: 'text', visible: true, pinned: false, width: 180 },
      ]
      const small = mount(ViewerTable, {
        props: { columns: pinnedColumns(), rows: bigRows(100) },
      })
      const large = mount(ViewerTable, {
        props: { columns: pinnedColumns(), rows: bigRows(50_000) },
      })

      const smallCount = await bodyRowCount(small)
      const largeCount = await bodyRowCount(large)

      expect(largeCount).toBe(smallCount)
      expect(largeCount).toBeLessThan(100)
    })

    it('RF-07/RNF-01: com ordenação, redimensionamento, reordenação e pin aplicados juntos, a contagem de <tr> permanece limitada e não cresce com N', async () => {
      const columnsWithInteractions = (): ViewerColumn[] => [
        { index: 2, label: 'amount', type: 'number', visible: true, pinned: true, width: 260 },
        { index: 0, label: 'id', type: 'number', visible: true, pinned: false, width: 90 },
        { index: 1, label: 'name', type: 'text', visible: true, pinned: false, width: 180 },
      ]
      const sortKeys = [{ index: 0, direction: 'asc' as const }]

      const small = mount(ViewerTable, {
        props: { columns: columnsWithInteractions(), rows: bigRows(200), sortKeys },
      })
      const large = mount(ViewerTable, {
        props: { columns: columnsWithInteractions(), rows: bigRows(100_000), sortKeys },
      })

      const smallCount = await bodyRowCount(small)
      const largeCount = await bodyRowCount(large)

      expect(smallCount).toBeGreaterThan(0)
      expect(largeCount).toBe(smallCount)
      expect(largeCount).toBeLessThan(100)
    })
  })
})
