import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmModal from '~/components/ConfirmModal.vue'

function mountModal(overrides: Record<string, unknown> = {}) {
  return mount(ConfirmModal, {
    props: {
      open: true,
      title: 'Sobrescrever original?',
      message: 'Isso substituirá permanentemente o conteúdo do arquivo.',
      ...overrides,
    },
  })
}

describe('ConfirmModal.vue', () => {
  it('não renderiza nada quando open é false', () => {
    const wrapper = mountModal({ open: false })
    expect(wrapper.find('.confirm-overlay').exists()).toBe(false)
  })

  it('renderiza título e mensagem quando open é true', () => {
    const wrapper = mountModal()
    expect(wrapper.get('.confirm-overlay__title').text()).toBe('Sobrescrever original?')
    expect(wrapper.get('.confirm-overlay__message').text()).toContain('substituirá permanentemente')
  })

  it('usa os rótulos default "Confirmar"/"Cancelar" quando não informados', () => {
    const wrapper = mountModal()
    expect(wrapper.get('.confirm-overlay__confirm').text()).toBe('Confirmar')
    expect(wrapper.get('.confirm-overlay__cancel').text()).toBe('Cancelar')
  })

  it('aceita rótulos customizados para os botões', () => {
    const wrapper = mountModal({ confirmLabel: 'Sobrescrever', cancelLabel: 'Voltar' })
    expect(wrapper.get('.confirm-overlay__confirm').text()).toBe('Sobrescrever')
    expect(wrapper.get('.confirm-overlay__cancel').text()).toBe('Voltar')
  })

  it('clicar em "Confirmar" emite "confirm"', async () => {
    const wrapper = mountModal()
    await wrapper.get('.confirm-overlay__confirm').trigger('click')
    expect(wrapper.emitted('confirm')).toEqual([[]])
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('clicar em "Cancelar" emite "close", sem emitir "confirm"', async () => {
    const wrapper = mountModal()
    await wrapper.get('.confirm-overlay__cancel').trigger('click')
    expect(wrapper.emitted('close')).toEqual([[]])
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('clicar no backdrop emite "close"', async () => {
    const wrapper = mountModal()
    await wrapper.get('.confirm-overlay').trigger('click')
    expect(wrapper.emitted('close')).toEqual([[]])
  })

  it('Escape emite "close"', async () => {
    const wrapper = mountModal()
    await wrapper.get('.confirm-overlay__panel').trigger('keydown.esc')
    expect(wrapper.emitted('close')).toEqual([[]])
  })

  it('danger aplica a classe de estilo destrutivo ao botão de confirmação', () => {
    const wrapper = mountModal({ danger: true })
    expect(wrapper.get('.confirm-overlay__confirm').classes()).toContain(
      'confirm-overlay__confirm--danger',
    )
  })

  it('sem danger, o botão de confirmação não tem a classe destrutiva', () => {
    const wrapper = mountModal()
    expect(wrapper.get('.confirm-overlay__confirm').classes()).not.toContain(
      'confirm-overlay__confirm--danger',
    )
  })

  it('busy desabilita os dois botões e não emite nada ao clicar', async () => {
    const wrapper = mountModal({ busy: true })
    const confirmBtn = wrapper.get('.confirm-overlay__confirm')
    const cancelBtn = wrapper.get('.confirm-overlay__cancel')

    expect(confirmBtn.attributes('disabled')).toBeDefined()
    expect(cancelBtn.attributes('disabled')).toBeDefined()

    await confirmBtn.trigger('click')
    await cancelBtn.trigger('click')

    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('busy exibe um spinner no botão de confirmação', () => {
    const wrapper = mountModal({ busy: true })
    expect(wrapper.find('.confirm-overlay__spinner').exists()).toBe(true)
  })
})
