import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CompareFileSelector from '~/components/CompareFileSelector.vue'
import Dropzone from '~/components/Dropzone.vue'
import type { FileRecord } from '~/composables/useDatabase'

function makeRecord(overrides: Partial<FileRecord> = {}): FileRecord {
  const now = Date.now()
  return {
    id: 1,
    name: 'people.csv',
    delimiter: 'comma',
    size_bytes: 1024,
    row_count: 100,
    column_count: 3,
    content: 'id,name\n1,Ana',
    created_at: now,
    last_opened_at: now,
    ...overrides,
  }
}

function mountSelector(overrides: Record<string, unknown> = {}) {
  return mount(CompareFileSelector, {
    props: {
      open: true,
      recents: [],
      isOpening: false,
      error: null,
      ...overrides,
    },
  })
}

describe('CompareFileSelector', () => {
  it('não renderiza o modal quando `open` é falso', () => {
    const wrapper = mountSelector({ open: false })
    expect(wrapper.find('.compare-selector-overlay').exists()).toBe(false)
  })

  it('título "Comparar arquivos" (UI-01)', () => {
    const wrapper = mountSelector()
    expect(wrapper.get('.compare-selector-overlay__title').text()).toBe('Comparar arquivos')
  })

  describe('UI-01 — emissão de select/open-recent/close', () => {
    it('emite `select` quando o Dropzone interno emite select', async () => {
      const wrapper = mountSelector()
      const file = new File(['id,name\n1,Ana'], 'b.csv', { type: 'text/csv' })

      const dropzone = wrapper.findComponent(Dropzone)
      dropzone.vm.$emit('select', file)
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('select')
      expect(emitted).toHaveLength(1)
      expect(emitted![0]![0]).toBe(file)
    })

    it('emite `open-recent` quando um item de RecentFiles emite `open`', async () => {
      const wrapper = mountSelector({ recents: [makeRecord({ id: 42 })] })

      await wrapper.find('.recent__open').trigger('click')

      const emitted = wrapper.emitted('open-recent')
      expect(emitted).toHaveLength(1)
      expect(emitted![0]![0]).toBe(42)
    })

    it('emite `close` ao clicar no backdrop', async () => {
      const wrapper = mountSelector()
      await wrapper.find('.compare-selector-overlay').trigger('click')
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('emite `close` ao pressionar Escape', async () => {
      const wrapper = mountSelector()
      await wrapper.find('.compare-selector-overlay__panel').trigger('keydown.esc')
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('emite `close` ao clicar no "X"', async () => {
      const wrapper = mountSelector()
      await wrapper.find('.compare-selector-overlay__close').trigger('click')
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('não emite `close` ao clicar dentro do painel (fora do "X")', async () => {
      const wrapper = mountSelector()
      await wrapper.find('.compare-selector-overlay__panel').trigger('click')
      expect(wrapper.emitted('close')).toBeUndefined()
    })
  })

  describe('error/isOpening', () => {
    it('exibe `error` quando presente', () => {
      const wrapper = mountSelector({ error: 'Arquivo excede o limite permitido.' })
      expect(wrapper.get('.compare-selector-overlay__error').text()).toBe(
        'Arquivo excede o limite permitido.',
      )
    })

    it('não exibe erro quando `error` é null', () => {
      const wrapper = mountSelector({ error: null })
      expect(wrapper.find('.compare-selector-overlay__error').exists()).toBe(false)
    })

    it('desabilita o Dropzone durante `isOpening`', () => {
      const wrapper = mountSelector({ isOpening: true })
      const dropzone = wrapper.findComponent(Dropzone)
      expect(dropzone.props('disabled')).toBe(true)
    })

    it('mantém o Dropzone habilitado quando não está abrindo', () => {
      const wrapper = mountSelector({ isOpening: false })
      const dropzone = wrapper.findComponent(Dropzone)
      expect(dropzone.props('disabled')).toBe(false)
    })
  })
})
