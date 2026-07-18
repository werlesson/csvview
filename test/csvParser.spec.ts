import { describe, expect, it, vi } from 'vitest'
import {
  CsvParseError,
  detectDelimiter,
  orderedColumnIndices,
  parseCsv,
  runParseRequest,
  stringifyDataset,
  type Delimiter,
  type ParseWorkerMessage,
} from '~/services/csvParser'

describe('motor de parsing CSV/TSV', () => {
  describe('parse-basic', () => {
    it('CSV simples vira header + linhas com metadados', async () => {
      const content = 'id,name\n1,Ana\n2,Bruno\n'

      const result = await parseCsv(content, { fileName: 'people.csv' })

      expect(result.header).toEqual(['id', 'name'])
      expect(result.rows).toEqual([
        ['1', 'Ana'],
        ['2', 'Bruno'],
      ])
      expect(result.row_count).toBe(2)
      expect(result.column_count).toBe(2)
      expect(result.delimiter).toBe('comma')
    })

    it('parseia TSV usando tab como delimitador', async () => {
      const content = 'id\tname\n1\tAna\n2\tBruno'

      const result = await parseCsv(content, { fileName: 'people.tsv' })

      expect(result.header).toEqual(['id', 'name'])
      expect(result.rows).toEqual([
        ['1', 'Ana'],
        ['2', 'Bruno'],
      ])
      expect(result.delimiter).toBe('tab')
    })

    it('`.csv` com BOM e delimitador `;` (export pt-BR) vira colunas certas', async () => {
      // Regressão: arquivo real de exportador BR — extensão `.csv`, BOM UTF-8 e
      // `;` como separador. Antes virava uma única coluna com `﻿id` no header.
      const content = '﻿id;nome;placa\n1;Ana;ABC1D23\n2;Bruno;XYZ9K88'

      const result = await parseCsv(content, {
        fileName: 'exportador_estadias.csv',
      })

      expect(result.delimiter).toBe('semicolon')
      expect(result.header).toEqual(['id', 'nome', 'placa'])
      expect(result.column_count).toBe(3)
      expect(result.rows).toEqual([
        ['1', 'Ana', 'ABC1D23'],
        ['2', 'Bruno', 'XYZ9K88'],
      ])
    })
  })

  describe('parse-quoted', () => {
    it('preserva aspas, vírgulas internas e quebras de linha entre aspas', async () => {
      const content =
        'name,note\n"Doe, John","linha1\nlinha2"\n"Simple","x, y, z"\n'

      const result = await parseCsv(content, { fileName: 'notes.csv' })

      expect(result.header).toEqual(['name', 'note'])
      expect(result.rows).toEqual([
        ['Doe, John', 'linha1\nlinha2'],
        ['Simple', 'x, y, z'],
      ])
      expect(result.row_count).toBe(2)
      expect(result.column_count).toBe(2)
    })
  })

  describe('parse-empty', () => {
    it('arquivo de 0 bytes rejeita com CsvParseError', async () => {
      await expect(parseCsv('', { fileName: 'empty.csv' })).rejects.toBeInstanceOf(
        CsvParseError,
      )
    })

    it('arquivo só com espaços/quebras de linha rejeita com CsvParseError', async () => {
      await expect(
        parseCsv('\n  \n\r\n', { fileName: 'blank.csv' }),
      ).rejects.toBeInstanceOf(CsvParseError)
    })
  })

  describe('parse-ragged', () => {
    it('normaliza linhas: faltantes vazias, excedentes preservadas', async () => {
      const content = 'a,b,c\n1,2\n3,4,5,6\n7,8,9\n'

      const result = await parseCsv(content, { fileName: 'ragged.csv' })

      expect(result.header).toEqual(['a', 'b', 'c'])
      expect(result.column_count).toBe(3)
      expect(result.rows).toEqual([
        ['1', '2', ''], // faltante → célula vazia
        ['3', '4', '5', '6'], // excedente → preservada
        ['7', '8', '9'],
      ])
      expect(result.row_count).toBe(3)
    })
  })

  describe('parse-no-header', () => {
    it('sem cabeçalho detectável, a 1ª linha vira header', async () => {
      const content = '1,2,3\n4,5,6\n7,8,9'

      const result = await parseCsv(content, { fileName: 'data.csv' })

      expect(result.header).toEqual(['1', '2', '3'])
      expect(result.rows).toEqual([
        ['4', '5', '6'],
        ['7', '8', '9'],
      ])
      expect(result.row_count).toBe(2)
    })
  })

  describe('parse-large-progress', () => {
    it('reporta progresso em chunks e devolve a contagem de linhas esperada', async () => {
      const dataRows = 20_000
      const lines: string[] = ['id,name,value']
      for (let i = 0; i < dataRows; i += 1) {
        lines.push(`${i},name-${i},${i * 2}`)
      }
      const content = lines.join('\n')

      const onProgress = vi.fn()
      // chunkSize pequeno força múltiplos chunks → progresso incremental.
      const result = await parseCsv(content, {
        fileName: 'big.csv',
        onProgress,
        chunkSize: 4096,
      })

      expect(result.row_count).toBe(dataRows)
      expect(result.column_count).toBe(3)

      // O callback foi chamado (mais de uma vez, dado o chunkSize pequeno).
      expect(onProgress).toHaveBeenCalled()
      expect(onProgress.mock.calls.length).toBeGreaterThan(1)

      // O progresso é monotônico não-decrescente e termina em 1.
      const values = onProgress.mock.calls.map((call) => call[0] as number)
      for (let i = 1; i < values.length; i += 1) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]!)
      }
      for (const value of values) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
      expect(values[values.length - 1]).toBe(1)
    })
  })

  describe('delimiter-by-ext', () => {
    it('.csv → comma e .tsv → tab', () => {
      expect(detectDelimiter('people.csv')).toBe('comma')
      expect(detectDelimiter('people.tsv')).toBe('tab')
    })

    it('a extensão tem prioridade quando o seu delimitador aparece', () => {
      // `.csv` com vírgulas presentes → comma, mesmo havendo `;` em valores.
      expect(detectDelimiter('data.csv', 'a,b;x,c\n1,2,3')).toBe('comma')
    })

    it('`.csv` exportado com `;` (sem vírgulas) → semicolon', () => {
      // Caso real pt-BR: extensão `.csv` mas delimitador `;`. A extensão não
      // pode forçar comma, senão o arquivo vira uma coluna só.
      expect(detectDelimiter('exportador.csv', 'id;nome;placa\n1;Ana;ABC1D23')).toBe(
        'semicolon',
      )
    })
  })

  describe('delimiter-by-content', () => {
    it('conteúdo predominantemente com `;` é detectado como semicolon', () => {
      const content = 'a;b;c\n1;2;3\n4;5;6'
      expect(detectDelimiter('data.txt', content)).toBe('semicolon')
    })

    it('.txt com vírgulas é detectado como comma', () => {
      expect(detectDelimiter('data.txt', 'a,b,c\n1,2,3')).toBe('comma')
    })

    it('.txt com tabs é detectado como tab', () => {
      expect(detectDelimiter('data.txt', 'a\tb\tc\n1\t2\t3')).toBe('tab')
    })

    it('semicolon usado no parse quando detectado por conteúdo', async () => {
      const result = await parseCsv('a;b;c\n1;2;3', { fileName: 'data.txt' })
      expect(result.delimiter).toBe('semicolon')
      expect(result.header).toEqual(['a', 'b', 'c'])
      expect(result.rows).toEqual([['1', '2', '3']])
    })
  })

  describe('stringify-roundtrip', () => {
    const delimiters: Delimiter[] = ['comma', 'tab', 'semicolon']

    it.each(delimiters)(
      'round-trip parseCsv(stringifyDataset(dataset, %s)) reproduz header/rows',
      async (delimiter) => {
        const dataset = {
          header: ['id', 'name', 'note'],
          rows: [
            ['1', 'Ana', 'ok'],
            ['2', 'Bruno', 'ok'],
          ],
        }

        const content = stringifyDataset(dataset, delimiter)
        const result = await parseCsv(content, { delimiter })

        expect(result.header).toEqual(dataset.header)
        expect(result.rows).toEqual(dataset.rows)
      },
    )

    it.each(delimiters)(
      'quota campos contendo o delimitador, aspas duplas ou quebra de linha (%s)',
      async (delimiter) => {
        const delimiterChar = { comma: ',', tab: '\t', semicolon: ';' }[
          delimiter
        ]
        const dataset = {
          header: ['name', 'note'],
          rows: [
            [`Doe${delimiterChar}John`, 'linha1\nlinha2'],
            ['Simple', 'aspas "internas" aqui'],
          ],
        }

        const content = stringifyDataset(dataset, delimiter)
        const result = await parseCsv(content, { delimiter })

        expect(result.header).toEqual(dataset.header)
        expect(result.rows).toEqual(dataset.rows)
      },
    )

    it('dataset sem linhas de dados serializa apenas o cabeçalho', () => {
      const dataset = { header: ['a', 'b', 'c'], rows: [] }

      const content = stringifyDataset(dataset, 'comma')

      expect(content).toBe('a,b,c')
    })
  })

  describe('orderedColumnIndices (CT-03: projeção pura da ordem completa de colunas)', () => {
    it('grupo fixado primeiro, na sequência de pinnedSequence (não ordenado numericamente), seguido do grupo não-fixado na sequência de order', () => {
      const result = orderedColumnIndices(6, [0, 1, 2, 3, 4, 5], [4, 1])

      expect(result).toEqual([4, 1, 0, 2, 3, 5])
    })

    it('order de tamanho divergente de columnCount cai para identidade', () => {
      const result = orderedColumnIndices(4, [1, 0], [])

      expect(result).toEqual([0, 1, 2, 3])
    })

    it('order de tamanho divergente cai para identidade mesmo com pinnedSequence não vazio', () => {
      const result = orderedColumnIndices(4, [3, 2], [2])

      expect(result).toEqual([2, 0, 1, 3])
    })

    it('cobre [0, columnCount) exatamente 1 vez, sem duplicados/faltantes, com pinnedSequence vazio', () => {
      const result = orderedColumnIndices(5, [4, 3, 2, 1, 0], [])

      expect(result.slice().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
      expect(result).toEqual([4, 3, 2, 1, 0])
    })

    it('cobre [0, columnCount) exatamente 1 vez quando pinnedSequence é o conjunto inteiro de colunas', () => {
      const result = orderedColumnIndices(3, [0, 1, 2], [2, 0, 1])

      expect(result).toEqual([2, 0, 1])
    })

    it('índice de pinnedSequence fora de [0, columnCount) é ignorado sem lançar', () => {
      expect(() => orderedColumnIndices(3, [0, 1, 2], [-1, 5, 1])).not.toThrow()

      const result = orderedColumnIndices(3, [0, 1, 2], [-1, 5, 1])

      expect(result).toEqual([1, 0, 2])
    })
  })

  describe('runParseRequest (contrato do Web Worker)', () => {
    it('emite progresso e o resultado final', async () => {
      const messages: ParseWorkerMessage[] = []
      await runParseRequest(
        { content: 'id,name\n1,Ana\n2,Bruno', fileName: 'people.csv' },
        (message) => messages.push(message),
      )

      const result = messages.find((m) => m.type === 'result')
      expect(result).toBeDefined()
      expect(messages.some((m) => m.type === 'progress')).toBe(true)
      if (result?.type === 'result') {
        expect(result.result.row_count).toBe(2)
        expect(result.result.header).toEqual(['id', 'name'])
      }
    })

    it('emite mensagem de erro para arquivo vazio', async () => {
      const messages: ParseWorkerMessage[] = []
      await runParseRequest(
        { content: '', fileName: 'empty.csv' },
        (message) => messages.push(message),
      )

      const error = messages.find((m) => m.type === 'error')
      expect(error).toBeDefined()
      expect(messages.some((m) => m.type === 'result')).toBe(false)
    })
  })
})
