import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SaveCopyModal from '~/components/SaveCopyModal.vue'

function mountModal(overrides: Record<string, unknown> = {}) {
  return mount(SaveCopyModal, {
    props: {
      open: true,
      fileName: 'transactions.csv',
      suggestedName: 'transactions (cópia).csv',
      ...overrides,
    },
  })
}

describe('SaveCopyModal.vue', () => {
  it('não renderiza nada quando open é false', () => {
    const wrapper = mountModal({ open: false })
    expect(wrapper.find('.save-copy-overlay').exists()).toBe(false)
  })

  it('pré-preenche o campo de nome com suggestedName ao abrir', () => {
    const wrapper = mountModal()
    expect(wrapper.get<HTMLInputElement>('.save-copy-overlay__input').element.value).toBe(
      'transactions (cópia).csv',
    )
  })

  it('menciona o nome do arquivo original na mensagem', () => {
    const wrapper = mountModal()
    expect(wrapper.get('.save-copy-overlay__message').text()).toContain('transactions.csv')
  })

  it('permite editar o nome e emite "confirm" com o valor digitado (trim aplicado)', async () => {
    const wrapper = mountModal()
    await wrapper.get('.save-copy-overlay__input').setValue('  relatório final.csv  ')

    await wrapper.get('.save-copy-overlay__confirm').trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([['relatório final.csv']])
  })

  it('permite repetir o nome do arquivo original (sem bloqueio de unicidade)', async () => {
    const wrapper = mountModal()
    await wrapper.get('.save-copy-overlay__input').setValue('transactions.csv')

    await wrapper.get('.save-copy-overlay__confirm').trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([['transactions.csv']])
  })

  it('nome vazio (só espaços) desabilita a confirmação e não emite "confirm"', async () => {
    const wrapper = mountModal()
    await wrapper.get('.save-copy-overlay__input').setValue('   ')

    expect(wrapper.get('.save-copy-overlay__confirm').attributes('disabled')).toBeDefined()
    await wrapper.get('.save-copy-overlay__confirm').trigger('click')

    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('reabastece o campo com a suggestedName a cada reabertura', async () => {
    const wrapper = mountModal({ open: false })
    await wrapper.setProps({ open: true, suggestedName: 'vendas (cópia).csv' })

    expect(wrapper.get<HTMLInputElement>('.save-copy-overlay__input').element.value).toBe(
      'vendas (cópia).csv',
    )
  })

  it('clicar em "Cancelar" emite "close" sem emitir "confirm"', async () => {
    const wrapper = mountModal()
    await wrapper.get('.save-copy-overlay__cancel').trigger('click')

    expect(wrapper.emitted('close')).toEqual([[]])
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('clicar no backdrop emite "close"', async () => {
    const wrapper = mountModal()
    await wrapper.get('.save-copy-overlay').trigger('click')
    expect(wrapper.emitted('close')).toEqual([[]])
  })

  it('Escape emite "close"', async () => {
    const wrapper = mountModal()
    await wrapper.get('.save-copy-overlay__panel').trigger('keydown.esc')
    expect(wrapper.emitted('close')).toEqual([[]])
  })

  it('busy desabilita campo e botões e não emite nada ao clicar', async () => {
    const wrapper = mountModal({ busy: true })

    expect(wrapper.get('.save-copy-overlay__input').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.save-copy-overlay__cancel').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.save-copy-overlay__confirm').attributes('disabled')).toBeDefined()

    await wrapper.get('.save-copy-overlay__cancel').trigger('click')
    await wrapper.get('.save-copy-overlay__confirm').trigger('click')

    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('busy exibe um spinner no botão de confirmação', () => {
    const wrapper = mountModal({ busy: true })
    expect(wrapper.find('.save-copy-overlay__spinner').exists()).toBe(true)
  })
})
