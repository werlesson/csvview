import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDatabase } from '~/composables/useDatabase'
import { useSettingsStore } from '~/composables/useSettingsStore'
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  useTheme,
} from '~/composables/useTheme'

describe('useTheme', () => {
  beforeEach(async () => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    await deleteDatabase()
  })

  it('defaults to dark when no preference is stored', () => {
    const { theme } = useTheme()
    expect(DEFAULT_THEME).toBe('dark')
    expect(theme.value).toBe('dark')
    // O tema inicial é aplicado ao elemento raiz.
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('applies and persists the theme when set', () => {
    const { theme, setTheme } = useTheme()

    setTheme('light')

    expect(theme.value).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('toggles between dark and light', () => {
    const { theme, setTheme, toggleTheme } = useTheme()
    setTheme('dark')

    toggleTheme()
    expect(theme.value).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    toggleTheme()
    expect(theme.value).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  describe('persistência via IndexedDB (RF-04, CT-02)', () => {
    it('após setTheme, uma nova instância de useSettingsStore().getTheme() resolve o tema', async () => {
      const { setTheme } = useTheme()

      setTheme('light')
      await flushPromises()

      expect(await useSettingsStore().getTheme()).toBe('light')
    })

    it('sem localStorage, resolve o tema persistido em settings após aguardar a resolução assíncrona', async () => {
      // Semeia o store `settings` diretamente (sem passar por localStorage).
      await useSettingsStore().setTheme('light')
      localStorage.clear()

      // Simula uma nova instância do módulo (equivalente a um F5): o
      // singleton `initialized` de useTheme.ts só dispara a resolução
      // assíncrona uma vez por módulo.
      vi.resetModules()
      const fresh = await import('~/composables/useTheme')
      const { theme } = fresh.useTheme()

      // Cache de primeira pintura: sem localStorage, cai no padrão.
      expect(theme.value).toBe(DEFAULT_THEME)

      // Resolução assíncrona via IndexedDB sobrescreve o cache padrão
      // (múltiplos ticks: abertura da conexão + transação + leitura).
      await vi.waitFor(() => {
        expect(theme.value).toBe('light')
      })
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })
  })
})
