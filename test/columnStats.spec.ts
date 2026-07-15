import { describe, expect, it } from 'vitest'
import {
  buildHistogram,
  computeColumnStats,
  computeDatasetStats,
  histogramBinCount,
  inferColumnType,
  isBooleanValue,
  isEmailValue,
  isUrlValue,
  numericKindOf,
  parseNumber,
} from '~/services/columnStats'

describe('inferência de tipo e estatísticas de coluna', () => {
  describe('infer-number', () => {
    it('coluna toda numérica é inferida como number', () => {
      expect(inferColumnType(['1', '2', '3'])).toBe('number')
      expect(inferColumnType(['-1', '2.5', '3e2', '+4', '.5'])).toBe('number')
    })

    it('células vazias não invalidam a inferência numérica', () => {
      expect(inferColumnType(['10', '', '20', null, undefined, '30'])).toBe(
        'number',
      )
    })
  })

  describe('infer-date', () => {
    it('coluna de datas reconhecíveis é inferida como date', () => {
      expect(inferColumnType(['2020-01-01', '2021-12-31'])).toBe('date')
      expect(inferColumnType(['2020/01/01', '2020.02.15'])).toBe('date')
      expect(inferColumnType(['01/02/2020', '31/12/2019'])).toBe('date')
    })

    it('datas ISO com hora e células vazias continuam sendo date', () => {
      expect(
        inferColumnType(['2020-01-01T10:30:00', '', '2021-06-15 08:00']),
      ).toBe('date')
    })
  })

  describe('recognizers', () => {
    it('isBooleanValue aceita a allowlist case-insensitive e rejeita 0/1', () => {
      for (const token of ['true', 'FALSE', 'Sim', 'não', 'NÃO', 'yes', 'No']) {
        expect(isBooleanValue(token)).toBe(true)
      }
      expect(isBooleanValue('0')).toBe(false)
      expect(isBooleanValue('1')).toBe(false)
      expect(isBooleanValue('maybe')).toBe(false)
      expect(isBooleanValue('')).toBe(false)
      expect(isBooleanValue(null)).toBe(false)
    })

    it('isEmailValue aceita e-mail simples e rejeita espaço/sem domínio', () => {
      expect(isEmailValue('a@b.com')).toBe(true)
      expect(isEmailValue('user.name@sub.dominio.org')).toBe(true)
      expect(isEmailValue('a @b.com')).toBe(false)
      expect(isEmailValue('a@b .com')).toBe(false)
      expect(isEmailValue('a@bcom')).toBe(false)
      expect(isEmailValue('@b.com')).toBe(false)
      expect(isEmailValue('a@@b.com')).toBe(false)
    })

    it('isUrlValue aceita apenas http/https e rejeita ftp e outros', () => {
      expect(isUrlValue('http://x.io')).toBe(true)
      expect(isUrlValue('https://y.io/path?q=1')).toBe(true)
      expect(isUrlValue('HTTPS://Z.IO')).toBe(true)
      expect(isUrlValue('ftp://x.io')).toBe(false)
      expect(isUrlValue('mailto:a@b.com')).toBe(false)
      expect(isUrlValue('x.io')).toBe(false)
      expect(isUrlValue('http:// x.io')).toBe(false)
    })

    it('numericKindOf distingue inteiro de decimal pelo valor', () => {
      expect(numericKindOf([1, 2, -3])).toBe('integer')
      expect(numericKindOf([1, 2.5])).toBe('decimal')
      expect(numericKindOf([0])).toBe('integer')
      // "1.0"/"5.00"/"2e3" viram inteiros por valor após o parse.
      const parsed = ['1.0', '5.00', '2e3'].map((v) => parseNumber(v)!)
      expect(numericKindOf(parsed)).toBe('integer')
      expect(numericKindOf(['1', '2.5'].map((v) => parseNumber(v)!))).toBe(
        'decimal',
      )
    })
  })

  describe('infer-boolean-email-url', () => {
    it('coluna só de e-mails é inferida como email', () => {
      expect(inferColumnType(['a@b.com', 'c@d.org'])).toBe('email')
    })

    it('coluna só de URLs http/https é inferida como url', () => {
      expect(inferColumnType(['https://x.io', 'http://y.io/p'])).toBe('url')
    })

    it('coluna só de tokens booleanos é inferida como boolean', () => {
      expect(inferColumnType(['true', 'false', 'Sim', 'não'])).toBe('boolean')
      expect(inferColumnType(['yes', 'no'])).toBe('boolean')
    })

    it('0/1 são número, não booleano (número precede booleano)', () => {
      expect(inferColumnType(['0', '1', '1', '0'])).toBe('number')
    })
  })

  describe('infer-precedence', () => {
    it('a precedência é determinística: mesmo input, mesmo tipo', () => {
      const values = ['a@b.com', 'c@d.org']
      expect(inferColumnType(values)).toBe(inferColumnType(values))
      const nums = ['1', '2', '', '3']
      expect(inferColumnType(nums)).toBe('number')
      expect(inferColumnType(nums)).toBe(inferColumnType(nums))
    })

    it('células vazias são ignoradas na precedência', () => {
      expect(inferColumnType(['1', '2', '', '3'])).toBe('number')
      expect(inferColumnType(['a@b.com', '', 'c@d.org'])).toBe('email')
      expect(inferColumnType(['', ''])).toBe('text')
    })

    it('mistura de tipos reconhecíveis cai em text', () => {
      expect(inferColumnType(['a@b.com', 'https://x.io'])).toBe('text')
      expect(inferColumnType(['true', 'a@b.com'])).toBe('text')
    })
  })

  describe('infer-text-mixed', () => {
    it('mistura de número, data e texto é inferida como text', () => {
      expect(inferColumnType(['1', 'abc', '2020-01-01'])).toBe('text')
    })

    it('texto puro é inferido como text', () => {
      expect(inferColumnType(['maçã', 'banana', 'uva'])).toBe('text')
    })

    it('coluna sem células preenchidas é text', () => {
      expect(inferColumnType(['', null, undefined])).toBe('text')
    })
  })

  describe('stats-general', () => {
    it('nulos/únicos/duplicados/preenchido corretos em dataset fixo', () => {
      // Preenchidos: A, B, A, C, B → 5; vazios: '' e null → 2.
      // Distintos preenchidos: {A, B, C} → 3; duplicados: 5 - 3 = 2.
      const values = ['A', 'B', 'A', 'C', '', null, 'B']

      const stats = computeColumnStats(values)

      expect(stats.nulls).toBe(2)
      expect(stats.filled).toBe(5)
      expect(stats.unique).toBe(3)
      expect(stats.duplicates).toBe(2)
    })

    it('vazio/null/string vazia contam como nulo (regra de célula)', () => {
      const stats = computeColumnStats(['x', '', null, undefined, '   '])
      expect(stats.nulls).toBe(4)
      expect(stats.filled).toBe(1)
    })
  })

  describe('stats-numeric', () => {
    it('min/max/média corretos para coluna numérica', () => {
      const stats = computeColumnStats(['10', '20', '30'])

      expect(stats.type).toBe('number')
      expect(stats.numeric).toBeDefined()
      expect(stats.numeric?.min).toBe(10)
      expect(stats.numeric?.max).toBe(30)
      expect(stats.numeric?.mean).toBeCloseTo(20)
    })

    it('não calcula métricas numéricas para colunas não-numéricas', () => {
      const text = computeColumnStats(['a', 'b', 'c'])
      expect(text.type).toBe('text')
      expect(text.numeric).toBeUndefined()

      const dates = computeColumnStats(['2020-01-01', '2021-01-01'])
      expect(dates.type).toBe('date')
      expect(dates.numeric).toBeUndefined()
    })
  })

  describe('stats-numeric-sum-median-kind', () => {
    it('soma e mediana para contagem par', () => {
      const stats = computeColumnStats(['1', '2', '3', '4'])
      expect(stats.numeric?.sum).toBe(10)
      expect(stats.numeric?.median).toBe(2.5)
    })

    it('soma e mediana para contagem ímpar (independe da ordem)', () => {
      const stats = computeColumnStats(['5', '1', '3'])
      expect(stats.numeric?.sum).toBe(9)
      expect(stats.numeric?.median).toBe(3)
    })

    it('numericKind distingue inteiro de decimal na coluna', () => {
      expect(computeColumnStats(['1', '2', '-3']).numeric?.numericKind).toBe(
        'integer',
      )
      expect(computeColumnStats(['1', '2.5', '3']).numeric?.numericKind).toBe(
        'decimal',
      )
      // "1.0"/"5.00"/"2e3" são inteiros por valor.
      expect(
        computeColumnStats(['1.0', '5.00', '2e3']).numeric?.numericKind,
      ).toBe('integer')
    })

    it('min/max/média/histograma permanecem idênticos após a extensão', () => {
      const stats = computeColumnStats(['10', '20', '30'])
      expect(stats.numeric?.min).toBe(10)
      expect(stats.numeric?.max).toBe(30)
      expect(stats.numeric?.mean).toBeCloseTo(20)
      expect(stats.numeric?.histogram).toEqual(buildHistogram([10, 20, 30]))
    })
  })

  describe('stats-numeric-skip-null', () => {
    it('min/max/média ignoram células nulas', () => {
      const stats = computeColumnStats(['10', '', '20', null, undefined, '30'])

      expect(stats.type).toBe('number')
      expect(stats.nulls).toBe(3)
      expect(stats.filled).toBe(3)
      expect(stats.numeric?.min).toBe(10)
      expect(stats.numeric?.max).toBe(30)
      expect(stats.numeric?.mean).toBeCloseTo(20)
    })
  })

  describe('stats-histogram-sum', () => {
    it('a soma das contagens dos bins é igual ao total de valores não-nulos', () => {
      const values = ['1', '', '2', '3', null, '4', '5', '6', '7', '8', '9', '10']
      const stats = computeColumnStats(values)

      expect(stats.type).toBe('number')
      const histogram = stats.numeric?.histogram ?? []
      const total = histogram.reduce((sum, bin) => sum + bin.count, 0)
      expect(total).toBe(stats.filled)
      expect(total).toBe(10)
    })

    it('valores idênticos produzem um único bin com todas as contagens', () => {
      const histogram = buildHistogram([5, 5, 5, 5])
      expect(histogram).toHaveLength(1)
      expect(histogram[0]?.count).toBe(4)
    })
  })

  describe('stats-histogram-bins', () => {
    it('o número de bins é determinístico para o mesmo input', () => {
      const values = Array.from({ length: 32 }, (_, i) => i + 1)

      const a = buildHistogram(values)
      const b = buildHistogram(values)

      expect(a.length).toBe(b.length)
      expect(a.length).toBe(histogramBinCount(values.length))
      // Sturges: ceil(log2(32)) + 1 = 5 + 1 = 6.
      expect(a.length).toBe(6)
    })

    it('a regra de bins segue Sturges e nunca é menor que 1', () => {
      expect(histogramBinCount(0)).toBe(1)
      expect(histogramBinCount(1)).toBe(1)
      expect(histogramBinCount(8)).toBe(4) // ceil(log2(8)) + 1 = 3 + 1
    })
  })

  describe('computeDatasetStats', () => {
    it('calcula as estatísticas de todas as colunas na ordem do cabeçalho', () => {
      const dataset = {
        header: ['id', 'name', 'joined'],
        rows: [
          ['1', 'Ana', '2020-01-01'],
          ['2', 'Bruno', '2021-06-15'],
          ['3', '', '2022-12-31'],
        ],
      }

      const [id, name, joined] = computeDatasetStats(dataset)

      expect(id?.type).toBe('number')
      expect(name?.type).toBe('text')
      expect(name?.nulls).toBe(1)
      expect(joined?.type).toBe('date')
    })

    it('preenche com vazio colunas ausentes em linhas mais curtas', () => {
      const dataset = {
        header: ['a', 'b'],
        rows: [['1', '2'], ['3']],
      }

      const [, b] = computeDatasetStats(dataset)
      expect(b?.nulls).toBe(1)
      expect(b?.filled).toBe(1)
    })
  })
})
