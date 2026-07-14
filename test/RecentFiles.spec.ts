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

    await wrapper.find('.recent').trigger('click')

    const emitted = wrapper.emitted('open')
    expect(emitted).toHaveLength(1)
    expect(emitted![0]![0]).toBe(7)
  })

  it('mostra o estado vazio quando não há recentes', () => {
    const wrapper = mount(RecentFiles, { props: { files: [] } })

    expect(wrapper.find('.recents__list').exists()).toBe(false)
    expect(wrapper.text()).toContain('Nenhum arquivo recente')
  })
})
