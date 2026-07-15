import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ViewerToolbar from '~/components/ViewerToolbar.vue'
import type { ViewerColumn } from '~/composables/useViewer'

function makeColumns(): ViewerColumn[] {
  return [
    { index: 0, label: 'id', type: 'number', visible: true },
    { index: 1, label: 'name', type: 'text', visible: true },
    { index: 2, label: 'amount', type: 'number', visible: false },
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
})
