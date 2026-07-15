import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * `definePageMeta` é um macro de compilação do Nuxt: o Vite plugin de páginas
 * extrai o objeto de meta em build e remove a chamada do código compilado —
 * ela não sobrevive à montagem de um SFC isolado fora do pipeline do Nuxt
 * (sem `@nuxt/test-utils`, padrão atual do projeto). Por isso a verificação
 * de RF-07 é feita sobre o código-fonte das páginas, e não via `mount()`.
 */
function readPageSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8')
}

describe('pageTransition "view" configurado (RF-07)', () => {
  it.each([
    ['index.vue', '../../app/pages/index.vue'],
    ['viewer.vue', '../../app/pages/viewer.vue'],
  ])('%s declara definePageMeta com pageTransition name "view" e mode "out-in"', (_label, relativePath) => {
    const source = readPageSource(relativePath)

    expect(source).toMatch(/definePageMeta\(/)
    expect(source).toMatch(/pageTransition:\s*{\s*name:\s*['"]view['"]/)
    expect(source).toMatch(/mode:\s*['"]out-in['"]/)
  })
})
