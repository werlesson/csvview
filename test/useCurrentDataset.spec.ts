import { beforeEach, describe, expect, it } from 'vitest'
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
})
