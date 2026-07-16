import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateXlsx, MAX_XLSX_ROWS } from '~/services/exportXlsx'

/**
 * Stub leve de `xlsx` para os testes de truncamento: evita que a lib real
 * processe 1M+ linhas de verdade (custo perceptível, ver PLAN T02), mantendo
 * a lógica de truncamento sob teste em `generateXlsx` (nossa, não da lib).
 */
function mockXlsxModule() {
  vi.doMock('xlsx', () => ({
    utils: {
      aoa_to_sheet: (aoa: unknown[][]) => ({ __aoa: aoa }),
      book_new: () => ({ SheetNames: [] as string[], Sheets: {} as Record<string, unknown> }),
      book_append_sheet: (
        workbook: { SheetNames: string[]; Sheets: Record<string, unknown> },
        sheet: unknown,
        name: string,
      ) => {
        workbook.SheetNames.push(name)
        workbook.Sheets[name] = sheet
      },
    },
    write: () => new ArrayBuffer(8),
  }))
}

/** Lê de volta o buffer gerado como matriz de células (linha 0 = primeira linha da planilha). */
async function readBackAsMatrix(buffer: ArrayBuffer): Promise<unknown[][]> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]!
  const sheet = workbook.Sheets[sheetName]!
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
}

describe('generateXlsx', () => {
  const header = ['name', 'city']
  const rows = [
    ['Ana', 'São Paulo'],
    ['Bob', ''],
  ]

  it('gera uma planilha única com a linha 1 = cabeçalho quando includeHeader é true', async () => {
    const result = await generateXlsx(header, rows, { includeHeader: true })
    const matrix = await readBackAsMatrix(result.buffer)

    expect(matrix[0]).toEqual(['name', 'city'])
    expect(matrix[1]).toEqual(['Ana', 'São Paulo'])
    expect(result.truncated).toBe(false)
  })

  it('a linha 1 já é a primeira linha de dados quando includeHeader é false', async () => {
    const result = await generateXlsx(header, rows, { includeHeader: false })
    const matrix = await readBackAsMatrix(result.buffer)

    expect(matrix[0]).toEqual(['Ana', 'São Paulo'])
  })

  it('célula vazia é escrita como célula vazia, sem o placeholder —', async () => {
    const result = await generateXlsx(header, rows, { includeHeader: true })
    const matrix = await readBackAsMatrix(result.buffer)

    expect(matrix[2]).toEqual(['Bob', ''])
    const flat = matrix.flat().map(String)
    expect(flat.some((cell) => cell.includes('—'))).toBe(false)
  })

  it('dentro do limite, truncated é false e nenhuma linha é descartada', async () => {
    const result = await generateXlsx(header, rows, { includeHeader: true })
    expect(result.truncated).toBe(false)
    expect(result.rowCount).toBe(rows.length + 1)
  })

  describe('truncamento (RF-18, xlsx mockada — ver PLAN T02)', () => {
    afterEach(() => {
      vi.doUnmock('xlsx')
      vi.resetModules()
    })

    it('acima do limite, trunca em exatamente 1.048.576 linhas (dados + cabeçalho) e marca truncated', async () => {
      mockXlsxModule()
      const { generateXlsx: mockedGenerateXlsx } = await import('~/services/exportXlsx')

      const bigRows: string[][] = Array(MAX_XLSX_ROWS + 5).fill(['x', 'y'])
      const result = await mockedGenerateXlsx(header, bigRows, { includeHeader: true })

      expect(result.truncated).toBe(true)
      expect(result.rowCount).toBe(MAX_XLSX_ROWS)
    })

    it('acima do limite sem cabeçalho, trunca os dados em exatamente 1.048.576 linhas', async () => {
      mockXlsxModule()
      const { generateXlsx: mockedGenerateXlsx } = await import('~/services/exportXlsx')

      const bigRows: string[][] = Array(MAX_XLSX_ROWS + 5).fill(['x', 'y'])
      const result = await mockedGenerateXlsx(header, bigRows, { includeHeader: false })

      expect(result.truncated).toBe(true)
      expect(result.rowCount).toBe(MAX_XLSX_ROWS)
    })

    it('exatamente no limite (com cabeçalho) não trunca e nenhuma linha é descartada', async () => {
      mockXlsxModule()
      const { generateXlsx: mockedGenerateXlsx } = await import('~/services/exportXlsx')

      const exactRows: string[][] = Array(MAX_XLSX_ROWS - 1).fill(['x', 'y'])
      const result = await mockedGenerateXlsx(header, exactRows, { includeHeader: true })

      expect(result.truncated).toBe(false)
      expect(result.rowCount).toBe(MAX_XLSX_ROWS)
    })
  })
})
