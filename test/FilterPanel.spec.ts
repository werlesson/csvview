import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FilterPanel from '~/components/FilterPanel.vue'
import type { ViewerColumn } from '~/composables/useViewer'
import type { ColumnFilter } from '~/services/columnFilters'

function makeColumns(): ViewerColumn[] {
  return [
    { index: 0, label: 'id', type: 'number', visible: true, pinned: false, width: 180 },
    { index: 1, label: 'name', type: 'text', visible: true, pinned: false, width: 180 },
    { index: 2, label: 'amount', type: 'number', visible: false, pinned: false, width: 180 },
  ]
}

function mountPanel(overrides: Record<string, unknown> = {}) {
  return mount(FilterPanel, {
    props: {
      columns: makeColumns(),
      filters: [],
      open: true,
      ...overrides,
    },
  })
}

describe('FilterPanel', () => {
  it('não renderiza o drawer quando `open` é falso', () => {
    const wrapper = mountPanel({ open: false })
    expect(wrapper.find('.filter-overlay').exists()).toBe(false)
  })

  it('semeia o rascunho a partir dos filtros já aplicados, um card por filtro', () => {
    const filters: ColumnFilter[] = [
      { column: 1, operator: 'contem', value: 'ana' },
      { column: 0, operator: 'maiorQue', value: 100 },
    ]
    const wrapper = mountPanel({ filters })

    const cards = wrapper.findAll('.filter-card')
    expect(cards).toHaveLength(2)

    expect(
      cards[0]!.get<HTMLSelectElement>('select[aria-label="Coluna do filtro"]').element.value,
    ).toBe('1')
    expect(cards[0]!.get<HTMLInputElement>('input[aria-label="Valor do filtro"]').element.value).toBe(
      'ana',
    )
    expect(
      cards[1]!.get<HTMLSelectElement>('select[aria-label="Coluna do filtro"]').element.value,
    ).toBe('0')
  })

  it('reabrir o drawer redefine o rascunho a partir dos filtros aplicados atuais (edições anteriores não persistem sem "Filtrar")', async () => {
    const filters: ColumnFilter[] = [{ column: 0, operator: 'igual', value: '1' }]
    const wrapper = mountPanel({ filters })

    // Edita o rascunho sem clicar em "Filtrar".
    await wrapper.get('input[aria-label="Valor do filtro"]').setValue('999')
    expect(wrapper.get<HTMLInputElement>('input[aria-label="Valor do filtro"]').element.value).toBe(
      '999',
    )

    // Fecha e reabre — o rascunho descartado é substituído pelo estado aplicado original.
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })

    expect(wrapper.get<HTMLInputElement>('input[aria-label="Valor do filtro"]').element.value).toBe(
      '1',
    )
  })

  it('exibe uma coluna oculta no seletor de coluna do card', () => {
    const filters: ColumnFilter[] = [{ column: 2, operator: 'menorQue', value: 50 }]
    const wrapper = mountPanel({ filters })

    const columnOptions = wrapper
      .find('select[aria-label="Coluna do filtro"]')
      .findAll('option')
      .map((option) => option.text())
    expect(columnOptions).toContain('amount')
  })

  it('une cards do rascunho com o separador "E"', () => {
    const filters: ColumnFilter[] = [
      { column: 0, operator: 'vazio' },
      { column: 1, operator: 'preenchido' },
    ]
    const wrapper = mountPanel({ filters })

    expect(wrapper.findAll('.filter-overlay__joiner')).toHaveLength(1)
    expect(wrapper.get('.filter-overlay__joiner').text()).toBe('E')
  })

  it('sem filtros aplicados, mostra mensagem vazia e nenhum card', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('.filter-card').exists()).toBe(false)
    expect(wrapper.find('.filter-overlay__empty').exists()).toBe(true)
  })

  it('operadores oferecidos por card dependem da família de tipo da coluna atual (RF-01)', () => {
    const filters: ColumnFilter[] = [
      { column: 0, operator: 'maiorQue', value: 10 },
      { column: 1, operator: 'contem', value: 'x' },
    ]
    const wrapper = mountPanel({ filters })
    const cards = wrapper.findAll('.filter-card')

    const numberOperators = cards[0]!
      .find('select[aria-label="Operador do filtro"]')
      .findAll('option')
      .map((option) => option.text())
    expect(numberOperators).toContain('entre')
    expect(numberOperators).not.toContain('contém')

    const textOperators = cards[1]!
      .find('select[aria-label="Operador do filtro"]')
      .findAll('option')
      .map((option) => option.text())
    expect(textOperators).toContain('contém')
    expect(textOperators).not.toContain('entre')
  })

  it('"Adicionar filtro" cria um card no rascunho para a primeira coluna/operador, sem emitir nada ainda', async () => {
    const wrapper = mountPanel()

    await wrapper.get('.filter-overlay__add').trigger('click')

    expect(wrapper.findAll('.filter-card')).toHaveLength(1)
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('editar coluna/operador/valor de um card só afeta o rascunho — nenhum evento é emitido antes de "Filtrar"', async () => {
    const filters: ColumnFilter[] = [{ column: 0, operator: 'igual', value: '5' }]
    const wrapper = mountPanel({ filters })

    await wrapper.get('select[aria-label="Coluna do filtro"]').setValue('1')
    await wrapper.get('input[aria-label="Valor do filtro"]').setValue('bia')

    expect(wrapper.emitted('apply')).toBeUndefined()
    expect(
      wrapper.get<HTMLSelectElement>('select[aria-label="Coluna do filtro"]').element.value,
    ).toBe('1')
    expect(wrapper.get<HTMLInputElement>('input[aria-label="Valor do filtro"]').element.value).toBe(
      'bia',
    )
  })

  it('editar a coluna de um card realinha o operador quando ele não existe na nova família', async () => {
    const filters: ColumnFilter[] = [{ column: 0, operator: 'entre', value: { from: '1', to: '2' } }]
    const wrapper = mountPanel({ filters })

    await wrapper.get('select[aria-label="Coluna do filtro"]').setValue('1')

    expect(
      wrapper.get<HTMLSelectElement>('select[aria-label="Operador do filtro"]').element.value,
    ).toBe('igual')
    expect(wrapper.find('input[aria-label="Valor inicial"]').exists()).toBe(false)
  })

  it('operador de intervalo ("entre") mostra os campos "De"/"Até" e edita o rascunho', async () => {
    const filters: ColumnFilter[] = [{ column: 0, operator: 'entre', value: { from: '10', to: '20' } }]
    const wrapper = mountPanel({ filters })

    expect(wrapper.find('input[aria-label="Valor inicial"]').exists()).toBe(true)
    await wrapper.get('input[aria-label="Valor final"]').setValue('30')

    expect(wrapper.get<HTMLInputElement>('input[aria-label="Valor final"]').element.value).toBe('30')
    expect(wrapper.get<HTMLInputElement>('input[aria-label="Valor inicial"]').element.value).toBe('10')
  })

  it('operadores sem valor (ex.: "vazio") não exibem campo de valor', () => {
    const filters: ColumnFilter[] = [{ column: 0, operator: 'vazio' }]
    const wrapper = mountPanel({ filters })

    expect(wrapper.find('input[aria-label="Valor do filtro"]').exists()).toBe(false)
    expect(wrapper.find('input[aria-label="Valor inicial"]').exists()).toBe(false)
  })

  it('remover um card no drawer só afeta o rascunho, sem emitir nada', async () => {
    const filters: ColumnFilter[] = [
      { column: 0, operator: 'vazio' },
      { column: 1, operator: 'preenchido' },
    ]
    const wrapper = mountPanel({ filters })

    await wrapper.findAll('.filter-card__remove')[1]!.trigger('click')

    expect(wrapper.findAll('.filter-card')).toHaveLength(1)
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('"Limpar" esvazia o rascunho sem emitir "apply" e fica desabilitado sem filtros no rascunho', async () => {
    const filters: ColumnFilter[] = [{ column: 0, operator: 'vazio' }]
    const wrapper = mountPanel({ filters })

    await wrapper.get('.filter-overlay__clear').trigger('click')

    expect(wrapper.findAll('.filter-card')).toHaveLength(0)
    expect(wrapper.emitted('apply')).toBeUndefined()
    expect(wrapper.get<HTMLButtonElement>('.filter-overlay__clear').element.disabled).toBe(true)
  })

  it('"Filtrar" emite "apply" com o rascunho inteiro e "close"', async () => {
    const filters: ColumnFilter[] = [{ column: 0, operator: 'igual', value: '5' }]
    const wrapper = mountPanel({ filters })

    await wrapper.get('select[aria-label="Coluna do filtro"]').setValue('1')
    await wrapper.get('.filter-overlay__apply').trigger('click')

    expect(wrapper.emitted('apply')).toEqual([[[{ column: 1, operator: 'igual', value: '5' }]]])
    expect(wrapper.emitted('close')).toEqual([[]])
  })

  it('o "X" do cabeçalho emite "close" sem "apply" (descarta o rascunho)', async () => {
    const wrapper = mountPanel()
    await wrapper.get('.filter-overlay__close').trigger('click')
    expect(wrapper.emitted('close')).toEqual([[]])
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('clicar fora do painel (backdrop) emite "close" sem "apply"', async () => {
    const wrapper = mountPanel()
    await wrapper.get('.filter-overlay').trigger('click')
    expect(wrapper.emitted('close')).toEqual([[]])
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('clicar dentro do painel não emite "close"', async () => {
    const wrapper = mountPanel()
    await wrapper.get('.filter-overlay__panel').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('Escape dentro do painel emite "close" sem "apply"', async () => {
    const wrapper = mountPanel()
    await wrapper.get('.filter-overlay__panel').trigger('keydown.esc')
    expect(wrapper.emitted('close')).toEqual([[]])
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('não renderiza nenhum controle de filtro dentro de <th> (responsabilidade da tabela permanece intacta)', () => {
    const wrapper = mountPanel({ filters: [{ column: 0, operator: 'vazio' }] })
    expect(wrapper.findAll('th')).toHaveLength(0)
  })
})
