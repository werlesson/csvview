import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  useTheme,
} from '~/composables/useTheme'

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
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
})
