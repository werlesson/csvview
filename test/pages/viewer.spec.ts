import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, Suspense } from 'vue'
import ViewerPage from '~/pages/viewer.vue'
import { useCurrentDataset, type Dataset } from '~/composables/useCurrentDataset'

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

/** Abre o editor "Adicionar filtro" e submete coluna/operador/valor. */
async function addFilterViaUi(
  wrapper: Awaited<ReturnType<typeof mountViewer>>,
  column: string,
  operator: string,
  value: string,
): Promise<void> {
  await wrapper.get('.filter-panel__add .dropdown__trigger').trigger('click')

  const selects = wrapper.findAll('.filter-panel__editor select')
  await selects[0]!.setValue(column)
  await selects[1]!.setValue(operator)

  const valueInput = wrapper.find('.filter-panel__input')
  if (valueInput.exists()) await valueInput.setValue(value)

  await wrapper.get('.filter-panel__submit').trigger('click')
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

  it('abre o painel de filtros ao acionar "Filtros" na toolbar e adiciona um filtro reduzindo as linhas em tempo real (RF-05, UI-01, UI-02)', async () => {
    const wrapper = await mountViewer()

    expect(wrapper.find('.filter-panel').exists()).toBe(false)

    await wrapper.get('.toolbar__filters').trigger('click')
    expect(wrapper.find('.filter-panel').exists()).toBe(true)

    expect(wrapper.findAll('.viewer-table__row').length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('4 linhas')

    await addFilterViaUi(wrapper, '1', 'igual', 'failed')

    // Contador (visibleRowCount) reflete a nova contagem em tempo real.
    expect(wrapper.text()).toContain('2 linhas')
    // Badge de contagem de filtros ativos na toolbar.
    expect(wrapper.get('.toolbar__filters-badge').text()).toBe('1')
    // Chip do filtro ativo aparece no painel.
    expect(wrapper.get('.filter-panel__chip-label').text()).toContain('status')
  })

  it('combinação sem resultado renderiza "Nenhuma linha encontrada" com ação de limpar filtros, que restaura as linhas (RF-06, UI-03)', async () => {
    const wrapper = await mountViewer()

    await wrapper.get('.toolbar__filters').trigger('click')
    await addFilterViaUi(wrapper, '1', 'igual', 'inexistente')

    expect(wrapper.text()).toContain('Nenhuma linha encontrada')
    expect(wrapper.text()).toContain('0 linhas')

    const clearButton = wrapper.get('.viewer-table__empty-clear')
    await clearButton.trigger('click')

    expect(wrapper.find('.viewer-table__empty').exists()).toBe(false)
    expect(wrapper.text()).toContain('4 linhas')
    expect(wrapper.find('.filter-panel__chip-item').exists()).toBe(false)
    expect(wrapper.find('.toolbar__filters-badge').exists()).toBe(false)
  })

  it('"Limpar" no painel de filtros remove todos os chips e restaura as linhas (RF-03)', async () => {
    const wrapper = await mountViewer()

    await wrapper.get('.toolbar__filters').trigger('click')
    await addFilterViaUi(wrapper, '1', 'igual', 'failed')
    expect(wrapper.text()).toContain('2 linhas')

    await wrapper.get('.filter-panel__clear').trigger('click')

    expect(wrapper.text()).toContain('4 linhas')
    expect(wrapper.find('.filter-panel__chip-item').exists()).toBe(false)
    expect(wrapper.find('.toolbar__filters-badge').exists()).toBe(false)
  })

  it('não acessa IndexedDB nem localStorage ao adicionar/limpar filtros (RF-07)', async () => {
    const wrapper = await mountViewer()

    const openSpy = vi.spyOn(indexedDB, 'open')
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem')
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    await wrapper.get('.toolbar__filters').trigger('click')
    await addFilterViaUi(wrapper, '1', 'igual', 'failed')
    await wrapper.get('.filter-panel__clear').trigger('click')

    expect(openSpy).not.toHaveBeenCalled()
    expect(getItemSpy).not.toHaveBeenCalled()
    expect(setItemSpy).not.toHaveBeenCalled()
  })
})
