import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDatabase } from '~/composables/useDatabase'
import { useFilesStore, type NewFile } from '~/composables/useFilesStore'
import { useCurrentDataset, type DatasetMeta } from '~/composables/useCurrentDataset'
import { useOpenFile } from '~/composables/useOpenFile'
import {
  useComparisonDatasets,
  MAX_COMPARISON_SIZE_BYTES,
  MAX_COMPARISON_ROWS,
  type ComparisonParser,
} from '~/composables/useComparisonDatasets'
import { CsvParseError, type ParseResult } from '~/services/csvParser'

/**
 * Parser determinístico: parseia CSV simples de vírgula, sinaliza arquivo
 * vazio com {@link CsvParseError}, e permite forçar `row_count` via um
 * cabeçalho especial `__rows=<n>` (usado para simular RNF-01 sem gerar 1M
 * linhas reais no teste).
 */
const parser: ComparisonParser = {
  async parseText(content, _fileName, options): Promise<ParseResult> {
    if (content.trim() === '') {
      throw new CsvParseError('O arquivo está vazio.')
    }
    const [headerLine, ...rest] = content.split('\n').filter((l) => l !== '')
    const header = headerLine!.split(',')
    const rows = rest.map((line) => line.split(','))
    options?.onProgress?.(1)

    const forcedRowsHeader = header.find((h) => h.startsWith('__rows='))
    const rowCount = forcedRowsHeader
      ? Number(forcedRowsHeader.split('=')[1])
      : rows.length

    return {
      header,
      rows,
      row_count: rowCount,
      column_count: header.length,
      delimiter: 'comma',
    }
  },
}

function makeStored(overrides: Partial<NewFile> = {}): NewFile {
  return {
    name: 'people-b.csv',
    delimiter: 'comma',
    size_bytes: 20,
    row_count: 2,
    column_count: 2,
    content: 'id,name\n1,Zoe\n2,Yan',
    created_at: 1_000,
    last_opened_at: 1_000,
    ...overrides,
  }
}

function loadDatasetA(overrides: Partial<DatasetMeta> = {}): void {
  useCurrentDataset().setDataset(
    { header: ['id', 'name'], rows: [['1', 'Ana'], ['2', 'Bruno']] },
    {
      id: overrides.id ?? 1,
      name: 'people-a.csv',
      delimiter: 'comma',
      sizeBytes: 42,
      rowCount: 2,
      columnCount: 2,
      ...overrides,
    },
  )
}

