import { describe, expect, it } from 'vitest'
import {
  commonKeyColumns,
  diffDatasets,
  diffRecord,
  pairByKey,
  pairByPosition,
  valuesEqual,
  type DiffDataset,
} from '~/services/diffDatasets'

describe('commonKeyColumns', () => {
  it('retorna os nomes comuns aos dois cabeçalhos, na ordem de A', () => {
    expect(commonKeyColumns(['id', 'name', 'amount'], ['amount', 'id', 'extra'])).toEqual([
      'id',
      'amount',
    ])
  })

  it('retorna lista vazia quando não há interseção', () => {
    expect(commonKeyColumns(['id', 'name'], ['x', 'y'])).toEqual([])
  })
})

describe('pairByKey', () => {
  it('pareia registros com a mesma chave, independentemente da posição', () => {
    const a: DiffDataset = {
      header: ['id', 'name'],
      rows: [
        ['1', 'Ana'],
        ['2', 'Bruno'],
      ],
    }
    const b: DiffDataset = {
      header: ['id', 'name'],
      rows: [
        ['2', 'Bruno B'],
        ['1', 'Ana B'],
      ],
    }

    const pairs = pairByKey(a, b, 'id')
    expect(pairs).toHaveLength(2)
    const pairForA0 = pairs.find((p) => p.indexA === 0)
    expect(pairForA0).toEqual({ indexA: 0, indexB: 1 })
    const pairForA1 = pairs.find((p) => p.indexA === 1)
    expect(pairForA1).toEqual({ indexA: 1, indexB: 0 })
  })

  it('chave só em A vira registro sem par em B (indexB null)', () => {
    const a: DiffDataset = { header: ['id'], rows: [['1'], ['2']] }
    const b: DiffDataset = { header: ['id'], rows: [['1']] }

    const pairs = pairByKey(a, b, 'id')
    expect(pairs).toContainEqual({ indexA: 0, indexB: 0 })
    expect(pairs).toContainEqual({ indexA: 1, indexB: null })
    expect(pairs).toHaveLength(2)
  })

  it('chave só em B vira registro sem par em A (indexA null)', () => {
    const a: DiffDataset = { header: ['id'], rows: [['1']] }
    const b: DiffDataset = { header: ['id'], rows: [['1'], ['2']] }

    const pairs = pairByKey(a, b, 'id')
    expect(pairs).toContainEqual({ indexA: 0, indexB: 0 })
    expect(pairs).toContainEqual({ indexA: null, indexB: 1 })
    expect(pairs).toHaveLength(2)
  })

  it('chave duplicada dentro do mesmo dataset: a última ocorrência vence (last-write-wins)', () => {
    const a: DiffDataset = {
      header: ['id', 'name'],
      rows: [
        ['1', 'primeiro'],
        ['1', 'segundo'],
      ],
    }
    const b: DiffDataset = { header: ['id', 'name'], rows: [['1', 'b']] }

    const pairs = pairByKey(a, b, 'id')
    expect(pairs).toEqual([{ indexA: 1, indexB: 0 }])
  })

  it('nenhum registro é pareado com mais de um do outro lado (chave presente só de um lado)', () => {
    const a: DiffDataset = { header: ['id'], rows: [['1'], ['2'], ['3']] }
    const b: DiffDataset = { header: ['id'], rows: [['2'], ['4']] }

    const pairs = pairByKey(a, b, 'id')
    expect(pairs).toContainEqual({ indexA: 0, indexB: null }) // 1 só em A
    expect(pairs).toContainEqual({ indexA: 1, indexB: 0 }) // 2 em ambos
    expect(pairs).toContainEqual({ indexA: 2, indexB: null }) // 3 só em A
    expect(pairs).toContainEqual({ indexA: null, indexB: 1 }) // 4 só em B
    expect(pairs).toHaveLength(4)
  })
})

describe('pairByPosition', () => {
  it('pareia linha N de A com linha N de B quando os dois têm o mesmo tamanho', () => {
    const a: DiffDataset = { header: ['id'], rows: [['1'], ['2']] }
    const b: DiffDataset = { header: ['id'], rows: [['x'], ['y']] }

    expect(pairByPosition(a, b)).toEqual([
      { indexA: 0, indexB: 0 },
      { indexA: 1, indexB: 1 },
    ])
  })

  it('A mais longo que B: linhas extras de A viram removed (indexB null)', () => {
    const a: DiffDataset = { header: ['id'], rows: [['1'], ['2'], ['3']] }
    const b: DiffDataset = { header: ['id'], rows: [['x']] }

    expect(pairByPosition(a, b)).toEqual([
      { indexA: 0, indexB: 0 },
      { indexA: 1, indexB: null },
      { indexA: 2, indexB: null },
    ])
  })

  it('B mais longo que A: linhas extras de B viram added (indexA null)', () => {
    const a: DiffDataset = { header: ['id'], rows: [['1']] }
    const b: DiffDataset = { header: ['id'], rows: [['x'], ['y'], ['z']] }

    expect(pairByPosition(a, b)).toEqual([
      { indexA: 0, indexB: 0 },
      { indexA: null, indexB: 1 },
      { indexA: null, indexB: 2 },
    ])
  })
})

