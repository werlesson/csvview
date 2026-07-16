import { describe, expect, it } from 'vitest'
import {
  isFilterInert,
  matchesFilters,
  operatorsForFamily,
  typeFamily,
  type ColumnFilter,
} from '~/services/columnFilters'
import type { ColumnType } from '~/services/columnStats'

describe('columnFilters', () => {
  describe('typeFamily', () => {
    it('mapeia cada ColumnType para a família correspondente', () => {
      expect(typeFamily('number')).toBe('numero')
      expect(typeFamily('date')).toBe('data')
      expect(typeFamily('boolean')).toBe('booleano')
      expect(typeFamily('text')).toBe('texto')
      expect(typeFamily('email')).toBe('texto')
      expect(typeFamily('url')).toBe('texto')
    })
  })

  describe('operatorsForFamily', () => {
    it('número inclui maiorQue/menorQue/entre e exclui contem', () => {
      const operators = operatorsForFamily('numero')
      expect(operators).toContain('maiorQue')
      expect(operators).toContain('menorQue')
      expect(operators).toContain('entre')
      expect(operators).not.toContain('contem')
    })

    it('texto inclui contem/naoContem e exclui maiorQue/entre', () => {
      const operators = operatorsForFamily('texto')
      expect(operators).toContain('contem')
      expect(operators).toContain('naoContem')
      expect(operators).not.toContain('maiorQue')
      expect(operators).not.toContain('entre')
    })

    it('data inclui intervaloDatas', () => {
      expect(operatorsForFamily('data')).toContain('intervaloDatas')
    })

    it('vazio/preenchido aparecem em todas as famílias', () => {
      for (const family of ['texto', 'numero', 'data', 'booleano'] as const) {
        const operators = operatorsForFamily(family)
        expect(operators).toContain('vazio')
        expect(operators).toContain('preenchido')
      }
    })

    it('operadores booleano (verdadeiro/falso) só aparecem na família booleano', () => {
      expect(operatorsForFamily('booleano')).toContain('verdadeiro')
      expect(operatorsForFamily('booleano')).toContain('falso')
      for (const family of ['texto', 'numero', 'data'] as const) {
        const operators = operatorsForFamily(family)
        expect(operators).not.toContain('verdadeiro')
        expect(operators).not.toContain('falso')
      }
    })
  })

  describe('isFilterInert', () => {
    it('operador com valor exigido e ausente é inerte', () => {
      expect(isFilterInert({ column: 0, operator: 'igual' })).toBe(true)
      expect(isFilterInert({ column: 0, operator: 'igual', value: '' })).toBe(
        true,
      )
    })

    it('operador com valor válido não é inerte', () => {
      expect(
        isFilterInert({ column: 0, operator: 'igual', value: '100' }),
      ).toBe(false)
    })

    it('entre/intervaloDatas exigem from e to preenchidos', () => {
      expect(
        isFilterInert({
          column: 0,
          operator: 'entre',
          value: { from: '1', to: '' },
        }),
      ).toBe(true)
      expect(
        isFilterInert({ column: 0, operator: 'entre', value: { from: '1', to: '10' } }),
      ).toBe(false)
      expect(isFilterInert({ column: 0, operator: 'entre' })).toBe(true)
    })

    it('vazio/preenchido/verdadeiro/falso nunca são inertes', () => {
      expect(isFilterInert({ column: 0, operator: 'vazio' })).toBe(false)
      expect(isFilterInert({ column: 0, operator: 'preenchido' })).toBe(false)
      expect(isFilterInert({ column: 0, operator: 'verdadeiro' })).toBe(false)
      expect(isFilterInert({ column: 0, operator: 'falso' })).toBe(false)
    })
  })

  describe('semântica dos operadores (matchesFilters de um único filtro)', () => {
    const types: ColumnType[] = ['number']

    function rowOf(cell: string): string[] {
      return [cell]
    }

    it('vazio seleciona exatamente as células que satisfazem isEmptyCell', () => {
      const filter: ColumnFilter = { column: 0, operator: 'vazio' }
      expect(matchesFilters([filter], rowOf(''), types)).toBe(true)
      expect(matchesFilters([filter], rowOf('  '), types)).toBe(true)
      expect(matchesFilters([filter], rowOf('0'), types)).toBe(false)
    })

    it('preenchido é o complemento de vazio', () => {
      const filter: ColumnFilter = { column: 0, operator: 'preenchido' }
      expect(matchesFilters([filter], rowOf(''), types)).toBe(false)
      expect(matchesFilters([filter], rowOf('100'), types)).toBe(true)
    })

    it('igual numérico compara por valor: "100" == "100.0" == " 100 "', () => {
      const filter: ColumnFilter = {
        column: 0,
        operator: 'igual',
        value: '100',
      }
      expect(matchesFilters([filter], rowOf('100.0'), types)).toBe(true)
      expect(matchesFilters([filter], rowOf(' 100 '), types)).toBe(true)
      expect(matchesFilters([filter], rowOf('101'), types)).toBe(false)
    })

    it('igual numérico: célula não-parseável nunca satisfaz', () => {
      const filter: ColumnFilter = {
        column: 0,
        operator: 'igual',
        value: '100',
      }
      expect(matchesFilters([filter], rowOf('abc'), types)).toBe(false)
    })

    it('igual texto é caixa-insensível', () => {
      const textTypes: ColumnType[] = ['text']
      const filter: ColumnFilter = {
        column: 0,
        operator: 'igual',
        value: 'Failed',
      }
      expect(matchesFilters([filter], rowOf('failed'), textTypes)).toBe(true)
      expect(matchesFilters([filter], rowOf('FAILED'), textTypes)).toBe(true)
      expect(matchesFilters([filter], rowOf('ok'), textTypes)).toBe(false)
    })

    it('diferente mantém células vazias no resultado', () => {
      const filter: ColumnFilter = {
        column: 0,
        operator: 'diferente',
        value: '100',
      }
      expect(matchesFilters([filter], rowOf(''), types)).toBe(true)
      expect(matchesFilters([filter], rowOf('100'), types)).toBe(false)
      expect(matchesFilters([filter], rowOf('200'), types)).toBe(true)
    })

    it('contém/não contém testam substring caixa-insensível', () => {
      const textTypes: ColumnType[] = ['text']
      const contains: ColumnFilter = {
        column: 0,
        operator: 'contem',
        value: 'PIX',
      }
      expect(matchesFilters([contains], rowOf('Pagamento pix feito'), textTypes)).toBe(
        true,
      )
      expect(matchesFilters([contains], rowOf('boleto'), textTypes)).toBe(false)

      const notContains: ColumnFilter = {
        column: 0,
        operator: 'naoContem',
        value: 'pix',
      }
      expect(matchesFilters([notContains], rowOf('boleto'), textTypes)).toBe(true)
      expect(matchesFilters([notContains], rowOf('via pix'), textTypes)).toBe(false)
    })

    it('naoContem mantém células vazias no resultado', () => {
      const textTypes: ColumnType[] = ['text']
      const filter: ColumnFilter = {
        column: 0,
        operator: 'naoContem',
        value: 'pix',
      }
      expect(matchesFilters([filter], rowOf(''), textTypes)).toBe(true)
    })

    it('maiorQue/menorQue comparam numericamente', () => {
      const gt: ColumnFilter = { column: 0, operator: 'maiorQue', value: 100 }
      expect(matchesFilters([gt], rowOf('101'), types)).toBe(true)
      expect(matchesFilters([gt], rowOf('100'), types)).toBe(false)
      expect(matchesFilters([gt], rowOf('99'), types)).toBe(false)

      const lt: ColumnFilter = { column: 0, operator: 'menorQue', value: 100 }
      expect(matchesFilters([lt], rowOf('99'), types)).toBe(true)
      expect(matchesFilters([lt], rowOf('100'), types)).toBe(false)
    })

    it('maiorQue/menorQue: célula não-parseável nunca satisfaz', () => {
      const gt: ColumnFilter = { column: 0, operator: 'maiorQue', value: 100 }
      expect(matchesFilters([gt], rowOf('abc'), types)).toBe(false)
    })

    it('entre é inclusivo em ambos os limites', () => {
      const filter: ColumnFilter = {
        column: 0,
        operator: 'entre',
        value: { from: 100, to: 500 },
      }
      expect(matchesFilters([filter], rowOf('100'), types)).toBe(true)
      expect(matchesFilters([filter], rowOf('500'), types)).toBe(true)
      expect(matchesFilters([filter], rowOf('99'), types)).toBe(false)
      expect(matchesFilters([filter], rowOf('501'), types)).toBe(false)
    })

    it('entre: célula não-parseável nunca satisfaz', () => {
      const filter: ColumnFilter = {
        column: 0,
        operator: 'entre',
        value: { from: 100, to: 500 },
      }
      expect(matchesFilters([filter], rowOf('abc'), types)).toBe(false)
    })

    it('intervaloDatas aceita DMY e ISO, inclusivo em ambos os limites', () => {
      const dateTypes: ColumnType[] = ['date']
      const filterIso: ColumnFilter = {
        column: 0,
        operator: 'intervaloDatas',
        value: { from: '2024-01-01', to: '2024-01-31' },
      }
      expect(matchesFilters([filterIso], rowOf('2024-01-01'), dateTypes)).toBe(
        true,
      )
      expect(matchesFilters([filterIso], rowOf('2024-01-31'), dateTypes)).toBe(
        true,
      )
      expect(matchesFilters([filterIso], rowOf('2024-02-01'), dateTypes)).toBe(
        false,
      )

      const filterDmy: ColumnFilter = {
        column: 0,
        operator: 'intervaloDatas',
        value: { from: '01/01/2024', to: '31/01/2024' },
      }
      expect(matchesFilters([filterDmy], rowOf('15/01/2024'), dateTypes)).toBe(
        true,
      )
      expect(
        matchesFilters([filterDmy], rowOf('2024-01-15'), dateTypes),
      ).toBe(true)
      expect(matchesFilters([filterDmy], rowOf('2024-02-01'), dateTypes)).toBe(
        false,
      )
    })

    it('intervaloDatas: célula não-parseável nunca satisfaz', () => {
      const dateTypes: ColumnType[] = ['date']
      const filter: ColumnFilter = {
        column: 0,
        operator: 'intervaloDatas',
        value: { from: '2024-01-01', to: '2024-01-31' },
      }
      expect(matchesFilters([filter], rowOf('não é data'), dateTypes)).toBe(
        false,
      )
    })

    it('verdadeiro/falso consomem o reconhecedor booleano de rich-types-and-stats', () => {
      const boolTypes: ColumnType[] = ['boolean']
      const isTrue: ColumnFilter = { column: 0, operator: 'verdadeiro' }
      expect(matchesFilters([isTrue], rowOf('true'), boolTypes)).toBe(true)
      expect(matchesFilters([isTrue], rowOf('Sim'), boolTypes)).toBe(true)
      expect(matchesFilters([isTrue], rowOf('false'), boolTypes)).toBe(false)
      expect(matchesFilters([isTrue], rowOf(''), boolTypes)).toBe(false)

      const isFalse: ColumnFilter = { column: 0, operator: 'falso' }
      expect(matchesFilters([isFalse], rowOf('false'), boolTypes)).toBe(true)
      expect(matchesFilters([isFalse], rowOf('não'), boolTypes)).toBe(true)
      expect(matchesFilters([isFalse], rowOf('true'), boolTypes)).toBe(false)
    })
  })

  describe('matchesFilters — combinação AND e inércia', () => {
    const columnTypes: ColumnType[] = ['number', 'text', 'number']

    it('AND de múltiplos filtros em colunas diferentes', () => {
      const filters: ColumnFilter[] = [
        { column: 0, operator: 'maiorQue', value: 100 },
        { column: 1, operator: 'igual', value: 'failed' },
      ]
      expect(
        matchesFilters(filters, ['200', 'failed', '1'], columnTypes),
      ).toBe(true)
      expect(matchesFilters(filters, ['200', 'ok', '1'], columnTypes)).toBe(
        false,
      )
      expect(matchesFilters(filters, ['50', 'failed', '1'], columnTypes)).toBe(
        false,
      )
    })

    it('dois filtros na mesma coluna combinam por AND', () => {
      const filters: ColumnFilter[] = [
        { column: 0, operator: 'maiorQue', value: 100 },
        { column: 0, operator: 'menorQue', value: 500 },
      ]
      expect(matchesFilters(filters, ['200', 'x', '1'], columnTypes)).toBe(
        true,
      )
      expect(matchesFilters(filters, ['600', 'x', '1'], columnTypes)).toBe(
        false,
      )
      expect(matchesFilters(filters, ['50', 'x', '1'], columnTypes)).toBe(
        false,
      )
    })

    it('filtro inerte é ignorado (não restringe nenhuma linha)', () => {
      const filters: ColumnFilter[] = [
        { column: 0, operator: 'maiorQue', value: 100 },
        { column: 1, operator: 'igual' },
      ]
      expect(matchesFilters(filters, ['200', 'qualquer', '1'], columnTypes)).toBe(
        true,
      )
    })

    it('sem filtros ativos, nenhuma linha é restringida', () => {
      expect(matchesFilters([], ['1', '2', '3'], columnTypes)).toBe(true)
    })
  })

  describe('determinismo (RNF-02)', () => {
    it('mesmo input produz o mesmo resultado em execuções consecutivas', () => {
      const filters: ColumnFilter[] = [
        { column: 0, operator: 'entre', value: { from: 100, to: 500 } },
      ]
      const types: ColumnType[] = ['number']
      const row = ['250']
      const first = matchesFilters(filters, row, types)
      const second = matchesFilters(filters, row, types)
      expect(first).toBe(second)
      expect(first).toBe(true)
    })
  })
})
