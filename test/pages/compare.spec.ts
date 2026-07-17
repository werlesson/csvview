import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick, Suspense } from 'vue'
import ComparePage from '~/pages/compare.vue'
import { useCurrentDataset, type Dataset } from '~/composables/useCurrentDataset'
import { useComparisonDatasets } from '~/composables/useComparisonDatasets'
import { useOpenFile } from '~/composables/useOpenFile'
import { useFilesStore } from '~/composables/useFilesStore'
import { deleteDatabase } from '~/composables/useDatabase'

/** Dataset A de exemplo: id (number), name (text), amount (number) — 2 linhas mudam, 2 não. */
function makeDatasetA(): Dataset {
  return {
    header: ['id', 'name', 'amount'],
    rows: [
      ['1', 'Ana', '100'],
      ['2', 'Bruno', '250'],
      ['3', 'Carla', '10'],
    ],
  }
}

/** Conteúdo do arquivo B: mesmo cabeçalho — linha 1 igual, linha 2 muda `amount`, linha 3 removida, +1 nova. */
const CONTENT_B = 'id,name,amount\n1,Ana,100\n2,Bruno,999\n4,Duda,50'

async function mountCompare() {
  const wrapper = mount(
    {
      render: () => h(Suspense, null, { default: () => h(ComparePage) }),
    },
    { attachTo: document.body },
  )
  await flushPromises()
  return wrapper
}

