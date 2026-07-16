import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StatsPanel from '~/components/StatsPanel.vue'
import { computeColumnStats } from '~/services/columnStats'

/** Coluna numérica inteira de exemplo (com uma célula vazia e um valor repetido). */
const NUMERIC_VALUES = ['1', '2', '2', '3', '', '10']
/** Coluna numérica decimal de exemplo. */
const DECIMAL_VALUES = ['1.5', '2', '3.25', '']
/** Coluna de texto de exemplo. */
const TEXT_VALUES = ['Ana', 'Bruno', 'Ana', '']
/** Coluna de datas de exemplo. */
const DATE_VALUES = ['2020-01-01', '2021-12-31', '']
/** Coluna booleana de exemplo. */
const BOOLEAN_VALUES = ['sim', 'não', 'sim', '']
/** Coluna de e-mails de exemplo. */
const EMAIL_VALUES = ['a@b.com', 'c@d.org', '']
/** Coluna de URLs de exemplo. */
const URL_VALUES = ['https://x.io', 'http://y.io/p', '']

function mountFor(label: string, values: string[]) {
  return mount(StatsPanel, {
    props: { label, stats: computeColumnStats(values) },
  })
}

describe('StatsPanel', () => {
  it('não renderiza nada quando não há coluna selecionada', () => {
    const wrapper = mount(StatsPanel, { props: { label: null, stats: null } })

    expect(wrapper.find('.stats-panel').exists()).toBe(false)
    expect(wrapper.find('.stats-panel__content').exists()).toBe(false)
  })

  it('emite close ao clicar no botão "X" do painel', async () => {
    const wrapper = mount(StatsPanel, {
      props: { label: 'amount', stats: computeColumnStats(NUMERIC_VALUES) },
    })

    await wrapper.find('.stats-panel__close').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('mostra o rótulo e o tipo inferido em pt (inteiro/data/texto)', () => {
    expect(mountFor('amount', NUMERIC_VALUES).find('[data-type]').text()).toBe(
      'inteiro',
    )
    expect(mountFor('name', TEXT_VALUES).find('[data-type]').text()).toBe(
      'texto',
    )
    expect(mountFor('date', DATE_VALUES).find('[data-type]').text()).toBe(
      'data',
    )

    const numeric = mountFor('amount', NUMERIC_VALUES)
    expect(numeric.find('.stats-panel__title').text()).toBe('amount')
  })

  it('exibe rótulos pt-BR dos novos tipos (booleano/e-mail/URL)', () => {
    expect(mountFor('ativo', BOOLEAN_VALUES).find('[data-type]').text()).toBe(
      'booleano',
    )
    expect(mountFor('email', EMAIL_VALUES).find('[data-type]').text()).toBe(
      'e-mail',
    )
    expect(mountFor('site', URL_VALUES).find('[data-type]').text()).toBe('URL')
  })

  it('deriva o rótulo numérico de numericKind (inteiro vs decimal)', () => {
    expect(mountFor('amount', NUMERIC_VALUES).find('[data-type]').text()).toBe(
      'inteiro',
    )
    expect(mountFor('price', DECIMAL_VALUES).find('[data-type]').text()).toBe(
      'decimal',
    )
  })

  it('mostra as quatro métricas gerais, com valores do motor da Fase 5', () => {
    const stats = computeColumnStats(NUMERIC_VALUES)
    const wrapper = mount(StatsPanel, {
      props: { label: 'amount', stats },
    })

    expect(wrapper.find('[data-metric="nulls"]').text()).toContain(
      String(stats.nulls),
    )
    expect(wrapper.find('[data-metric="unique"]').text()).toContain(
      String(stats.unique),
    )
    expect(wrapper.find('[data-metric="duplicates"]').text()).toContain(
      String(stats.duplicates),
    )
    expect(wrapper.find('[data-metric="filled"]').text()).toContain(
      String(stats.filled),
    )
  })

  it('mostra mínimo, máximo e média apenas para colunas numéricas', () => {
    const numeric = mountFor('amount', NUMERIC_VALUES)
    const stats = computeColumnStats(NUMERIC_VALUES)

    expect(numeric.find('[data-metric="min"]').exists()).toBe(true)
    expect(numeric.find('[data-metric="max"]').exists()).toBe(true)
    expect(numeric.find('[data-metric="mean"]').exists()).toBe(true)
    expect(numeric.find('[data-metric="min"]').text()).toContain(
      String(stats.numeric!.min),
    )
    expect(numeric.find('[data-metric="max"]').text()).toContain(
      String(stats.numeric!.max),
    )

    // Colunas não-numéricas não exibem as métricas numéricas.
    const text = mountFor('name', TEXT_VALUES)
    expect(text.find('[data-metric="min"]').exists()).toBe(false)
    expect(text.find('[data-metric="max"]').exists()).toBe(false)
    expect(text.find('[data-metric="mean"]').exists()).toBe(false)
  })

  it('mostra soma e mediana com os valores do motor para colunas numéricas', () => {
    const numeric = mountFor('amount', NUMERIC_VALUES)
    const stats = computeColumnStats(NUMERIC_VALUES)

    expect(numeric.find('[data-metric="sum"]').exists()).toBe(true)
    expect(numeric.find('[data-metric="median"]').exists()).toBe(true)
    expect(numeric.find('[data-metric="sum"]').text()).toContain(
      String(stats.numeric!.sum),
    )
    expect(numeric.find('[data-metric="median"]').text()).toContain(
      String(stats.numeric!.median),
    )

    // Colunas não-numéricas não exibem soma nem mediana.
    const text = mountFor('name', TEXT_VALUES)
    expect(text.find('[data-metric="sum"]').exists()).toBe(false)
    expect(text.find('[data-metric="median"]').exists()).toBe(false)
  })

  it('renderiza o histograma só para colunas numéricas', () => {
    const numeric = mountFor('amount', NUMERIC_VALUES)
    expect(numeric.find('[data-section="histogram"]').exists()).toBe(true)
    expect(numeric.findAll('.histogram__bar').length).toBeGreaterThan(0)

    const text = mountFor('name', TEXT_VALUES)
    expect(text.find('[data-section="histogram"]').exists()).toBe(false)

    const date = mountFor('date', DATE_VALUES)
    expect(date.find('[data-section="histogram"]').exists()).toBe(false)
  })

  it('atualiza o painel ao trocar de coluna (props reativas)', async () => {
    const wrapper = mount(StatsPanel, {
      props: { label: 'amount', stats: computeColumnStats(NUMERIC_VALUES) },
    })

    expect(wrapper.find('[data-type]').text()).toBe('inteiro')
    expect(wrapper.find('[data-section="histogram"]').exists()).toBe(true)

    await wrapper.setProps({
      label: 'name',
      stats: computeColumnStats(TEXT_VALUES),
    })
    // `mode="out-in"` (RF-06b/UI-03) só monta o novo conteúdo após a
    // transição de saída do anterior terminar.
    await new Promise((resolve) => setTimeout(resolve, 250))

    expect(wrapper.find('.stats-panel__title').text()).toBe('name')
    expect(wrapper.find('[data-type]').text()).toBe('texto')
    expect(wrapper.find('[data-section="histogram"]').exists()).toBe(false)
  })
})
