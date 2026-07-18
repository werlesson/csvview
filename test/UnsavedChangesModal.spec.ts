import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UnsavedChangesModal from '~/components/UnsavedChangesModal.vue'

function mountModal(overrides: Record<string, unknown> = {}) {
  return mount(UnsavedChangesModal, {
    props: {
      open: true,
      fileName: 'transactions.csv',
      ...overrides,
    },
  })
}

describe('UnsavedChangesModal.vue', () => {
  it('não renderiza nada quando open é false', () => {
    const wrapper = mountModal({ open: false })
    expect(wrapper.find('.unsaved-overlay').exists()).toBe(false)
  })

  it('renderiza título e mensagem citando o nome do arquivo quando open é true', () => {
    const wrapper = mountModal()
    expect(wrapper.get('.unsaved-overlay__title').text()).toBe('Alterações não salvas')
    expect(wrapper.get('.unsaved-overlay__message').text()).toContain('transactions.csv')
  })

  it('canOverwrite true (default) exibe o botão "Salvar e sair"', () => {
    const wrapper = mountModal()
    expect(wrapper.find('.unsaved-overlay__overwrite').exists()).toBe(true)
  })

  it('canOverwrite false oculta o botão "Salvar e sair" (dataset ainda não persistido)', () => {
    const wrapper = mountModal({ canOverwrite: false })
    expect(wrapper.find('.unsaved-overlay__overwrite').exists()).toBe(false)
  })

  it('clicar em "Salvar como cópia e sair" emite "save-copy"', async () => {
    const wrapper = mountModal()
    await wrapper.get('.unsaved-overlay__save-copy').trigger('click')
    expect(wrapper.emitted('save-copy')).toEqual([[]])
    expect(wrapper.emitted('overwrite')).toBeUndefined()
    expect(wrapper.emitted('discard')).toBeUndefined()
  })

  it('clicar em "Salvar e sair" emite "overwrite"', async () => {
    const wrapper = mountModal()
    await wrapper.get('.unsaved-overlay__overwrite').trigger('click')
    expect(wrapper.emitted('overwrite')).toEqual([[]])
    expect(wrapper.emitted('save-copy')).toBeUndefined()
  })

  it('clicar em "Sair sem salvar" emite "discard"', async () => {
    const wrapper = mountModal()
    await wrapper.get('.unsaved-overlay__discard').trigger('click')
    expect(wrapper.emitted('discard')).toEqual([[]])
    expect(wrapper.emitted('save-copy')).toBeUndefined()
    expect(wrapper.emitted('overwrite')).toBeUndefined()
  })

  it('clicar em "Cancelar" emite "close", sem emitir nenhuma ação de saída', async () => {
    const wrapper = mountModal()
    await wrapper.get('.unsaved-overlay__cancel').trigger('click')
    expect(wrapper.emitted('close')).toEqual([[]])
    expect(wrapper.emitted('save-copy')).toBeUndefined()
    expect(wrapper.emitted('overwrite')).toBeUndefined()
    expect(wrapper.emitted('discard')).toBeUndefined()
  })

  it('clicar no backdrop emite "close"', async () => {
    const wrapper = mountModal()
    await wrapper.get('.unsaved-overlay').trigger('click')
    expect(wrapper.emitted('close')).toEqual([[]])
  })

  it('Escape emite "close"', async () => {
    const wrapper = mountModal()
    await wrapper.get('.unsaved-overlay__panel').trigger('keydown.esc')
    expect(wrapper.emitted('close')).toEqual([[]])
  })

  it('busy desabilita todos os botões e não emite nada ao clicar', async () => {
    const wrapper = mountModal({ busy: true })
    const buttons = [
      wrapper.get('.unsaved-overlay__save-copy'),
      wrapper.get('.unsaved-overlay__overwrite'),
      wrapper.get('.unsaved-overlay__discard'),
      wrapper.get('.unsaved-overlay__cancel'),
    ]

    for (const btn of buttons) {
      expect(btn.attributes('disabled')).toBeDefined()
      await btn.trigger('click')
    }

    expect(wrapper.emitted('save-copy')).toBeUndefined()
    expect(wrapper.emitted('overwrite')).toBeUndefined()
    expect(wrapper.emitted('discard')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('busy exibe um spinner no botão "Salvar e sair"', () => {
    const wrapper = mountModal({ busy: true })
    expect(wrapper.find('.unsaved-overlay__spinner').exists()).toBe(true)
  })
})
