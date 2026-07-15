import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDatabase, deleteDatabase } from '~/composables/useDatabase'
import { THEME_KEY, useSettingsStore } from '~/composables/useSettingsStore'
import { DEFAULT_THEME } from '~/composables/useTheme'

describe('settings store', () => {
  beforeEach(async () => {
    await deleteDatabase()
  })

  afterEach(async () => {
    await deleteDatabase()
  })

  describe('settings-default-theme', () => {
    it('ler theme sem valor salvo retorna dark', async () => {
      const { getTheme, getSetting } = useSettingsStore()

      expect(DEFAULT_THEME).toBe('dark')
      expect(await getTheme()).toBe('dark')
      // O default também é aplicado via getSetting pela chave `theme`.
      expect(await getSetting(THEME_KEY)).toBe('dark')
    })

    it('respeita o fallback informado para chaves sem default', async () => {
      const { getSetting } = useSettingsStore()

      expect(await getSetting('locale')).toBeUndefined()
      expect(await getSetting('locale', 'pt')).toBe('pt')
    })
  })

  describe('settings-persist', () => {
    it('definir theme persiste e é relido após recarregar', async () => {
      const { setTheme } = useSettingsStore()
      await setTheme('light')

      // Simula um recarregamento da página: fecha a conexão e reabre.
      await closeDatabase()

      const { getTheme } = useSettingsStore()
      expect(await getTheme()).toBe('light')
    })

    it('get/set genérico de chave-valor persiste', async () => {
      const { getSetting, setSetting } = useSettingsStore()

      await setSetting('locale', 'en')
      await closeDatabase()

      expect(await getSetting('locale')).toBe('en')
    })
  })
})
