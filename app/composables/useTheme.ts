import { readonly, ref } from 'vue'

export type Theme = 'dark' | 'light'

/**
 * Tema padrão do produto (design system: dark por padrão).
 */
export const DEFAULT_THEME: Theme = 'dark'

/**
 * Chave de persistência da preferência de tema.
 *
 * Nesta fase a preferência é lida/escrita em `localStorage` (client-side,
 * sem servidor). Na Fase 3 este ponto passa a integrar com o store
 * `settings` do IndexedDB, preservando o mesmo contrato do composable.
 */
export const THEME_STORAGE_KEY = 'csvview:theme'

// Estado compartilhado em escopo de módulo: uma única fonte de verdade do
// tema para toda a aplicação (SPA, sem SSR).
const theme = ref<Theme>(DEFAULT_THEME)
let initialized = false

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light'
}

function readStoredTheme(): Theme {
  if (typeof localStorage === 'undefined') return DEFAULT_THEME
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return isTheme(stored) ? stored : DEFAULT_THEME
}

function applyTheme(value: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', value)
  }
}

/**
 * Estado de tema compartilhado. Aplica `data-theme` no elemento raiz,
 * usa dark como padrão quando não há preferência salva, e persiste a
 * escolha do usuário.
 */
export function useTheme() {
  if (!initialized) {
    initialized = true
    theme.value = readStoredTheme()
    applyTheme(theme.value)
  }

  function setTheme(value: Theme): void {
    theme.value = value
    applyTheme(value)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, value)
    }
  }

  function toggleTheme(): void {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  return {
    theme: readonly(theme),
    setTheme,
    toggleTheme,
  }
}