describe('useComparisonDatasets', () => {
  beforeEach(async () => {
    await deleteDatabase()
    useCurrentDataset().clearDataset()
    useComparisonDatasets().clearComparison()
  })

  afterEach(async () => {
    await deleteDatabase()
  })

  describe('RF-01: dataset A permanece intacto', () => {
    it('carregar B não altera dataset/meta de A', async () => {
      loadDatasetA()
      const { dataset: datasetABefore, meta: metaABefore } = useCurrentDataset()
      const rowCountBefore = datasetABefore.value?.rows.length
      const columnCountBefore = datasetABefore.value?.header.length
      const contentBefore = JSON.stringify(datasetABefore.value)

      const { openFileB } = useComparisonDatasets({ parser })
      const file = new File(['id,name\n1,Zoe\n2,Yan'], 'people-b.csv')
      const ok = await openFileB(file)
      expect(ok).toBe(true)

      const { dataset: datasetAAfter, meta: metaAAfter } = useCurrentDataset()
      expect(datasetAAfter.value?.rows.length).toBe(rowCountBefore)
      expect(datasetAAfter.value?.header.length).toBe(columnCountBefore)
      expect(JSON.stringify(datasetAAfter.value)).toBe(contentBefore)
      expect(metaAAfter.value?.id).toBe(metaABefore.value?.id)
    })
  })

  describe('não-persistência de B', () => {
    it('openFileB nunca chama saveFile/touchFile do filesStore injetado', async () => {
      loadDatasetA()
      const filesStore = useFilesStore()
      const saveFileSpy = vi.spyOn(filesStore, 'saveFile')
      const touchFileSpy = vi.spyOn(filesStore, 'touchFile')

      const { openFileB } = useComparisonDatasets({ parser, filesStore })
      const file = new File(['id,name\n1,Zoe\n2,Yan'], 'people-b.csv')
      const ok = await openFileB(file)

      expect(ok).toBe(true)
      expect(saveFileSpy).not.toHaveBeenCalled()
      expect(touchFileSpy).not.toHaveBeenCalled()
      expect(await filesStore.listFiles()).toHaveLength(0)
    })

    it('reopenRecentB nunca chama saveFile/touchFile e não altera listFiles/last_opened_at', async () => {
      loadDatasetA()
      const filesStore = useFilesStore()
      const id = await filesStore.saveFile(makeStored({ last_opened_at: 1_000 }))
      const saveFileSpy = vi.spyOn(filesStore, 'saveFile')
      const touchFileSpy = vi.spyOn(filesStore, 'touchFile')

      const { reopenRecentB } = useComparisonDatasets({ parser, filesStore })
      const ok = await reopenRecentB(id)

      expect(ok).toBe(true)
      expect(saveFileSpy).not.toHaveBeenCalled()
      expect(touchFileSpy).not.toHaveBeenCalled()

      const files = await filesStore.listFiles()
      expect(files).toHaveLength(1)
      expect(files[0]?.last_opened_at).toBe(1_000)
    })
  })

  describe('RNF-01: rejeição do teto de tamanho/linhas', () => {
    it('openFileB rejeita arquivo acima do teto de tamanho', async () => {
      loadDatasetA()
      const { openFileB, comparisonError, datasetB } = useComparisonDatasets({ parser })

      const file = new File(['id,name\n1,Zoe'], 'big.csv')
      Object.defineProperty(file, 'size', { value: MAX_COMPARISON_SIZE_BYTES + 1 })

      const ok = await openFileB(file)

      expect(ok).toBe(false)
      expect(comparisonError.value).not.toBeNull()
      expect(datasetB.value).toBeNull()
    })

    it('openFileB rejeita arquivo acima do teto de linhas', async () => {
      loadDatasetA()
      const { openFileB, comparisonError, datasetB } = useComparisonDatasets({ parser })

      const file = new File(
        [`id,name,__rows=${MAX_COMPARISON_ROWS + 1}\n1,Zoe`],
        'many-rows.csv',
      )

      const ok = await openFileB(file)

      expect(ok).toBe(false)
      expect(comparisonError.value).not.toBeNull()
      expect(datasetB.value).toBeNull()
    })

    it('reopenRecentB rejeita registro acima do teto de tamanho', async () => {
      loadDatasetA()
      const filesStore = useFilesStore()
      const id = await filesStore.saveFile(
        makeStored({ size_bytes: MAX_COMPARISON_SIZE_BYTES + 1 }),
      )

      const { reopenRecentB, comparisonError, datasetB } = useComparisonDatasets({
        parser,
        filesStore,
      })
      const ok = await reopenRecentB(id)

      expect(ok).toBe(false)
      expect(comparisonError.value).not.toBeNull()
      expect(datasetB.value).toBeNull()
    })

    it('reopenRecentB rejeita registro acima do teto de linhas', async () => {
      loadDatasetA()
      const filesStore = useFilesStore()
      const id = await filesStore.saveFile(
        makeStored({
          content: `id,name,__rows=${MAX_COMPARISON_ROWS + 1}\n1,Zoe`,
        }),
      )

      const { reopenRecentB, comparisonError, datasetB } = useComparisonDatasets({
        parser,
        filesStore,
      })
      const ok = await reopenRecentB(id)

      expect(ok).toBe(false)
      expect(comparisonError.value).not.toBeNull()
      expect(datasetB.value).toBeNull()
    })
  })

  describe('reset automático ao trocar A', () => {
    it('trocar o id de A limpa datasetB/metaB/keyColumn/comparisonError', async () => {
      loadDatasetA({ id: 1 })
      const { openFileB, keyColumn, datasetB, metaB, comparisonError } =
        useComparisonDatasets({ parser })

      const file = new File(['id,name\n1,Zoe\n2,Yan'], 'people-b.csv')
      await openFileB(file)
      keyColumn.value = 'id'

      expect(datasetB.value).not.toBeNull()

      loadDatasetA({ id: 2 })

      expect(datasetB.value).toBeNull()
      expect(metaB.value).toBeNull()
      expect(keyColumn.value).toBeNull()
      expect(comparisonError.value).toBeNull()
    })
  })

  describe('availableKeyColumns', () => {
    it('reflete a interseção real dos cabeçalhos de A e B', async () => {
      loadDatasetA()
      const { openFileB, availableKeyColumns } = useComparisonDatasets({ parser })

      expect(availableKeyColumns.value).toEqual([])

      const file = new File(['id,extra\n1,x\n2,y'], 'people-b.csv')
      await openFileB(file)

      expect(availableKeyColumns.value).toEqual(['id'])
    })
  })

  // T08 — cenários de integração cross-cutting: atravessam mais de uma task
  // (T02 + fluxo real de T01/useOpenFile), não duplicando os testes unitários
  // já cobertos acima nem em test/diffDatasets.spec.ts.
  describe('T08: integração cross-cutting', () => {
    it('fluxo real fim a fim: A → B (upload) → trocar A por um terceiro arquivo real limpa B automaticamente', async () => {
      // id bem fora da faixa do auto-incremento real de `files` (que começa em
      // 1 a cada banco recém-criado), para garantir que o `id` observado pelo
      // watch realmente muda quando o terceiro arquivo é persistido abaixo.
      loadDatasetA({ id: 999 })

      const { openFileB, datasetB, metaB, keyColumn } = useComparisonDatasets({ parser })
      const fileB = new File(['id,name\n1,Zoe\n2,Yan'], 'people-b.csv')
      expect(await openFileB(fileB)).toBe(true)
      keyColumn.value = 'id'
      expect(datasetB.value).not.toBeNull()
      expect(metaB.value).not.toBeNull()

      // Terceiro arquivo como novo A: fluxo real e não mockado de useOpenFile —
      // mesmo parser (com fallback inline)/filesStore/currentDataset usados na
      // tela de Upload, não o parser determinístico injetado acima para B.
      const { openFile } = useOpenFile()
      const thirdFile = new File(['id,name\n9,Nova'], 'people-c.csv')
      const ok = await openFile(thirdFile)
      expect(ok).toBe(true)

      expect(useCurrentDataset().meta.value?.id).not.toBe(999)
      expect(datasetB.value).toBeNull()
      expect(metaB.value).toBeNull()
      expect(keyColumn.value).toBeNull()
    })

    it('RNF-01: openFileB e reopenRecentB rejeitam o teto com a mesma mensagem de erro', async () => {
      loadDatasetA()
      const filesStore = useFilesStore()
      const id = await filesStore.saveFile(
        makeStored({ size_bytes: MAX_COMPARISON_SIZE_BYTES + 1 }),
      )

      const viaUpload = useComparisonDatasets({ parser, filesStore })
      const bigFile = new File(['id,name\n1,Zoe'], 'big.csv')
      Object.defineProperty(bigFile, 'size', { value: MAX_COMPARISON_SIZE_BYTES + 1 })
      expect(await viaUpload.openFileB(bigFile)).toBe(false)
      const messageFromUpload = viaUpload.comparisonError.value
      expect(messageFromUpload).not.toBeNull()
      viaUpload.clearComparison()

      const viaRecent = useComparisonDatasets({ parser, filesStore })
      expect(await viaRecent.reopenRecentB(id)).toBe(false)
      const messageFromRecent = viaRecent.comparisonError.value

      expect(messageFromRecent).not.toBeNull()
      expect(messageFromRecent).toBe(messageFromUpload)
    })

    it('RF-03 AC fim a fim: soma das quatro contagens bate com o total de registros pareados (fixture conhecida)', async () => {
      useCurrentDataset().setDataset(
        {
          header: ['id', 'amount'],
          rows: [
            ['1', '100'],
            ['2', '200'],
            ['3', '300'],
          ],
        },
        {
          id: 1,
          name: 'a.csv',
          delimiter: 'comma',
          sizeBytes: 10,
          rowCount: 3,
          columnCount: 2,
        },
      )

      // B: id=1 igual (unchanged), id=2 diverge em amount (changed), id=3 só
      // em A (removed), id=4 só em B (added) — categorias conhecidas de antemão.
      const { openFileB, keyColumn, summary, result } = useComparisonDatasets({ parser })
      const file = new File(['id,amount\n1,100\n2,999\n4,400'], 'b.csv')
      expect(await openFileB(file)).toBe(true)
      keyColumn.value = 'id'

      expect(summary.value).toEqual({ added: 1, removed: 1, changed: 1, unchanged: 1 })
      const total =
        summary.value!.added + summary.value!.removed + summary.value!.changed + summary.value!.unchanged
      expect(total).toBe(result.value!.records.length)
    })

    it('não-persistência de B (upload e recente) preserva a contagem e a ordem dos arquivos existentes', async () => {
      loadDatasetA()
      const filesStore = useFilesStore()
      const idOld = await filesStore.saveFile(
        makeStored({ name: 'old.csv', last_opened_at: 1_000 }),
      )
      const idNewer = await filesStore.saveFile(
        makeStored({ name: 'newer.csv', last_opened_at: 2_000 }),
      )

      const beforeList = await filesStore.listFiles()
      expect(beforeList.map((f) => f.id)).toEqual([idNewer, idOld])

      const { openFileB, reopenRecentB } = useComparisonDatasets({ parser, filesStore })

      const uploadFile = new File(['id,name\n1,Zoe'], 'people-b.csv')
      expect(await openFileB(uploadFile)).toBe(true)
      expect(await reopenRecentB(idOld)).toBe(true)

      const afterList = await filesStore.listFiles()
      expect(afterList).toHaveLength(2)
      expect(afterList.map((f) => f.id)).toEqual([idNewer, idOld])
      expect(afterList.find((f) => f.id === idOld)?.last_opened_at).toBe(1_000)
      expect(afterList.find((f) => f.id === idNewer)?.last_opened_at).toBe(2_000)
    })
  })
})
