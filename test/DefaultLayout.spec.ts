import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { useRoute } from 'vue-router'
import DefaultLayout from '~/layouts/default.vue'
import { useCurrentDataset } from '~/composables/useCurrentDataset'
import { useTheme } from '~/composables/useTheme'

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

describe('DefaultLayout — toggle de tema consolidado (RF-08, T04)', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    useTheme().setTheme('dark')
  })

  it('renderiza exatamente um controle de alternância de tema no header, sem botão inline residual', () => {
    const wrapper = mount(DefaultLayout)

    const toggles = wrapper.findAll('.theme-toggle')
    expect(toggles).toHaveLength(1)

    // Nenhum resquício do botão inline antigo (glifos de texto lua/sol).
    expect(wrapper.text()).not.toContain('☾')
    expect(wrapper.text()).not.toContain('☀')
  })

  it('aciona toggleTheme ao clicar e persiste a escolha', async () => {
    const wrapper = mount(DefaultLayout)
    const { theme } = useTheme()

    const toggle = wrapper.get('.theme-toggle')
    expect(toggle.attributes('aria-pressed')).toBe('true')

    await toggle.trigger('click')

    expect(theme.value).toBe('light')
    expect(toggle.attributes('aria-pressed')).toBe('false')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('csvview:theme')).toBe('light')
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

describe('DefaultLayout — regressão e fechamento (T11)', () => {
  afterEach(() => {
    useCurrentDataset().clearDataset()
    vi.mocked(useRoute).mockReturnValue({ path: '/' } as ReturnType<typeof useRoute>)
  })

  it('fora do Viewer, a logo fica visível e nenhum toggle de tema é duplicado', () => {
    vi.mocked(useRoute).mockReturnValue({ path: '/' } as ReturnType<typeof useRoute>)
    const wrapper = mount(DefaultLayout)

    expect(wrapper.find('img.logo-mark').exists()).toBe(true)
    expect(wrapper.find('.brand__file').exists()).toBe(false)
    expect(wrapper.findAll('.theme-toggle')).toHaveLength(1)
  })

  it('no Viewer com dataset carregado, logo e filename aparecem simultaneamente', () => {
    vi.mocked(useRoute).mockReturnValue({ path: '/viewer' } as ReturnType<typeof useRoute>)
    useCurrentDataset().setDataset(
      { header: ['id'], rows: [['1']] },
      {
        name: 'relatorio.csv',
        delimiter: 'comma',
        sizeBytes: 20,
        rowCount: 1,
        columnCount: 1,
      },
    )
    const wrapper = mount(DefaultLayout)

    expect(wrapper.find('img.logo-mark').exists()).toBe(true)
    const fileEl = wrapper.find('.brand__file')
    expect(fileEl.exists()).toBe(true)
    expect(fileEl.text()).toBe('relatorio.csv')
  })

  it.each([
    { path: '/', withDataset: false },
    { path: '/viewer', withDataset: true },
  ])('renderiza exatamente um ThemeToggle no DOM na rota $path', ({ path, withDataset }) => {
    vi.mocked(useRoute).mockReturnValue({ path } as ReturnType<typeof useRoute>)
    if (withDataset) {
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
    }

    const wrapper = mount(DefaultLayout)

    expect(wrapper.findAll('.theme-toggle')).toHaveLength(1)
  })

  it('o breakpoint de 640px não contém a regra órfã de brand__badge', () => {
    const layoutPath = resolve(process.cwd(), 'app/layouts/default.vue')
    const source = readFileSync(layoutPath, 'utf-8')

    expect(source).not.toContain('brand__badge')

    const mediaBlockMatch = source.match(
      /@media \(max-width: 640px\)\s*\{([\s\S]*?)\n\}/,
    )
    expect(mediaBlockMatch).not.toBeNull()
    const mediaBlockBody = mediaBlockMatch![1]
    expect(mediaBlockBody).not.toContain('brand__badge')
    expect(mediaBlockBody).toContain('.app-header__inner')
    expect(mediaBlockBody).toContain('.app-content')
  })
})
