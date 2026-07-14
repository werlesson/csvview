import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Dropzone from '~/components/Dropzone.vue'

describe('Dropzone', () => {
  it('renderiza o estado idle com título, botão e formatos', () => {
    const wrapper = mount(Dropzone)

    expect(wrapper.text()).toContain('Arraste um arquivo CSV aqui')
    expect(wrapper.text()).toContain('Escolher arquivo')
    expect(wrapper.text()).toContain('.csv · .tsv · .txt')
    expect(wrapper.attributes('data-drag-over')).toBe('false')
    expect(wrapper.classes()).not.toContain('dropzone--drag-over')
  })

  it('o input de arquivo aceita .csv, .tsv e .txt', () => {
    const wrapper = mount(Dropzone)
    const input = wrapper.find('input[type="file"]')
    expect(input.attributes('accept')).toBe('.csv,.tsv,.txt')
  })

  it('entra e sai do estado visual de drag-over', async () => {
    const wrapper = mount(Dropzone)

    await wrapper.trigger('dragover')
    expect(wrapper.attributes('data-drag-over')).toBe('true')
    expect(wrapper.classes()).toContain('dropzone--drag-over')

    await wrapper.trigger('dragleave')
    expect(wrapper.attributes('data-drag-over')).toBe('false')
    expect(wrapper.classes()).not.toContain('dropzone--drag-over')
  })

  it('emite "select" com o arquivo solto e sai do drag-over', async () => {
    const wrapper = mount(Dropzone)
    const file = new File(['id,name\n1,Ana'], 'people.csv', {
      type: 'text/csv',
    })

    await wrapper.trigger('dragover')
    await wrapper.trigger('drop', {
      dataTransfer: { files: [file] },
    })

    const emitted = wrapper.emitted('select')
    expect(emitted).toHaveLength(1)
    expect((emitted![0]![0] as File).name).toBe('people.csv')
    expect(wrapper.attributes('data-drag-over')).toBe('false')
  })

  it('emite "select" ao escolher um arquivo pelo input', async () => {
    const wrapper = mount(Dropzone)
    const input = wrapper.find('input[type="file"]')
    const file = new File(['a,b\n1,2'], 'data.tsv', { type: 'text/tab-separated-values' })

    Object.defineProperty(input.element, 'files', {
      value: [file],
      configurable: true,
    })
    await input.trigger('change')

    const emitted = wrapper.emitted('select')
    expect(emitted).toHaveLength(1)
    expect((emitted![0]![0] as File).name).toBe('data.tsv')
  })

  it('não emite quando o drop não traz arquivos', async () => {
    const wrapper = mount(Dropzone)

    await wrapper.trigger('drop', { dataTransfer: { files: [] } })

    expect(wrapper.emitted('select')).toBeUndefined()
  })
})
