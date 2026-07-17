import { beforeEach, describe, expect, it } from 'vitest'
import { computed } from 'vue'
import {
  useCurrentDataset,
  type Dataset,
  type DatasetMeta,
} from '~/composables/useCurrentDataset'

function makeDataset(): { dataset: Dataset; meta: DatasetMeta } {
  return {
    dataset: {
      header: ['id', 'name'],
      rows: [
        ['1', 'Ana'],
        ['2', 'Bruno'],
      ],
    },
    meta: {
      name: 'people.csv',
      delimiter: 'comma',
      sizeBytes: 42,
      rowCount: 2,
      columnCount: 2,
    },
  }
}

describe('useCurrentDataset', () => {
  beforeEach(() => {
    // Estado é singleton de módulo: limpa entre os testes.
    useCurrentDataset().clearDataset()
  })

  it('starts empty', () => {
    const { dataset, meta, hasDataset } = useCurrentDataset()
    expect(dataset.value).toBeNull()
    expect(meta.value).toBeNull()
    expect(hasDataset.value).toBe(false)
  })

  it('exposes the dataset and its metadata after setDataset', () => {
    const { setDataset } = useCurrentDataset()
    const { dataset: d, meta: m } = makeDataset()

    setDataset(d, m)

    const { dataset, meta, hasDataset } = useCurrentDataset()
    expect(hasDataset.value).toBe(true)
    expect(dataset.value).toEqual(d)
    expect(meta.value).toEqual(m)
  })

  it('shares state across instances, preserving the dataset without re-parsing', () => {
    // Simula Upload definindo o dataset e o Viewer lendo-o em outra instância.
    const upload = useCurrentDataset()
    const { dataset: d, meta: m } = makeDataset()
    upload.setDataset(d, m)

    const viewer = useCurrentDataset()
    expect(viewer.hasDataset.value).toBe(true)
    expect(viewer.dataset.value).toEqual(d)
    expect(viewer.meta.value?.name).toBe('people.csv')
  })

  it('clears the dataset and its metadata', () => {
    const { setDataset, clearDataset } = useCurrentDataset()
    const { dataset: d, meta: m } = makeDataset()
    setDataset(d, m)

    clearDataset()

    const { dataset, meta, hasDataset } = useCurrentDataset()
    expect(dataset.value).toBeNull()
    expect(meta.value).toBeNull()
    expect(hasDataset.value).toBe(false)
  })

  describe('updateCell', () => {
    it('muta dataset.value.rows[r][c], lida de volta', () => {
      const { setDataset, updateCell, dataset } = useCurrentDataset()
      const { dataset: d, meta: m } = makeDataset()
      setDataset(d, m)

      updateCell(0, 1, 'Alice')

      expect(dataset.value?.rows[0]?.[1]).toBe('Alice')
    })

    it('um computed que lê dataset.value.rows reavalia após updateCell', () => {
      const { setDataset, updateCell, dataset } = useCurrentDataset()
      const { dataset: d, meta: m } = makeDataset()
      setDataset(d, m)

      const firstCell = computed(() => dataset.value?.rows[0]?.[1])
      expect(firstCell.value).toBe('Ana')

      updateCell(0, 1, 'Alice')

      expect(firstCell.value).toBe('Alice')
    })

    it('índices fora dos limites são no-op, sem lançar', () => {
      const { setDataset, updateCell, dataset } = useCurrentDataset()
      const { dataset: d, meta: m } = makeDataset()
      setDataset(d, m)

      expect(() => updateCell(99, 0, 'x')).not.toThrow()
      expect(() => updateCell(0, 99, 'x')).not.toThrow()
      expect(() => updateCell(-1, 0, 'x')).not.toThrow()

      expect(dataset.value).toEqual(d)
    })

    it('sem dataset carregado é no-op, sem lançar', () => {
      const { updateCell, dataset } = useCurrentDataset()

      expect(() => updateCell(0, 0, 'x')).not.toThrow()
      expect(dataset.value).toBeNull()
    })

    it('dataset continua readonly: escrita direta por fora de updateCell não tem efeito', () => {
      const { setDataset, dataset } = useCurrentDataset()
      const { dataset: d, meta: m } = makeDataset()
      setDataset(d, m)

      // Vue emite um warning (não lança) e ignora a escrita num proxy readonly.
      // @ts-expect-error dataset é Readonly<Ref<Dataset>>
      dataset.value.rows[0][0] = 'blocked'

      expect(dataset.value?.rows[0]?.[0]).toBe('1')
    })
  })
})