describe('valuesEqual', () => {
  it('number: "10" e "10.0" são equivalentes', () => {
    expect(valuesEqual('number', '10', '10.0')).toBe(true)
  })

  it('number: valores numéricos diferentes não são equivalentes', () => {
    expect(valuesEqual('number', '10', '11')).toBe(false)
  })

  it('date: formatos distintos equivalentes retornam true', () => {
    expect(valuesEqual('date', '2026-01-04', '04/01/2026')).toBe(true)
  })

  it('date: datas diferentes retornam false', () => {
    expect(valuesEqual('date', '2026-01-04', '2026-01-05')).toBe(false)
  })

  it('text: qualquer diferença de caractere retorna false', () => {
    expect(valuesEqual('text', 'abc', 'abd')).toBe(false)
  })

  it('text: strings idênticas retornam true', () => {
    expect(valuesEqual('text', 'abc', 'abc')).toBe(true)
  })
})

describe('diffRecord', () => {
  it('marca como changed apenas as colunas cujo valor diverge', () => {
    const rowA = ['1', 'Ana', '100']
    const rowB = ['1', 'Ana', '200']
    const commonColumns = [
      { name: 'id', indexA: 0, indexB: 0 },
      { name: 'name', indexA: 1, indexB: 1 },
      { name: 'amount', indexA: 2, indexB: 2 },
    ]

    const result = diffRecord(rowA, rowB, commonColumns, () => 'text')
    expect(result.status).toBe('changed')
    expect(result.diffColumns).toEqual(['amount'])
  })

  it('marca como unchanged quando todas as colunas comuns são equivalentes', () => {
    const rowA = ['1', 'Ana']
    const rowB = ['1', 'Ana']
    const commonColumns = [
      { name: 'id', indexA: 0, indexB: 0 },
      { name: 'name', indexA: 1, indexB: 1 },
    ]

    const result = diffRecord(rowA, rowB, commonColumns, () => 'text')
    expect(result.status).toBe('unchanged')
    expect(result.diffColumns).toEqual([])
  })
})

describe('diffDatasets', () => {
  it('fim a fim: a soma das contagens é igual ao total de registros pareados, sem sobreposição', () => {
    const a: DiffDataset = {
      header: ['id', 'status', 'amount'],
      rows: [
        ['1', 'settled', '100'], // unchanged
        ['2', 'failed', '250'], // changed (amount diverge)
        ['3', 'failed', '-50'], // removed (só em A)
      ],
    }
    const b: DiffDataset = {
      header: ['id', 'status', 'amount'],
      rows: [
        ['1', 'settled', '100.0'], // unchanged (equivalência numérica)
        ['2', 'failed', '999'], // changed
        ['4', 'settled', '10'], // added (só em B)
      ],
    }

    const result = diffDatasets(a, b, { keyColumn: 'id' })
    const total = result.counts.added + result.counts.removed + result.counts.changed + result.counts.unchanged
    expect(total).toBe(result.records.length)
    expect(result.records).toHaveLength(4)

    expect(result.counts).toEqual({ added: 1, removed: 1, changed: 1, unchanged: 1 })

    // nenhum registro classificado em mais de uma categoria (cada um tem exatamente 1 status)
    const statuses = new Set(result.records.map((r) => r.status))
    for (const record of result.records) {
      expect(statuses.has(record.status)).toBe(true)
    }

    const added = result.records.find((r) => r.status === 'added')!
    expect(added.rowB).toEqual(['4', 'settled', '10'])
    expect(added.rowA).toBeNull()

    const removed = result.records.find((r) => r.status === 'removed')!
    expect(removed.rowA).toEqual(['3', 'failed', '-50'])
    expect(removed.rowB).toBeNull()

    const changed = result.records.find((r) => r.status === 'changed')!
    expect(changed.diffColumns).toEqual(['amount'])
  })

  it('sem keyColumn (ou não resolvida), cai para pareamento posicional (RF-05)', () => {
    const a: DiffDataset = { header: ['id', 'name'], rows: [['1', 'Ana'], ['2', 'Bruno']] }
    const b: DiffDataset = { header: ['id', 'name'], rows: [['1', 'Ana']] }

    const result = diffDatasets(a, b)
    expect(result.records).toHaveLength(2)
    expect(result.records.find((r) => r.indexA === 1)?.status).toBe('removed')
  })

  it('coluna numérica com formatação distinta não é classificada como changed (RF-06)', () => {
    const a: DiffDataset = { header: ['id', 'amount'], rows: [['1', '10']] }
    const b: DiffDataset = { header: ['id', 'amount'], rows: [['1', '10.0']] }

    const result = diffDatasets(a, b, { keyColumn: 'id' })
    expect(result.records[0]!.status).toBe('unchanged')
  })

  it('coluna de texto que difere em qualquer caractere é classificada como changed', () => {
    const a: DiffDataset = { header: ['id', 'name'], rows: [['1', 'Ana']] }
    const b: DiffDataset = { header: ['id', 'name'], rows: [['1', 'Anaa']] }

    const result = diffDatasets(a, b, { keyColumn: 'id' })
    expect(result.records[0]!.status).toBe('changed')
    expect(result.records[0]!.diffColumns).toEqual(['name'])
  })
})
