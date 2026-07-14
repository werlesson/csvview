import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDatabase } from '~/composables/useDatabase'
import { useFilesStore, type NewFile } from '~/composables/useFilesStore'
import { useCurrentDataset } from '~/composables/useCurrentDataset'
import { useOpenFile, type OpenFileParser } from '~/composables/useOpenFile'
import { CsvParseError, type ParseResult } from '~/services/csvParser'

/**
 * Parser determinístico para o fluxo de abertura: parseia um CSV simples de
 * duas colunas e sinaliza arquivo vazio com {@link CsvParseError} (espelhando
 * o motor real da Fase 4), sem depender de Web Worker.
 */
const parser: OpenFileParser = {
  async parseText(content, _fileName, options): Promise<ParseResult> {
    if (content.trim() === '') {
      throw new CsvParseError('O arquivo está vazio.')
    }
    const [headerLine, ...rest] = content.split('\n').filter((l) => l !== '')
    const header = headerLine!.split(',')
    const rows = rest.map((line) => line.split(','))
    options?.onProgress?.(1)
    return {
      header,
      rows,
      row_count: rows.length,
      column_count: header.length,
      delimiter: 'comma',
    }
  },
}

function makeStored(overrides: Partial<NewFile> = {}): NewFile {
  return {
    name: 'people.csv',
    delimiter: 'comma',
    size_bytes: 20,
    row_count: 2,
    column_count: 2,
    content: 'id,name\n1,Ana\n2,Bruno',
    created_at: 1_000,
    last_opened_at: 1_000,
    ...overrides,
  }
}

describe('useOpenFile', () => {
  beforeEach(async () => {
    await deleteDatabase()
    useCurrentDataset().clearDataset()
  })

  afterEach(async () => {
    await deleteDatabase()
  })

  describe('open-flow-persist', () => {
    it('parseia, persiste em files e carrega o dataset ao abrir', async () => {
      const navigate = vi.fn()
      const { openFile, error } = useOpenFile({ parser, navigate })

      const file = new File(['id,name\n1,Ana\n2,Bruno'], 'people.csv', {
        type: 'text/csv',
      })

      const before = Date.now()
      const ok = await openFile(file)
      expect(ok).toBe(true)
      expect(error.value).toBeNull()

      // Um registro em `files` com os metadados corretos.
      const files = await useFilesStore().listFiles()
      expect(files).toHaveLength(1)
      const stored = files[0]!
      expect(stored.name).toBe('people.csv')
      expect(stored.row_count).toBe(2)
      expect(stored.column_count).toBe(2)
      expect(stored.delimiter).toBe('comma')
      expect(stored.content).toBe('id,name\n1,Ana\n2,Bruno')
      // `last_opened_at` é gravado na abertura.
      expect(stored.last_opened_at).toBeGreaterThanOrEqual(before)

      // Dataset carregado no estado atual + navegação ao Viewer.
      const { dataset, meta } = useCurrentDataset()
      expect(dataset.value?.header).toEqual(['id', 'name'])
      expect(dataset.value?.rows).toHaveLength(2)
      expect(meta.value?.id).toBe(stored.id)
      expect(navigate).toHaveBeenCalledWith('/viewer')
    })
  })

  describe('reopen-recent', () => {
    it('reabre carregando o dataset e atualiza last_opened_at', async () => {
      const id = await useFilesStore().saveFile(
        makeStored({ last_opened_at: 1_000 }),
      )

      const navigate = vi.fn()
      const { reopenRecent, error } = useOpenFile({ parser, navigate })

      const before = Date.now()
      const ok = await reopenRecent(id)
      expect(ok).toBe(true)
      expect(error.value).toBeNull()

      // Dataset carregado a partir do conteúdo persistido, sem novo upload.
      const { dataset, meta } = useCurrentDataset()
      expect(dataset.value?.header).toEqual(['id', 'name'])
      expect(dataset.value?.rows).toEqual([
        ['1', 'Ana'],
        ['2', 'Bruno'],
      ])
      expect(meta.value?.id).toBe(id)
      expect(navigate).toHaveBeenCalledWith('/viewer')

      // LRU touch: `last_opened_at` avançou para agora.
      const stored = await useFilesStore().getFile(id)
      expect(stored?.last_opened_at).toBeGreaterThanOrEqual(before)
      expect(stored?.last_opened_at).toBeGreaterThan(1_000)
    })

    it('reabrir um id inexistente reporta erro sem navegar', async () => {
      const navigate = vi.fn()
      const { reopenRecent, error } = useOpenFile({ parser, navigate })

      const ok = await reopenRecent(999)
      expect(ok).toBe(false)
      expect(error.value).toBe('Arquivo não encontrado.')
      expect(navigate).not.toHaveBeenCalled()
    })
  })

  describe('open-errors', () => {
    it('rejeita tipo não suportado sem persistir nem navegar', async () => {
      const navigate = vi.fn()
      const { openFile, error } = useOpenFile({ parser, navigate })

      const file = new File(['{}'], 'data.json', { type: 'application/json' })
      const ok = await openFile(file)

      expect(ok).toBe(false)
      expect(error.value).toContain('Tipo de arquivo não suportado')
      expect(error.value).toContain('.csv')
      expect(navigate).not.toHaveBeenCalled()
      expect(await useFilesStore().listFiles()).toHaveLength(0)
    })

    it('mostra a mensagem do parser para arquivo vazio', async () => {
      const navigate = vi.fn()
      const { openFile, error } = useOpenFile({ parser, navigate })

      const file = new File([''], 'empty.csv', { type: 'text/csv' })
      const ok = await openFile(file)

      expect(ok).toBe(false)
      expect(error.value).toBe('O arquivo está vazio.')
      expect(navigate).not.toHaveBeenCalled()
      expect(await useFilesStore().listFiles()).toHaveLength(0)
    })

    it('limpa o erro numa abertura bem-sucedida seguinte', async () => {
      const navigate = vi.fn()
      const { openFile, error } = useOpenFile({ parser, navigate })

      await openFile(new File([''], 'empty.csv'))
      expect(error.value).toBe('O arquivo está vazio.')

      await openFile(new File(['id,name\n1,Ana'], 'ok.csv'))
      expect(error.value).toBeNull()
    })
  })
})
