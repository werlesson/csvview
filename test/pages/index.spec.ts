import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
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

vi.mock('~/composables/useFilesStore', () => ({
  useFilesStore: () => ({
    listFiles: vi.fn().mockResolvedValue([]),
  }),
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
})
