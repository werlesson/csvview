import {
  openDatabase,
  SETTINGS_STORE,
  type SettingRecord,
} from '~/composables/useDatabase'

/**
 * Acesso ao store `settings`: preferências chave/valor persistidas no
 * navegador. Usado, entre outros, pela preferência de tema da Fase 1.
 */

/** Chave da preferência de tema. */
export const THEME_KEY = 'theme'

/** Valor padrão do tema (design system: dark por padrão). */
export const DEFAULT_THEME = 'dark'

/**
 * Defaults semeados quando a chave ainda não foi salva. Ler uma dessas chaves
 * sem valor persistido devolve o default correspondente.
 */
export const SETTINGS_DEFAULTS: Record<string, string> = {
  [THEME_KEY]: DEFAULT_THEME,
}

/**
 * Store `settings`. Get/set chave-valor com defaults semeados.
 */
export function useSettingsStore() {
  /**
   * Lê o valor de uma preferência. Se não houver valor salvo, devolve o
   * `fallback` informado, senão o default semeado da chave, senão
   * `undefined`.
   */
  async function getSetting(
    key: string,
    fallback?: string,
  ): Promise<string | undefined> {
    const db = await openDatabase()
    const record = await db.get(SETTINGS_STORE, key)
    if (record) return record.value
    return fallback ?? SETTINGS_DEFAULTS[key]
  }

  /** Define (persiste) o valor de uma preferência. */
  async function setSetting(key: string, value: string): Promise<void> {
    const db = await openDatabase()
    const record: SettingRecord = {
      key,
      value,
      updated_at: Date.now(),
    }
    await db.put(SETTINGS_STORE, record)
  }

  /**
   * Lê o tema persistido, ou `dark` (default) quando ausente. Atalho sobre
   * {@link getSetting} para a preferência de tema da Fase 1.
   */
  async function getTheme(): Promise<string> {
    return (await getSetting(THEME_KEY)) ?? DEFAULT_THEME
  }

  /** Persiste a preferência de tema. */
  async function setTheme(value: string): Promise<void> {
    await setSetting(THEME_KEY, value)
  }

  return {
    getSetting,
    setSetting,
    getTheme,
    setTheme,
  }
}
