import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DefaultLayout from '~/layouts/default.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/' }),
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