describe('compare.vue — página de comparação (file-comparison, T06)', () => {
  beforeEach(async () => {
    await deleteDatabase()
    useCurrentDataset().clearDataset()
    useComparisonDatasets().clearComparison()
    // happy-dom mede offsetHeight 0 no scroller do CompareTable — sem o stub,
    // o virtualizador não renderiza nenhuma linha do corpo (mesma limitação
    // documentada na memória do projeto: viewertable-virtualizer-no-body-rows-jsdom).
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400)
  })

  afterEach(async () => {
    useCurrentDataset().clearDataset()
    useComparisonDatasets().clearComparison()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    await deleteDatabase()
  })

  it('acesso direto sem dataset A carregado redireciona a "/"', async () => {
    const navigateToSpy = vi
      .spyOn(globalThis as unknown as { navigateTo: (path: string) => void }, 'navigateTo')
      .mockImplementation(() => {})

    await mountCompare()

    expect(navigateToSpy).toHaveBeenCalledWith('/')
  })

  it('com dataset A carregado e sem B, exibe o CompareFileSelector aberto', async () => {
    useCurrentDataset().setDataset(makeDatasetA(), {
      name: 'transactions_v1.csv',
      delimiter: 'comma',
      sizeBytes: 128,
      rowCount: 3,
      columnCount: 3,
    })

    const wrapper = await mountCompare()

    expect(wrapper.find('.compare-selector-overlay').exists()).toBe(true)
    expect(wrapper.get('.compare-selector-overlay__title').text()).toBe('Comparar arquivos')
    expect(wrapper.find('.compare-table').exists()).toBe(false)
  })

  it('após selecionar o arquivo B (upload), exibe CompareSummary + CompareTable e fecha o seletor', async () => {
    useCurrentDataset().setDataset(makeDatasetA(), {
      name: 'transactions_v1.csv',
      delimiter: 'comma',
      sizeBytes: 128,
      rowCount: 3,
      columnCount: 3,
    })

    const wrapper = await mountCompare()

    const file = new File([CONTENT_B], 'transactions_v2.csv', { type: 'text/csv' })
    const dropzone = wrapper.get('.compare-selector-overlay input[type="file"]')
    Object.defineProperty(dropzone.element, 'files', { value: [file] })
    await dropzone.trigger('change')
    await flushPromises()
    await nextTick()

    expect(wrapper.find('.compare-selector-overlay').exists()).toBe(false)
    expect(wrapper.find('.compare-summary').exists()).toBe(true)
    expect(wrapper.find('.compare-table').exists()).toBe(true)

    // Sem coluna-chave escolhida, o pareamento cai para posição (RF-05): linha 0
    // igual (unchanged), linha 1 muda `amount` (changed), linha 2 diverge entre
    // A ("3,Carla,10") e B ("4,Duda,50") em todas as colunas comuns (changed).
    expect(wrapper.text()).toContain('adicionadas')
    expect(wrapper.text()).toContain('removidas')
    expect(wrapper.text()).toContain('alteradas')
  })

  it('toggle "Somente diferenças" remove os registros "unchanged" da tabela; desativar restaura todos', async () => {
    useCurrentDataset().setDataset(makeDatasetA(), {
      name: 'transactions_v1.csv',
      delimiter: 'comma',
      sizeBytes: 128,
      rowCount: 3,
      columnCount: 3,
    })

    const wrapper = await mountCompare()

    const file = new File([CONTENT_B], 'transactions_v2.csv', { type: 'text/csv' })
    const dropzone = wrapper.get('.compare-selector-overlay input[type="file"]')
    Object.defineProperty(dropzone.element, 'files', { value: [file] })
    await dropzone.trigger('change')
    await flushPromises()
    await nextTick()

    // Usa a coluna-chave "id" para um pareamento estável e previsível.
    await wrapper.get('.compare__key-select select').setValue('id')
    await nextTick()

    // Total de registros pareados por chave "id": 1(unchanged) + 1(changed) + 1(removed,id=3) + 1(added,id=4) = 4.
    const allRows = wrapper.findAll('.compare-table__body .compare-table__row')
    expect(allRows.length).toBeGreaterThan(0)
    const totalRows = allRows.length

    const toggle = wrapper.get('.compare__toggle input[type="checkbox"]')
    await toggle.setValue(true)
    await nextTick()

    const filteredRows = wrapper.findAll('.compare-table__body .compare-table__row')
    expect(filteredRows.length).toBeLessThan(totalRows)
    expect(wrapper.text()).not.toContain('Sem alteração')

    await toggle.setValue(false)
    await nextTick()

    const restoredRows = wrapper.findAll('.compare-table__body .compare-table__row')
    expect(restoredRows.length).toBe(totalRows)
  })

  // T08 — cenário cross-cutting: usa a página real com useOpenFile/
  // useCurrentDataset/useFilesStore reais (sem mocks), fechando o laço aberto
  // pela troca de A em `useComparisonDatasets.spec.ts`.
  it('T08: trocar A por um terceiro arquivo real enquanto na tela de comparação reabre o CompareFileSelector (reset de B)', async () => {
    useCurrentDataset().setDataset(makeDatasetA(), {
      name: 'transactions_v1.csv',
      delimiter: 'comma',
      sizeBytes: 128,
      rowCount: 3,
      columnCount: 3,
    })

    const wrapper = await mountCompare()

    const file = new File([CONTENT_B], 'transactions_v2.csv', { type: 'text/csv' })
    const dropzone = wrapper.get('.compare-selector-overlay input[type="file"]')
    Object.defineProperty(dropzone.element, 'files', { value: [file] })
    await dropzone.trigger('change')
    await flushPromises()
    await nextTick()

    expect(wrapper.find('.compare-selector-overlay').exists()).toBe(false)
    expect(wrapper.find('.compare-table').exists()).toBe(true)

    const filesBefore = await useFilesStore().listFiles()
    expect(filesBefore).toHaveLength(0)

    // Fluxo real (não mockado) de abrir um terceiro arquivo como novo A —
    // mesmo useOpenFile/useCsvParser/useFilesStore da tela de Upload.
    const { openFile } = useOpenFile()
    const thirdFile = new File(['id,name,amount\n9,Nova,1'], 'transactions_v3.csv')
    expect(await openFile(thirdFile)).toBe(true)
    await nextTick()

    expect(wrapper.find('.compare-selector-overlay').exists()).toBe(true)
    expect(wrapper.find('.compare-table').exists()).toBe(false)

    // Persistência do terceiro arquivo (A novo) não é afetada pela comparação
    // descartada — dataset B nunca foi salvo em `files` (RF-01/CT-01).
    const filesAfter = await useFilesStore().listFiles()
    expect(filesAfter).toHaveLength(1)
    expect(filesAfter[0]?.name).toBe('transactions_v3.csv')
  })
})
