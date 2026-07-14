import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from '~/components/Button.vue'

describe('Button', () => {
  it('renders the default (primary) variant and slot content', () => {
    const wrapper = mount(Button, { slots: { default: 'Aplicar' } })
    expect(wrapper.text()).toBe('Aplicar')
    expect(wrapper.classes()).toContain('btn')
    expect(wrapper.classes()).toContain('btn--primary')
  })

  it('renders each variant with its modifier class', () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'danger'] as const) {
      const wrapper = mount(Button, { props: { variant } })
      expect(wrapper.classes()).toContain(`btn--${variant}`)
    }
  })

  it('applies the small size modifier', () => {
    const wrapper = mount(Button, { props: { size: 'small' } })
    expect(wrapper.classes()).toContain('btn--small')
  })

  it('does not apply the small modifier by default', () => {
    const wrapper = mount(Button)
    expect(wrapper.classes()).not.toContain('btn--small')
  })

  it('emits click when enabled', async () => {
    const wrapper = mount(Button)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('blocks click and sets the disabled attribute when disabled', async () => {
    const wrapper = mount(Button, { props: { disabled: true } })
    expect(wrapper.attributes('disabled')).toBeDefined()
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('defaults to type="button"', () => {
    const wrapper = mount(Button)
    expect(wrapper.attributes('type')).toBe('button')
  })
})
