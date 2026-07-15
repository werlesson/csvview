import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RecentFiles from '~/components/RecentFiles.vue'
import type { FileRecord } from '~/composables/useDatabase'

function makeRecord(overrides: Partial<FileRecord> = {}): FileRecord {
  const now = Date.now()
  return {
    id: 1,
    name: 'people.csv',
    delimiter: 'comma',
    size_bytes: Math.round(8.4 * 1024 * 1024),
    row_count: 1_204_882,
    column_count: 5,
    content: 'id,name\n1,Ana',
    created_at: now,
    last_opened_at: now - 2 * 60_000,
    ...overrides,
  }
}

describe('RecentFiles', () => {
  it('exibe os recentes com metadados formatados', () => {
    const wrapper = mount(RecentFiles, {
      props: { files: [makeRecord()] },
    })

    const text = wrapper.text()
    expect(text).toContain('people.csv')
    expect(text).toContain('1,204,882 linhas')
    expect(text).toContain('8.4 MB')
    expect(text).toContain('2m')
  })

  it('mantém a ordem recebida (mais recente ao mais antigo)', () => {
    const now = Date.now()
    const wrapper = mount(RecentFiles, {
      props: {
        files: [
          makeRecord({ id: 3, name: 'new.csv', last_opened_at: now }),
          makeRecord({ id: 2, name: 'mid.csv', last_opened_at: now - 60_000 }),
          makeRecord({ id: 1, name: 'old.csv', last_opened_at: now - 120_000 }),
        ],
      },
    })

    const names = wrapper.findAll('.recent__name').map((n) => n.text())
    expect(names).toEqual(['new.csv', 'mid.csv', 'old.csv'])
  })

  it('emite "open" com o id ao clicar num recente', async () => {
    const wrapper = mount(RecentFiles, {
      props: { files: [makeRecord({ id: 7 })] },
    })

    await wrapper.find('.recent__open').trigger('click')

    const emitted = wrapper.emitted('open')
    expect(emitted).toHaveLength(1)
    expect(emitted![0]![0]).toBe(7)
  })

  it('exige um segundo clique no botão de excluir para emitir "delete"', async () => {
    const wrapper = mount(RecentFiles, {
      props: { files: [makeRecord({ id: 7 })] },
    })

    const deleteButton = wrapper.get('.recent__delete')

    await deleteButton.trigger('click')
    expect(wrapper.emitted('delete')).toBeUndefined()
    expect(deleteButton.classes()).toContain('recent__delete--confirm')

    await deleteButton.trigger('click')
    const emitted = wrapper.emitted('delete')
    expect(emitted).toHaveLength(1)
    expect(emitted![0]![0]).toBe(7)
  })

  it('cancela a confirmação de exclusão ao perder o foco', async () => {
    const wrapper = mount(RecentFiles, {
      props: { files: [makeRecord({ id: 7 })] },
    })

    const deleteButton = wrapper.get('.recent__delete')
    await deleteButton.trigger('click')
    expect(deleteButton.classes()).toContain('recent__delete--confirm')

    await deleteButton.trigger('blur')
    expect(deleteButton.classes()).not.toContain('recent__delete--confirm')

    await deleteButton.trigger('click')
    expect(wrapper.emitted('delete')).toBeUndefined()
  })

  it('clicar em excluir não emite "open"', async () => {
    const wrapper = mount(RecentFiles, {
      props: { files: [makeRecord({ id: 7 })] },
    })

    await wrapper.get('.recent__delete').trigger('click')

    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('mostra o estado vazio quando não há recentes', () => {
    const wrapper = mount(RecentFiles, { props: { files: [] } })

    expect(wrapper.find('.recents__list').exists()).toBe(false)
    expect(wrapper.text()).toContain('Nenhum arquivo recente')
  })

  it('usa a mesma classe única recent__icon, sem variação por índice (RF-05)', () => {
    const wrapper = mount(RecentFiles, {
      props: {
        files: [
          makeRecord({ id: 1, name: 'a.csv' }),
          makeRecord({ id: 2, name: 'b.csv' }),
          makeRecord({ id: 3, name: 'c.csv' }),
          makeRecord({ id: 4, name: 'd.csv' }),
        ],
      },
    })

    const icons = wrapper.findAll('.recent__icon')
    expect(icons).toHaveLength(4)
    for (const icon of icons) {
      expect(icon.classes()).toEqual(['recent__icon'])
      expect(icon.classes()).not.toContain('recent__icon--0')
      expect(icon.classes()).not.toContain('recent__icon--1')
      expect(icon.classes()).not.toContain('recent__icon--2')
    }
  })
})
