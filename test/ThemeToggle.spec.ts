import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ThemeToggle from '~/components/ThemeToggle.vue'
import { useTheme } from '~/composables/useTheme'

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    // Garante estado inicial dark (default) para cada teste.
    useTheme().setTheme('dark')
  })

  it('reflects the current theme (dark by default)', () => {
    const wrapper = mount(ThemeToggle)
    expect(wrapper.attributes('aria-pressed')).toBe('true')
    expect(wrapper.attributes('data-theme-state')).toBe('dark')
  })

  it('toggles the theme when clicked', async () => {
    const wrapper = mount(ThemeToggle)

    await wrapper.trigger('click')
    expect(wrapper.attributes('data-theme-state')).toBe('light')
    expect(wrapper.attributes('aria-pressed')).toBe('false')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    await wrapper.trigger('click')
    expect(wrapper.attributes('data-theme-state')).toBe('dark')
    expect(wrapper.attributes('aria-pressed')).toBe('true')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('shares state with the useTheme composable', async () => {
    const wrapper = mount(ThemeToggle)
    const { theme } = useTheme()

    await wrapper.trigger('click')
    expect(theme.value).toBe('light')
  })

  it('has an accessible label', () => {
    const wrapper = mount(ThemeToggle)
    expect(wrapper.attributes('aria-label')).toBeTruthy()
  })
})
