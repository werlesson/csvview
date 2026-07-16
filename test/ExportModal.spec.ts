import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ExportModal from '~/components/ExportModal.vue'
import type { ViewerColumn } from '~/composables/useViewer'

function makeColumns(): ViewerColumn[] {
  return [
    { index: 0, label: 'id', type: 'number', visible: true, pinned: false, width: 180 },
    { index: 1, label: 'name', type: 'text', visible: true, pinned: false, width: 180 },
  ]
}

function makeRows(): string[][] {
  return [
    ['1', 'Ana'],
    ['2', 'Bruno'],
  ]
}

function mountModal(overrides: Record<string, unknown> = {}) {
  return mount(ExportModal, {
    props: {
      open: true,
      filteredRows: makeRows(),
      allRows: makeRows(),
      displayColumns: makeColumns(),
      fileName: 'transactions.csv',
      ...overrides,
    },
  })
}

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:mock-url')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ExportModal', () => {
  it('não renderiza o modal quando `open` é falso', () => {
    const wrapper = mountModal({ open: false })
    expect(wrapper.find('.export-overlay').exists()).toBe(false)
  })

  describe('UI-01 — fiel à Screen 4', () => {
    it('renderiza título, subtítulo, 5 abas, 2 rádios com contagem, 2 toggles e o rodapé', () => {
      const wrapper = mountModal()

      expect(wrapper.get('.export-overlay__title').text()).toBe('Exportar dados')
      expect(wrapper.get('.export-overlay__subtitle').text()).toBe('Escolha o formato e o escopo.')

      const tabs = wrapper.findAll('.export-format-tab')
      expect(tabs.map((tab) => tab.text())).toEqual(['CSV', 'JSON', 'XLSX', 'MD', 'SQL'])

      expect(wrapper.findAll('.export-scope-option')).toHaveLength(2)
      expect(wrapper.text()).toContain('Linhas filtradas (2)')
      expect(wrapper.text()).toContain('Todas as linhas (2)')

      expect(wrapper.findAll('.export-option-toggle')).toHaveLength(2)
      expect(wrapper.get('.export-overlay__cancel').text()).toBe('Cancelar')
      expect(wrapper.find('.export-overlay__download').exists()).toBe(true)
    })
  })

  describe('RF-02 a RF-06 / UI-03 — troca de aba atualiza toggles e rótulo do botão', () => {
    it('CSV: ambos os toggles habilitados', () => {
      const wrapper = mountModal()
      const [headerToggle, quoteToggle] = wrapper.findAll('.export-option-toggle input[type="checkbox"]')

      expect((headerToggle!.element as HTMLInputElement).disabled).toBe(false)
      expect((quoteToggle!.element as HTMLInputElement).disabled).toBe(false)
    })

    it('trocar para JSON desabilita ambos os toggles e atualiza o rótulo de "Baixar"', async () => {
      const wrapper = mountModal()

      await wrapper.findAll('.export-format-tab')[1]!.trigger('click')

      const [headerToggle, quoteToggle] = wrapper.findAll('.export-option-toggle input[type="checkbox"]')
      expect((headerToggle!.element as HTMLInputElement).disabled).toBe(true)
      expect((quoteToggle!.element as HTMLInputElement).disabled).toBe(true)
      expect(wrapper.get('.export-overlay__download').text()).toBe('Baixar JSON')
    })

    it('trocar para SQL mantém "Incluir cabeçalho" habilitado e "Aspas em todos os campos" desabilitado', async () => {
      const wrapper = mountModal()
      await wrapper.findAll('.export-format-tab')[4]!.trigger('click') // SQL

      const [headerToggle, quoteToggle] = wrapper.findAll('.export-option-toggle input[type="checkbox"]')
      expect((headerToggle!.element as HTMLInputElement).disabled).toBe(false)
      expect((quoteToggle!.element as HTMLInputElement).disabled).toBe(true)
      expect(wrapper.get('.export-overlay__download').text()).toBe('Baixar SQL')
    })
  })

  describe('RF-16 — os 4 caminhos de dismiss não baixam nada e não persistem a seleção', () => {
    it('"Cancelar" não chama download() e emite close', async () => {
      const wrapper = mountModal()
      await wrapper.findAll('.export-format-tab')[4]!.trigger('click') // SQL

      await wrapper.get('.export-overlay__cancel').trigger('click')

      expect(URL.createObjectURL).not.toHaveBeenCalled()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('"X" não chama download() e emite close', async () => {
      const wrapper = mountModal()
      await wrapper.get('.export-overlay__close').trigger('click')

      expect(URL.createObjectURL).not.toHaveBeenCalled()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('clique no backdrop não chama download() e emite close', async () => {
      const wrapper = mountModal()
      await wrapper.get('.export-overlay').trigger('click')

      expect(URL.createObjectURL).not.toHaveBeenCalled()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('Escape não chama download() e emite close', async () => {
      const wrapper = mountModal()
      await wrapper.get('.export-overlay__panel').trigger('keydown.esc')

      expect(URL.createObjectURL).not.toHaveBeenCalled()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('reabrir o modal após um dismiss sem baixar mostra o estado padrão, não a seleção anterior', async () => {
      const wrapper = mountModal()
      await wrapper.findAll('.export-format-tab')[4]!.trigger('click') // SQL
      await wrapper.get('.export-overlay__cancel').trigger('click')

      await wrapper.setProps({ open: false })
      await wrapper.setProps({ open: true })

      expect(wrapper.get('.export-overlay__download').text()).toBe('Baixar CSV')
    })
  })

  describe('RF-15 — "Baixar" chama a lógica de download exatamente uma vez', () => {
    it('clicar em "Baixar" cria um único Blob/download e emite close', async () => {
      const wrapper = mountModal()

      await wrapper.get('.export-overlay__download').trigger('click')
      await vi.waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1))

      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1)
      expect(wrapper.emitted('close')).toHaveLength(1)
    })
  })
})
