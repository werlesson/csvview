import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { useRoute } from 'vue-router'
import DefaultLayout from '~/layouts/default.vue'
import { useCurrentDataset } from '~/composables/useCurrentDataset'

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ path: '/' })),
}))

describe('DefaultLayout (fora do Viewer)', () => {
  it('substitui o wordmark de texto pela LogoMark (RF-03)', () => {
    const wrapper = mount(DefaultLayout)

    expect(wrapper.text()).not.toContain('csvview.app')
    expect(wrapper.text()).not.toContain('100% no navegador')

    const logo = wrapper.find('img.logo-mark')
    expect(logo.exists()).toBe(true)
    expect(logo.attributes('src')).toBe('/logo.svg')
  })

  it('mantém a logo no canto esquerdo do header, dentro de .brand (UI-04)', () => {
    const wrapper = mount(DefaultLayout)

    const brand = wrapper.get('a.brand')
    expect(brand.attributes('href')).toBe('/')
    expect(brand.find('img.logo-mark').exists()).toBe(true)
  })
})

describe('DefaultLayout no Viewer com dataset carregado (RF-04)', () => {
  beforeEach(() => {
    vi.mocked(useRoute).mockReturnValue({ path: '/viewer' } as ReturnType<typeof useRoute>)
    useCurrentDataset().setDataset(
      { header: ['id'], rows: [['1']] },
      {
        name: 'dados.csv',
        delimiter: 'comma',
        sizeBytes: 10,
        rowCount: 1,
        columnCount: 1,
      },
    )
  })

  afterEach(() => {
    useCurrentDataset().clearDataset()
    vi.mocked(useRoute).mockReturnValue({ path: '/' } as ReturnType<typeof useRoute>)
  })

  it('exibe logo e nome do arquivo simultaneamente, nome depois do logo (RF-04)', () => {
    const wrapper = mount(DefaultLayout)

    const logo = wrapper.find('img.logo-mark')
    expect(logo.exists()).toBe(true)

    const fileEl = wrapper.find('.brand__file')
    expect(fileEl.exists()).toBe(true)
    expect(fileEl.text()).toBe('dados.csv')

    const inner = wrapper.get('.app-header__inner')
    const logoIndex = inner.html().indexOf('logo-mark')
    const fileIndex = inner.html().indexOf('dados.csv')
    expect(logoIndex).toBeGreaterThan(-1)
    expect(fileIndex).toBeGreaterThan(logoIndex)
  })
})
