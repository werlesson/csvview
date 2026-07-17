import { readonly, ref } from 'vue'
import { useSettingsStore } from '~/composables/useSettingsStore'

export type Theme = 'dark' | 'light'

/**
 * Tema padrão do produto (design system: dark por padrão).
 */
export const DEFAULT_THEME: Theme = 'dark'

/**
 * Chave de persistência da preferência de tema em `localStorage`.
 *
 * RF-04: a fonte de verdade é o store `settings` do IndexedDB (via
 * `useSettingsStore`); `localStorage` permanece só como cache síncrono de
 * primeira pintura, para evitar o "flash" do tema padrão antes da resolução
 * assíncrona (`ssr:false` — o app é 100% client-side).
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

function writeStoredTheme(value: Theme): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, value)
  }
}

function applyTheme(value: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', value)
  }
}

/**
 * Estado de tema compartilhado. Aplica `data-theme` no elemento raiz,
 * usa dark como padrão quando não há preferência salva, e persiste a
 * escolha do usuário através do store `settings` do IndexedDB (RF-04).
 */
export function useTheme() {
  if (!initialized) {
    initialized = true
    // Cache síncrono de primeira pintura (evita o flash do tema padrão).
    theme.value = readStoredTheme()
    applyTheme(theme.value)

    // Fonte de verdade assíncrona: lida uma única vez por módulo, sobrescreve
    // o cache acima se divergir. Falha (ex.: IndexedDB indisponível) é
    // engolida e apenas logada — nunca quebra a leitura síncrona acima.
    useSettingsStore()
      .getTheme()
      .then((stored) => {
        if (isTheme(stored) && stored !== theme.value) {
          theme.value = stored
          applyTheme(stored)
        }
      })
      .catch((error) => {
        console.error('Falha ao ler o tema persistido:', error)
      })
  }

  function setTheme(value: Theme): void {
    theme.value = value
    applyTheme(value)
    // Cache secundário síncrono (não mais o único caminho de persistência).
    writeStoredTheme(value)
    // Persistência efetiva (RF-04), fire-and-forget: nunca bloqueia nem
    // expõe a Promise, preservando a assinatura `void` de `setTheme`.
    useSettingsStore()
      .setTheme(value)
      .catch((error) => {
        console.error('Falha ao persistir o tema:', error)
      })
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
