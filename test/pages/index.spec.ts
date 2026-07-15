import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import IndexPage from '~/pages/index.vue'

vi.mock('~/composables/useOpenFile', () => ({
  useOpenFile: () => ({
    openFile: vi.fn(),
    reopenRecent: vi.fn(),
    error: ref(null),
    isOpening: ref(false),
  }),
}))

const listFiles = vi.fn().mockResolvedValue([])
const deleteFile = vi.fn().mockResolvedValue(undefined)

vi.mock('~/composables/useFilesStore', () => ({
  useFilesStore: () => ({ listFiles, deleteFile }),
}))

describe('index.vue (landing)', () => {
  it('exibe o novo título e subtítulo do hero (RF-01, RF-02)', () => {
    const wrapper = mount(IndexPage)

    expect(wrapper.get('.upload__title').text()).toBe(
      'O explorador de CSV para quem vive nos dados',
    )
    expect(wrapper.get('.upload__subtitle').text()).toBe(
      'Abra, filtre e analise arquivos CSV enormes direto no navegador — sem instalar nada e sem enviar seus dados para nenhum servidor.',
    )

    expect(wrapper.text()).not.toContain('Solte um CSV e comece a explorar.')
    expect(wrapper.text()).not.toContain(
      'Arraste um arquivo ou abra uma sessão recente. Tudo é processado',
    )
  })

  it('exclui um recente ao confirmar e recarrega a lista', async () => {
    listFiles.mockResolvedValueOnce([
      {
        id: 7,
        name: 'dados.csv',
        delimiter: 'comma',
        size_bytes: 10,
        row_count: 1,
        column_count: 1,
        content: '',
        created_at: Date.now(),
        last_opened_at: Date.now(),
      },
    ])

    const wrapper = mount(IndexPage)
    await flushPromises()
    const callsBeforeDelete = listFiles.mock.calls.length

    const deleteButton = wrapper.get('.recent__delete')
    await deleteButton.trigger('click')
    expect(deleteFile).not.toHaveBeenCalled()

    listFiles.mockResolvedValueOnce([])
    await deleteButton.trigger('click')
    await flushPromises()

    expect(deleteFile).toHaveBeenCalledWith(7)
    expect(listFiles.mock.calls.length).toBe(callsBeforeDelete + 1)
  })
})
