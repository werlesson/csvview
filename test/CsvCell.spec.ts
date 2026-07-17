import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CsvCell from '~/components/CsvCell.vue'

describe('CsvCell', () => {
  it('renders the provided value', () => {
    const wrapper = mount(CsvCell, { props: { value: 'hello' } })
    expect(wrapper.text()).toBe('hello')
    expect(wrapper.classes()).not.toContain('csv-cell--empty')
  })

  it('renders a hachured placeholder with the "empty" label for empty values', () => {
    const wrapper = mount(CsvCell, { props: { value: null } })
    expect(wrapper.text()).toBe('empty')
    expect(wrapper.text()).not.toBe('—')
    expect(wrapper.classes()).toContain('csv-cell--empty')
    expect(wrapper.find('.csv-cell__empty-label').exists()).toBe(true)
  })

  it.each([null, undefined, ''])(
    'treats %j as empty and never renders just "—"',
    (value) => {
      const wrapper = mount(CsvCell, { props: { value } })
      expect(wrapper.text()).toBe('empty')
      expect(wrapper.classes()).toContain('csv-cell--empty')
    },
  )

  it('keeps csv-cell--numeric on an empty cell in a numeric column', () => {
    const wrapper = mount(CsvCell, { props: { value: null, numeric: true } })
    expect(wrapper.classes()).toContain('csv-cell--numeric')
    expect(wrapper.classes()).toContain('csv-cell--empty')
    expect(wrapper.text()).toBe('empty')
  })

  it('keeps csv-cell--selected on an empty cell in a selected column', () => {
    const wrapper = mount(CsvCell, { props: { value: null, selected: true } })
    expect(wrapper.classes()).toContain('csv-cell--selected')
    expect(wrapper.classes()).toContain('csv-cell--empty')
    expect(wrapper.text()).toBe('empty')
  })

  it('coerces numbers to text', () => {
    const wrapper = mount(CsvCell, { props: { value: 42 } })
    expect(wrapper.text()).toBe('42')
  })

  it('aligns numeric columns right in a monospace class', () => {
    const numeric = mount(CsvCell, { props: { value: '42', numeric: true } })
    expect(numeric.classes()).toContain('csv-cell--numeric')

    const text = mount(CsvCell, { props: { value: 'hello' } })
    expect(text.classes()).not.toContain('csv-cell--numeric')
  })

  describe('dupCount (RF-02)', () => {
    it('shows a "dup ×N" badge when dupCount is greater than 1', () => {
      const wrapper = mount(CsvCell, { props: { value: 'A', dupCount: 3 } })
      expect(wrapper.find('.csv-cell__dup-badge').exists()).toBe(true)
      expect(wrapper.find('.csv-cell__dup-badge').text()).toBe('dup ×3')
      expect(wrapper.text()).toContain('A')
    })

    it('does not show a badge when dupCount is absent or 1', () => {
      const withoutProp = mount(CsvCell, { props: { value: 'B' } })
      expect(withoutProp.find('.csv-cell__dup-badge').exists()).toBe(false)

      const withOne = mount(CsvCell, { props: { value: 'B', dupCount: 1 } })
      expect(withOne.find('.csv-cell__dup-badge').exists()).toBe(false)
    })
  })

  describe('negative (RF-04)', () => {
    it('applies the csv-cell--negative class when negative is true', () => {
      const wrapper = mount(CsvCell, {
        props: { value: '-320', numeric: true, negative: true },
      })
      expect(wrapper.classes()).toContain('csv-cell--negative')
    })

    it('does not apply csv-cell--negative when negative is absent', () => {
      const wrapper = mount(CsvCell, { props: { value: '149', numeric: true } })
      expect(wrapper.classes()).not.toContain('csv-cell--negative')
    })
  })

  describe('invalidDate (RF-05)', () => {
    it('applies a border class and prefixes the raw value with "⚠ "', () => {
      const wrapper = mount(CsvCell, {
        props: { value: '05/13/26', invalidDate: true },
      })
      expect(wrapper.classes()).toContain('csv-cell--invalid-date')
      expect(wrapper.text()).toBe('⚠ 05/13/26')
    })

    it('does not prefix or add the border class when invalidDate is absent', () => {
      const wrapper = mount(CsvCell, { props: { value: '2026-01-04' } })
      expect(wrapper.classes()).not.toContain('csv-cell--invalid-date')
      expect(wrapper.text()).toBe('2026-01-04')
    })
  })

  describe('composition with numeric/selected (RNF-01)', () => {
    it('keeps numeric and selected while also applying dupCount/negative/invalidDate', () => {
      const wrapper = mount(CsvCell, {
        props: {
          value: '-320',
          numeric: true,
          selected: true,
          dupCount: 2,
          negative: true,
        },
      })
      expect(wrapper.classes()).toContain('csv-cell--numeric')
      expect(wrapper.classes()).toContain('csv-cell--selected')
      expect(wrapper.classes()).toContain('csv-cell--negative')
      expect(wrapper.find('.csv-cell__dup-badge').text()).toBe('dup ×2')
    })
  })

  describe('modo de edição inline (cell-editing, T06)', () => {
    it('RF-01: clique numa célula editable emite "edit-start"', async () => {
      const wrapper = mount(CsvCell, { props: { value: 'ana', editable: true } })
      await wrapper.trigger('click')
      expect(wrapper.emitted('edit-start')).toEqual([[]])
    })

    it('RF-01: duplo-clique numa célula editable emite "edit-start"', async () => {
      const wrapper = mount(CsvCell, { props: { value: 'ana', editable: true } })
      await wrapper.trigger('dblclick')
      expect(wrapper.emitted('edit-start')).toEqual([[]])
    })

    it('RF-01: clique numa célula NÃO editable não emite "edit-start"', async () => {
      const wrapper = mount(CsvCell, { props: { value: 'ana' } })
      await wrapper.trigger('click')
      await wrapper.trigger('dblclick')
      expect(wrapper.emitted('edit-start')).toBeUndefined()
    })

    it('UI-01: em modo editing, o input recebe foco e vem pré-preenchido com o valor atual', async () => {
      const wrapper = mount(CsvCell, {
        props: { value: 'ana', editable: true, editing: true },
        attachTo: document.body,
      })
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      const input = wrapper.find('.csv-cell__input')
      expect(input.exists()).toBe(true)
      expect((input.element as HTMLInputElement).value).toBe('ana')
      expect(document.activeElement).toBe(input.element)
      wrapper.unmount()
    })

    it('UI-01: o campo de edição é visualmente distinto do modo de leitura', () => {
      const wrapper = mount(CsvCell, { props: { value: 'ana', editable: true, editing: true } })
      expect(wrapper.classes()).toContain('csv-cell--editing')
      expect(wrapper.find('.csv-cell__input').exists()).toBe(true)
    })

    it('RF-02: Enter confirma a edição, emitindo "edit-confirm" com o valor digitado', async () => {
      const wrapper = mount(CsvCell, { props: { value: 'ana', editable: true, editing: true } })
      const input = wrapper.find('.csv-cell__input')
      await input.setValue('ana maria')
      await input.trigger('keydown', { key: 'Enter' })

      expect(wrapper.emitted('edit-confirm')).toEqual([['ana maria']])
    })

    it('RF-02: Tab confirma a edição, emitindo "edit-confirm" com o valor digitado', async () => {
      const wrapper = mount(CsvCell, { props: { value: 'ana', editable: true, editing: true } })
      const input = wrapper.find('.csv-cell__input')
      await input.setValue('42')
      await input.trigger('keydown', { key: 'Tab' })

      expect(wrapper.emitted('edit-confirm')).toEqual([['42']])
    })

    it('RF-03: Esc emite "edit-cancel" sem emitir "edit-confirm" e restaura o valor original', async () => {
      const wrapper = mount(CsvCell, { props: { value: 'ana', editable: true, editing: true } })
      const input = wrapper.find('.csv-cell__input')
      await input.setValue('valor alterado')
      await input.trigger('keydown', { key: 'Escape' })

      expect(wrapper.emitted('edit-cancel')).toEqual([[]])
      expect(wrapper.emitted('edit-confirm')).toBeUndefined()
      expect((input.element as HTMLInputElement).value).toBe('ana')
    })

    describe('invalidEdit (UI-02)', () => {
      it('renderiza um indicador de erro não-cromático (ícone + texto) quando true', () => {
        const wrapper = mount(CsvCell, {
          props: { value: 'ana', editable: true, editing: true, invalidEdit: true },
        })
        const indicator = wrapper.find('.csv-cell__invalid-indicator')
        expect(indicator.exists()).toBe(true)
        expect(indicator.find('svg').exists()).toBe(true)
        expect(indicator.find('.csv-cell__invalid-text').text().length).toBeGreaterThan(0)
      })

      it('não renderiza o indicador quando invalidEdit é false/ausente', () => {
        const wrapper = mount(CsvCell, { props: { value: 'ana' } })
        expect(wrapper.find('.csv-cell__invalid-indicator').exists()).toBe(false)
      })
    })

    describe('dirty (UI-03)', () => {
      it('renderiza o indicador de alteração pendente restrito à célula quando true', () => {
        const wrapper = mount(CsvCell, { props: { value: 'ana', dirty: true } })
        expect(wrapper.find('.csv-cell__dirty-indicator').exists()).toBe(true)
      })

      it('não renderiza o indicador quando dirty é false/ausente (padrão)', () => {
        const wrapper = mount(CsvCell, { props: { value: 'ana' } })
        expect(wrapper.find('.csv-cell__dirty-indicator').exists()).toBe(false)
      })
    })
  })
})
