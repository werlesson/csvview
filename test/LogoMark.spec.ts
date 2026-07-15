import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LogoMark from '~/components/LogoMark.vue'

describe('LogoMark', () => {
  it('monta sem props obrigatórias e renderiza a imagem do asset local', () => {
    const wrapper = mount(LogoMark)

    const img = wrapper.get('img')
    expect(img.attributes('src')).toBe('/logo.svg')
    expect(img.attributes('alt')).toBeTruthy()
  })
})
