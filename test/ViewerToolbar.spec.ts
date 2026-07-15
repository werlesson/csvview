import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ViewerToolbar from '~/components/ViewerToolbar.vue'
import type { ViewerColumn } from '~/composables/useViewer'

function makeColumns(): ViewerColumn[] {
  return [
    { index: 0, label: 'id', type: 'number', visible: true, pinned: false, width: 180 },
    { index: 1, label: 'name', type: 'text', visible: true, pinned: false, width: 180 },
    { index: 2, label: 'amount', type: 'number', visible: false, pinned: false, width: 180 },
  ]
}

function mountToolbar(overrides: Record<string, unknown> = {}) {
  return mount(ViewerToolbar, {
    props: {
      rowCount: 1_204_882,
      columns: makeColumns(),
      search: '',
      ...overrides,
    },
  })
}

describe('ViewerToolbar', () => {
  // O nome do arquivo agora fica na barra de título (header do layout), fiel ao
  // design da Screen 2; a toolbar exibe apenas o contador de linhas.
  it('exibe o total de linhas formatado', () => {
    const text = mountToolbar().text()
    expect(text).toContain('1,204,882 linhas')
  })

  it('apresenta apenas os controles do MVP (busca e colunas)', () => {
    const wrapper = mountToolbar()
    expect(wrapper.find('input[type="search"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Colunas')
    // Controles de features adiadas ficam fora do escopo do MVP.
    expect(wrapper.text()).not.toContain('Filtros')
    expect(wrapper.text()).not.toContain('Exportar')
  })

  it('emite "update:search" ao digitar no campo de busca', async () => {
    const wrapper = mountToolbar()
    const input = wrapper.find('input[type="search"]')
    await input.setValue('ana')

    const emitted = wrapper.emitted('update:search')
    expect(emitted).toBeTruthy()
    expect(emitted!.at(-1)).toEqual(['ana'])
  })

  it('lista as colunas com o estado de visibilidade e emite "toggle-column"', async () => {
    const wrapper = mountToolbar()

    // Abre o seletor de colunas.
    await wrapper.find('.dropdown__trigger').trigger('click')

    const checkboxes = wrapper.findAll('.columns-menu__checkbox')
    expect(checkboxes).toHaveLength(3)
    // "amount" está oculta (visible: false) → checkbox desmarcado.
    expect((checkboxes[2]!.element as HTMLInputElement).checked).toBe(false)

    await checkboxes[1]!.trigger('change')
    const emitted = wrapper.emitted('toggle-column')
    expect(emitted).toBeTruthy()
    expect(emitted!.at(-1)).toEqual([1])
  })

  // UI-05: o controle de pin no menu "Colunas" emite toggle-pin com o índice
  // original da coluna — mesmo estado do botão de pin do cabeçalho da tabela.
  it('emite "toggle-pin" ao acionar o controle de pin de um item do menu "Colunas"', async () => {
    const wrapper = mountToolbar()

    await wrapper.find('.dropdown__trigger').trigger('click')

    const pinButtons = wrapper.findAll('.columns-menu__pin')
    expect(pinButtons).toHaveLength(3)

    await pinButtons[0]!.trigger('click')

    expect(wrapper.emitted('toggle-pin')).toEqual([[0]])
  })

  // UI-05: o item de uma coluna fixada é visualmente distinguível, reusando a
  // variação `pinned` de ColumnChip.
  it('reflete a coluna fixada com a variação "pinned" de ColumnChip no menu "Colunas"', async () => {
    const columns = makeColumns()
    columns[0]!.pinned = true
    const wrapper = mountToolbar({ columns })

    await wrapper.find('.dropdown__trigger').trigger('click')

    const items = wrapper.findAll('.columns-menu__item')
    expect(items[0]!.classes()).toContain('columns-menu__item--pinned')
    expect(items[1]!.classes()).not.toContain('columns-menu__item--pinned')

    expect(items[0]!.find('.chip--pinned').exists()).toBe(true)
    expect(items[1]!.find('.chip--pinned').exists()).toBe(false)
  })
})
