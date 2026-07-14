import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Badge from '~/components/Badge.vue'

describe('Badge', () => {
  it('renders slot content with the default variant', () => {
    const wrapper = mount(Badge, { slots: { default: 'novo' } })
    expect(wrapper.text()).toBe('novo')
    expect(wrapper.classes()).toContain('badge')
    expect(wrapper.classes()).toContain('badge--default')
  })

  it('renders each variant with its modifier class', () => {
    const variants = [
      'default',
      'accent',
      'settled',
      'pending',
      'failed',
      'info',
    ] as const
    for (const variant of variants) {
      const wrapper = mount(Badge, { props: { variant } })
      expect(wrapper.classes()).toContain(`badge--${variant}`)
    }
  })
})
