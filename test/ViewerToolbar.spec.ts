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

  it('apresenta os controles de busca, filtros, colunas e exportar', () => {
    const wrapper = mountToolbar()
    expect(wrapper.find('input[type="search"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Filtros')
    expect(wrapper.text()).toContain('Colunas')
    expect(wrapper.text()).toContain('Exportar')
  })

  // UI-04: o controle "Exportar" fica em toolbar__meta, entre os controles
  // existentes e o contador de linhas.
  it('renderiza o botão "Exportar" entre os controles existentes e o contador de linhas', () => {
    const wrapper = mountToolbar()
    const meta = wrapper.find('.toolbar__meta')
    expect(meta.find('.toolbar__export').exists()).toBe(true)

    const children = meta.element.children
    const exportIndex = [...children].findIndex((el) => el.classList.contains('toolbar__export'))
    const countIndex = [...children].findIndex((el) => el.classList.contains('toolbar__count'))
    expect(exportIndex).toBeGreaterThanOrEqual(0)
    expect(countIndex).toBeGreaterThan(exportIndex)
  })

  it('emite "open-export" exatamente uma vez ao clicar em "Exportar", sem alterar outro estado', async () => {
    const wrapper = mountToolbar()
    await wrapper.find('.toolbar__export').trigger('click')

    expect(wrapper.emitted('open-export')).toEqual([[]])
    expect(wrapper.emitted('toggle-filters')).toBeUndefined()
    expect(wrapper.emitted('update:search')).toBeUndefined()
    expect(wrapper.emitted('toggle-column')).toBeUndefined()
  })

  // UI-02: badge de contagem no controle "Filtros".
  it('renderiza o badge "2" no controle Filtros quando activeFilterCount=2', () => {
    const wrapper = mountToolbar({ activeFilterCount: 2 })
    const filtersButton = wrapper.find('.toolbar__filters')
    expect(filtersButton.text()).toContain('2')
    expect(filtersButton.find('.toolbar__filters-badge').exists()).toBe(true)
  })

  it('não renderiza contagem no controle Filtros quando activeFilterCount=0', () => {
    const wrapper = mountToolbar({ activeFilterCount: 0 })
    const filtersButton = wrapper.find('.toolbar__filters')
    expect(filtersButton.find('.toolbar__filters-badge').exists()).toBe(false)
  })

  it('emite "toggle-filters" ao clicar no controle Filtros', async () => {
    const wrapper = mountToolbar()
    await wrapper.find('.toolbar__filters').trigger('click')

    expect(wrapper.emitted('toggle-filters')).toEqual([[]])
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

  // Busca do menu "Colunas": filtra a lista pelo rótulo, sem afetar a busca
  // principal da tabela (`search`/`update:search`).
  it('filtra as colunas do menu "Colunas" pelo termo digitado na busca do menu', async () => {
    const wrapper = mountToolbar()

    await wrapper.find('.dropdown__trigger').trigger('click')

    const menuSearch = wrapper.find('.columns-menu__search input')
    await menuSearch.setValue('amo')

    const items = wrapper.findAll('.columns-menu__item')
    expect(items).toHaveLength(1)
    expect(wrapper.find('.columns-menu__chip').text()).toContain('amount')
    expect(wrapper.emitted('update:search')).toBeUndefined()
  })

  it('exibe "Nenhuma coluna encontrada" quando a busca do menu não casa com nada', async () => {
    const wrapper = mountToolbar()

    await wrapper.find('.dropdown__trigger').trigger('click')
    await wrapper.find('.columns-menu__search input').setValue('zzz')

    expect(wrapper.find('.columns-menu__empty').exists()).toBe(true)
    expect(wrapper.findAll('.columns-menu__item')).toHaveLength(0)
  })

  it('limpa a busca do menu "Colunas" ao fechar e reabrir o menu', async () => {
    const wrapper = mountToolbar()

    await wrapper.find('.dropdown__trigger').trigger('click')
    await wrapper.find('.columns-menu__search input').setValue('id')
    expect(wrapper.findAll('.columns-menu__item')).toHaveLength(1)

    // Fecha e reabre o menu.
    await wrapper.find('.dropdown__trigger').trigger('click')
    await wrapper.find('.dropdown__trigger').trigger('click')

    expect((wrapper.find('.columns-menu__search input').element as HTMLInputElement).value).toBe('')
    expect(wrapper.findAll('.columns-menu__item')).toHaveLength(3)
  })

  describe('undo/redo e salvar/sobrescrever (cell-editing, T08)', () => {
    it('RF-09: "Desfazer" e "Refazer" ficam desabilitados quando canUndo/canRedo são false', () => {
      const wrapper = mountToolbar({ canUndo: false, canRedo: false })
      const undoBtn = wrapper.find('.toolbar__history-btn[aria-label="Desfazer"]')
      const redoBtn = wrapper.find('.toolbar__history-btn[aria-label="Refazer"]')

      expect((undoBtn.element as HTMLButtonElement).disabled).toBe(true)
      expect((redoBtn.element as HTMLButtonElement).disabled).toBe(true)
    })

    it('RF-06/RF-09: "Desfazer" habilitado emite "undo" ao clicar', async () => {
      const wrapper = mountToolbar({ canUndo: true })
      const undoBtn = wrapper.find('.toolbar__history-btn[aria-label="Desfazer"]')

      expect((undoBtn.element as HTMLButtonElement).disabled).toBe(false)
      await undoBtn.trigger('click')
      expect(wrapper.emitted('undo')).toEqual([[]])
    })

    it('RF-07/RF-09: "Refazer" habilitado emite "redo" ao clicar', async () => {
      const wrapper = mountToolbar({ canRedo: true })
      const redoBtn = wrapper.find('.toolbar__history-btn[aria-label="Refazer"]')

      expect((redoBtn.element as HTMLButtonElement).disabled).toBe(false)
      await redoBtn.trigger('click')
      expect(wrapper.emitted('redo')).toEqual([[]])
    })

    it('"Desfazer" desabilitado não emite "undo" ao clicar', async () => {
      const wrapper = mountToolbar({ canUndo: false })
      await wrapper.find('.toolbar__history-btn[aria-label="Desfazer"]').trigger('click')
      expect(wrapper.emitted('undo')).toBeUndefined()
    })

    it('"Refazer" desabilitado não emite "redo" ao clicar', async () => {
      const wrapper = mountToolbar({ canRedo: false })
      await wrapper.find('.toolbar__history-btn[aria-label="Refazer"]').trigger('click')
      expect(wrapper.emitted('redo')).toBeUndefined()
    })

    it('RF-11: "Salvar nova versão" emite "save-new-version" ao clicar', async () => {
      const wrapper = mountToolbar()
      await wrapper.find('.toolbar__save-version').trigger('click')
      expect(wrapper.emitted('save-new-version')).toEqual([[]])
      expect(wrapper.emitted('overwrite-original')).toBeUndefined()
    })

    it('RF-15: "Sobrescrever original" emite "overwrite-original" ao clicar', async () => {
      const wrapper = mountToolbar()
      await wrapper.find('.toolbar__overwrite').trigger('click')
      expect(wrapper.emitted('overwrite-original')).toEqual([[]])
      expect(wrapper.emitted('save-new-version')).toBeUndefined()
    })

    it('CT-04: "Salvar nova versão" e "Sobrescrever original" são visualmente distintos entre si', () => {
      const wrapper = mountToolbar()
      const saveBtn = wrapper.find('.toolbar__save-version')
      const overwriteBtn = wrapper.find('.toolbar__overwrite')

      expect(saveBtn.exists()).toBe(true)
      expect(overwriteBtn.exists()).toBe(true)
      expect(saveBtn.classes()).not.toEqual(overwriteBtn.classes())
    })

    it('RNF-02: exibe a mensagem de erro quando saveError está preenchido', () => {
      const wrapper = mountToolbar({ saveError: 'Não foi possível salvar a nova versão.' })
      expect(wrapper.find('.toolbar__save-error').exists()).toBe(true)
      expect(wrapper.text()).toContain('Não foi possível salvar a nova versão.')
    })

    it('não exibe mensagem de erro quando saveError é null/ausente, sem bloquear os demais controles', () => {
      const wrapper = mountToolbar()
      expect(wrapper.find('.toolbar__save-error').exists()).toBe(false)
      expect((wrapper.find('.toolbar__export').element as HTMLButtonElement).disabled).toBe(false)
    })
  })
})
