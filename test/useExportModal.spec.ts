import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useExportModal, type ExportFormat } from '~/composables/useExportModal'
import type { ViewerColumn } from '~/composables/useViewer'
import { MAX_XLSX_ROWS } from '~/services/exportXlsx'

/** Cria uma `ViewerColumn` mínima para os fixtures dos testes. */
function makeColumn(
  index: number,
  label: string,
  overrides: Partial<ViewerColumn> = {},
): ViewerColumn {
  return {
    index,
    label,
    type: 'text',
    visible: true,
    pinned: false,
    width: 180,
    ...overrides,
  }
}

/**
 * Dataset com 3 colunas originais (`id`, `name`, `city`) onde `name` está
 * oculta e `city`/`id` foram fixada + reordenada — `displayColumns` reflete
 * essa ordem final (RF-08), não a ordem original do header.
 */
function makeDisplayColumns(): ViewerColumn[] {
  return [makeColumn(2, 'city', { pinned: true }), makeColumn(0, 'id')]
}

function makeRows(): string[][] {
  return [
    ['1', 'Ana', 'São Paulo'],
    ['2', 'Bruno', 'Rio'],
  ]
}

let capturedBlob: Blob | null = null
let capturedFilename: string | null = null

beforeEach(() => {
  capturedBlob = null
  capturedFilename = null
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob) => {
    capturedBlob = blob
    return 'blob:mock-url'
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    capturedFilename = this.download
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useExportModal', () => {
  describe('RF-01 — estado inicial (defaults)', () => {
    it('expõe os defaults csv/filtered/true/false ao ser criado', () => {
      const modal = useExportModal({
        filteredRows: () => makeRows(),
        allRows: () => makeRows(),
        displayColumns: () => makeDisplayColumns(),
        fileName: () => 'transactions.csv',
      })

      expect(modal.format.value).toBe('csv')
      expect(modal.scope.value).toBe('filtered')
      expect(modal.includeHeader.value).toBe(true)
      expect(modal.quoteAll.value).toBe(false)
    })
  })

  describe('RF-02 a RF-06 — optionsEnabled por formato', () => {
    const cases: Array<[ExportFormat, { includeHeader: boolean; quoteAll: boolean }]> = [
      ['csv', { includeHeader: true, quoteAll: true }],
      ['xlsx', { includeHeader: true, quoteAll: false }],
      ['json', { includeHeader: false, quoteAll: false }],
      ['md', { includeHeader: false, quoteAll: false }],
      ['sql', { includeHeader: true, quoteAll: false }],
    ]

    it.each(cases)('formato %s habilita %o', (format, expected) => {
      const modal = useExportModal({
        filteredRows: () => makeRows(),
        allRows: () => makeRows(),
        displayColumns: () => makeDisplayColumns(),
        fileName: () => 'file.csv',
      })

      modal.format.value = format
      expect(modal.optionsEnabled.value).toEqual(expected)
    })

    it('alternar o formato atualiza optionsEnabled/downloadLabel imediatamente', () => {
      const modal = useExportModal({
        filteredRows: () => makeRows(),
        allRows: () => makeRows(),
        displayColumns: () => makeDisplayColumns(),
        fileName: () => 'file.csv',
      })

      modal.format.value = 'json'
      expect(modal.optionsEnabled.value).toEqual({ includeHeader: false, quoteAll: false })
      expect(modal.downloadLabel.value).toBe('Baixar JSON')

      modal.format.value = 'sql'
      expect(modal.optionsEnabled.value).toEqual({ includeHeader: true, quoteAll: false })
      expect(modal.downloadLabel.value).toBe('Baixar SQL')
    })
  })

  describe('RF-07 — rowsForScope reflete o escopo escolhido', () => {
    it('usa filteredRows quando scope é "filtered"', () => {
      const filtered = [['1', 'Ana', 'São Paulo']]
      const all = makeRows()
      const modal = useExportModal({
        filteredRows: () => filtered,
        allRows: () => all,
        displayColumns: () => makeDisplayColumns(),
        fileName: () => 'file.csv',
      })

      expect(modal.rowsForScope.value).toBe(filtered)
    })

    it('usa dataset.rows (allRows) quando scope é "all", ignorando busca/filtros', () => {
      const filtered = [['1', 'Ana', 'São Paulo']]
      const all = makeRows()
      const modal = useExportModal({
        filteredRows: () => filtered,
        allRows: () => all,
        displayColumns: () => makeDisplayColumns(),
        fileName: () => 'file.csv',
      })

      modal.scope.value = 'all'
      expect(modal.rowsForScope.value).toBe(all)
    })

    it('nunca usa sortedRows — apenas os getters filteredRows/allRows fornecidos', () => {
      const filtered = makeRows()
      const modal = useExportModal({
        filteredRows: () => filtered,
        allRows: () => filtered,
        displayColumns: () => makeDisplayColumns(),
        fileName: () => 'file.csv',
      })

      expect(modal.rowsForScope.value).toBe(filtered)
    })
  })

  describe('RF-08 — projeção via displayColumns (colunas ocultas/fixadas/reordenadas)', () => {
    it('download() nunca inclui índices fora de displayColumns.value e respeita a ordem final', async () => {
      const modal = useExportModal({
        filteredRows: () => makeRows(),
        allRows: () => makeRows(),
        displayColumns: () => makeDisplayColumns(),
        fileName: () => 'transactions.csv',
      })

      await modal.download()

      const text = await capturedBlob!.text()
      const firstLine = text.split('\r\n')[0]
      expect(firstLine).toBe('city,id')
      expect(text).not.toContain('name')
      expect(text).not.toContain('Ana')
      expect(text).toContain('São Paulo,1')
    })
  })

  describe('RF-14 — nome de tabela SQL derivado de fileName', () => {
    it('deriva o nome de tabela sanitizado a partir de fileName no INSERT INTO', async () => {
      const modal = useExportModal({
        filteredRows: () => makeRows(),
        allRows: () => makeRows(),
        displayColumns: () => makeDisplayColumns(),
        fileName: () => 'transactions 2026.csv',
      })

      modal.format.value = 'sql'
      await modal.download()

      const text = await capturedBlob!.text()
      expect(text).toContain('INSERT INTO transactions_2026 (city, id)')
    })
  })

  describe('RF-15 / CT-02 — download nomeado e MIME fixo por formato', () => {
    const cases: Array<[ExportFormat, string, string]> = [
      ['csv', 'transactions.csv', 'text/csv'],
      ['json', 'transactions.json', 'application/json'],
      [
        'xlsx',
        'transactions.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      ['md', 'transactions.md', 'text/markdown'],
      ['sql', 'transactions.sql', 'text/plain'],
    ]

    it.each(cases)('formato %s baixa "%s" com MIME "%s"', async (format, expectedName, expectedMime) => {
      const modal = useExportModal({
        filteredRows: () => makeRows(),
        allRows: () => makeRows(),
        displayColumns: () => makeDisplayColumns(),
        fileName: () => 'transactions.csv',
      })

      modal.format.value = format
      await modal.download()

      expect(capturedFilename).toBe(expectedName)
      expect(capturedBlob!.type).toBe(expectedMime)
    })

    it('nenhuma chamada de rede é disparada durante download()', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      const modal = useExportModal({
        filteredRows: () => makeRows(),
        allRows: () => makeRows(),
        displayColumns: () => makeDisplayColumns(),
        fileName: () => 'transactions.csv',
      })

      await modal.download()

      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  describe('RF-16 — resetSelection() restaura os defaults', () => {
    it('volta format/scope/includeHeader/quoteAll aos defaults após alterações', () => {
      const modal = useExportModal({
        filteredRows: () => makeRows(),
        allRows: () => makeRows(),
        displayColumns: () => makeDisplayColumns(),
        fileName: () => 'file.csv',
      })

      modal.format.value = 'sql'
      modal.scope.value = 'all'
      modal.includeHeader.value = false
      modal.quoteAll.value = true

      modal.resetSelection()

      expect(modal.format.value).toBe('csv')
      expect(modal.scope.value).toBe('filtered')
      expect(modal.includeHeader.value).toBe(true)
      expect(modal.quoteAll.value).toBe(false)
    })

    it('também limpa um xlsxWarning pendente', () => {
      const modal = useExportModal({
        filteredRows: () => makeRows(),
        allRows: () => makeRows(),
        displayColumns: () => makeDisplayColumns(),
        fileName: () => 'file.csv',
      })

      modal.xlsxWarning.value = 'aviso pendente'
      modal.resetSelection()

      expect(modal.xlsxWarning.value).toBeNull()
    })
  })

  describe('UI-02 — scopeCounts', () => {
    it('reflete o tamanho de filteredRows e allRows em tempo real', () => {
      const filtered = [['1', 'Ana', 'São Paulo']]
      const all = makeRows()
      const modal = useExportModal({
        filteredRows: () => filtered,
        allRows: () => all,
        displayColumns: () => makeDisplayColumns(),
        fileName: () => 'file.csv',
      })

      expect(modal.scopeCounts.value).toEqual({ filtered: 1, all: 2 })
    })
  })

  describe('UI-05 — downloadLabel', () => {
    it.each([
      ['csv', 'Baixar CSV'],
      ['json', 'Baixar JSON'],
      ['xlsx', 'Baixar XLSX'],
      ['md', 'Baixar MD'],
      ['sql', 'Baixar SQL'],
    ] as Array<[ExportFormat, string]>)('formato %s → "%s"', (format, expected) => {
      const modal = useExportModal({
        filteredRows: () => makeRows(),
        allRows: () => makeRows(),
        displayColumns: () => makeDisplayColumns(),
        fileName: () => 'file.csv',
      })

      modal.format.value = format
      expect(modal.downloadLabel.value).toBe(expected)
    })
  })

  describe('RF-18 — xlsxWarning em escopo acima do limite do Excel', () => {
    afterEach(() => {
      vi.doUnmock('xlsx')
      vi.resetModules()
    })

    it('download() em XLSX com escopo > 1.048.576 linhas define xlsxWarning com mensagem não vazia', async () => {
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

      const { useExportModal: freshUseExportModal } = await import('~/composables/useExportModal')
      const bigRows: string[][] = Array(MAX_XLSX_ROWS + 5).fill(['x', 'y'])

      const modal = freshUseExportModal({
        filteredRows: () => bigRows,
        allRows: () => bigRows,
        displayColumns: () => [makeColumn(0, 'x'), makeColumn(1, 'y')],
        fileName: () => 'big.csv',
      })
      modal.format.value = 'xlsx'

      await modal.download()

      expect(modal.xlsxWarning.value).toBeTruthy()
      expect(modal.xlsxWarning.value).not.toBe('')
    })

    it('dentro do limite, nenhum aviso é definido e nenhuma linha é descartada', async () => {
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

      const { useExportModal: freshUseExportModal } = await import('~/composables/useExportModal')

      const modal = freshUseExportModal({
        filteredRows: () => makeRows(),
        allRows: () => makeRows(),
        displayColumns: () => makeDisplayColumns(),
        fileName: () => 'file.csv',
      })
      modal.format.value = 'xlsx'

      await modal.download()

      expect(modal.xlsxWarning.value).toBeNull()
    })
  })
})
