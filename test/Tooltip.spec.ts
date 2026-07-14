import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { DOMWrapper } from '@vue/test-utils'
import Tooltip from '~/components/Tooltip.vue'

// v-show alterna `display: none`; quando visível o atributo `style` some.
const isHidden = (w: DOMWrapper<Element>) =>
  (w.element as HTMLElement).style.display === 'none'

describe('Tooltip', () => {
  const mountTooltip = () =>
    mount(Tooltip, {
      props: { text: 'Ajuda' },
      slots: { default: '<button>?</button>' },
    })

  it('is hidden by default', () => {
    const wrapper = mountTooltip()
    expect(isHidden(wrapper.get('[role="tooltip"]'))).toBe(true)
  })

  it('shows on hover (mouseenter) and hides on leave (mouseleave)', async () => {
    const wrapper = mountTooltip()

    await wrapper.trigger('mouseenter')
    expect(isHidden(wrapper.get('[role="tooltip"]'))).toBe(false)
    expect(wrapper.get('[role="tooltip"]').text()).toBe('Ajuda')

    await wrapper.trigger('mouseleave')
    expect(isHidden(wrapper.get('[role="tooltip"]'))).toBe(true)
  })

  it('shows on focus (focusin) and hides on blur (focusout)', async () => {
    const wrapper = mountTooltip()

    await wrapper.trigger('focusin')
    expect(isHidden(wrapper.get('[role="tooltip"]'))).toBe(false)

    await wrapper.trigger('focusout')
    expect(isHidden(wrapper.get('[role="tooltip"]'))).toBe(true)
  })

  it('renders custom content via the content slot', async () => {
    const wrapper = mount(Tooltip, {
      slots: {
        default: '<button>?</button>',
        content: '<strong>Rico</strong>',
      },
    })
    await wrapper.trigger('mouseenter')
    expect(wrapper.get('[role="tooltip"]').html()).toContain(
      '<strong>Rico</strong>',
    )
  })
})
