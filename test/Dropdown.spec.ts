import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { DOMWrapper } from '@vue/test-utils'
import Dropdown from '~/components/Dropdown.vue'

// v-show alterna `display: none`; quando visível o atributo `style` some.
const isHidden = (w: DOMWrapper<Element>) =>
  (w.element as HTMLElement).style.display === 'none'

const PANEL = `
  <button class="item" id="item-1">Coluna 1</button>
  <button class="item" id="item-2">Coluna 2</button>
  <button class="item" id="item-3">Coluna 3</button>
`

function mountDropdown() {
  return mount(Dropdown, {
    attachTo: document.body,
    props: { label: 'Colunas' },
    slots: { default: PANEL },
  })
}

describe('Dropdown', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the trigger label and starts closed', () => {
    const wrapper = mountDropdown()
    expect(wrapper.get('.dropdown__trigger').text()).toBe('Colunas')
    expect(wrapper.get('.dropdown__trigger').attributes('aria-expanded')).toBe(
      'false',
    )
    expect(isHidden(wrapper.get('[role="menu"]'))).toBe(true)
  })

  it('opens and closes when the trigger is clicked', async () => {
    const wrapper = mountDropdown()

    await wrapper.get('.dropdown__trigger').trigger('click')
    expect(wrapper.get('.dropdown__trigger').attributes('aria-expanded')).toBe(
      'true',
    )
    expect(isHidden(wrapper.get('[role="menu"]'))).toBe(false)
    expect(wrapper.emitted('open')).toHaveLength(1)

    await wrapper.get('.dropdown__trigger').trigger('click')
    expect(wrapper.get('.dropdown__trigger').attributes('aria-expanded')).toBe(
      'false',
    )
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('closes when clicking outside', async () => {
    const outside = document.createElement('div')
    document.body.appendChild(outside)

    const wrapper = mountDropdown()
    await wrapper.get('.dropdown__trigger').trigger('click')
    expect(isHidden(wrapper.get('[role="menu"]'))).toBe(false)

    outside.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true }),
    )
    await wrapper.vm.$nextTick()

    // O fechamento agora passa por uma transição (RF-06c/UI-02); o
    // `display: none` final só é garantido ao fim do ciclo de transição.
    await new Promise((resolve) => setTimeout(resolve, 250))
    expect(isHidden(wrapper.get('[role="menu"]'))).toBe(true)
  })

  it('does not close when clicking inside the panel', async () => {
    const wrapper = mountDropdown()
    await wrapper.get('.dropdown__trigger').trigger('click')

    wrapper
      .get('#item-2')
      .element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(isHidden(wrapper.get('[role="menu"]'))).toBe(false)
  })

  it('focuses the first item on open', async () => {
    const wrapper = mountDropdown()
    await wrapper.get('.dropdown__trigger').trigger('click')
    await wrapper.vm.$nextTick()
    expect(document.activeElement?.id).toBe('item-1')
  })

  it('navigates items with ArrowDown / ArrowUp', async () => {
    const wrapper = mountDropdown()
    await wrapper.get('.dropdown__trigger').trigger('click')
    await wrapper.vm.$nextTick()

    const menu = wrapper.get('[role="menu"]')

    await menu.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement?.id).toBe('item-2')

    await menu.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement?.id).toBe('item-3')

    // Envolve para o primeiro item.
    await menu.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement?.id).toBe('item-1')

    await menu.trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement?.id).toBe('item-3')
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const wrapper = mountDropdown()
    await wrapper.get('.dropdown__trigger').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'Escape' })

    // Foco retorna de imediato; o `display: none` só é aplicado ao fim da
    // transição de saída (RF-06c/UI-02).
    expect(document.activeElement).toBe(wrapper.get('.dropdown__trigger').element)

    await new Promise((resolve) => setTimeout(resolve, 250))
    expect(isHidden(wrapper.get('[role="menu"]'))).toBe(true)
  })

  it('opens with ArrowDown from the trigger', async () => {
    const wrapper = mountDropdown()
    await wrapper.get('.dropdown__trigger').trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.get('.dropdown__trigger').attributes('aria-expanded')).toBe(
      'true',
    )
  })

  // Sem espaço à direita do gatilho (ex.: gatilho perto da borda direita da
  // página), o painel deve ancorar pela direita em vez de vazar da viewport
  // e gerar scroll horizontal indesejado.
  it('flips the panel to the right edge when there is no room to its right', async () => {
    const wrapper = mountDropdown()
    const trigger = wrapper.get('.dropdown__trigger').element as HTMLElement
    const panelEl = wrapper.get('[role="menu"]').element as HTMLElement

    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      left: window.innerWidth - 50,
      right: window.innerWidth,
      top: 0,
      bottom: 30,
      width: 50,
      height: 30,
      x: window.innerWidth - 50,
      y: 0,
      toJSON: () => {},
    })
    Object.defineProperty(panelEl, 'offsetWidth', { value: 220, configurable: true })

    await wrapper.get('.dropdown__trigger').trigger('click')
    await wrapper.vm.$nextTick()

    expect(panelEl.classList.contains('dropdown__panel--right')).toBe(true)
  })

  it('keeps the panel anchored to the left when there is enough room', async () => {
    const wrapper = mountDropdown()
    const trigger = wrapper.get('.dropdown__trigger').element as HTMLElement
    const panelEl = wrapper.get('[role="menu"]').element as HTMLElement

    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      right: 60,
      top: 0,
      bottom: 30,
      width: 50,
      height: 30,
      x: 10,
      y: 0,
      toJSON: () => {},
    })
    Object.defineProperty(panelEl, 'offsetWidth', { value: 220, configurable: true })

    await wrapper.get('.dropdown__trigger').trigger('click')
    await wrapper.vm.$nextTick()

    expect(panelEl.classList.contains('dropdown__panel--right')).toBe(false)
  })
})
