import { describe, expect, it } from 'vitest'
import {
  deriveTableName,
  generateCsv,
  generateJson,
  generateMarkdown,
  generateSql,
  projectColumns,
} from '~/services/exportData'

describe('exportData', () => {
  describe('projectColumns', () => {
    it('extrai apenas as colunas indicadas, na ordem dada', () => {
      const rows = [
        ['a1', 'b1', 'c1'],
        ['a2', 'b2', 'c2'],
      ]
      expect(projectColumns(rows, [2, 0])).toEqual([
        ['c1', 'a1'],
        ['c2', 'a2'],
      ])
    })

    it('nunca inclui um índice fora da lista passada', () => {
      const rows = [['a1', 'b1', 'c1']]
      const result = projectColumns(rows, [1])
      expect(result).toEqual([['b1']])
      expect(result[0]).toHaveLength(1)
    })

    it('índice fora do tamanho da linha vira célula vazia', () => {
      const rows = [['a1']]
      expect(projectColumns(rows, [0, 5])).toEqual([['a1', '']])
    })
  })

  describe('generateCsv', () => {
    const header = ['name', 'city']
    const rows = [
      ['Ana', 'São Paulo'],
      ['Bob', 'Rio, RJ'],
    ]

    it('inclui a linha de cabeçalho por padrão', () => {
      const csv = generateCsv(header, rows)
      expect(csv.split('\r\n')[0]).toBe('name,city')
    })

    it('omite a linha de cabeçalho quando includeHeader é false', () => {
      const csv = generateCsv(header, rows, { includeHeader: false })
      expect(csv.split('\r\n')[0]).toBe('Ana,São Paulo')
    })

    it('aspas em todos os campos quando quoteAll é true', () => {
      const csv = generateCsv(header, rows, { quoteAll: true })
      const lines = csv.split('\r\n')
      expect(lines[0]).toBe('"name","city"')
      expect(lines[1]).toBe('"Ana","São Paulo"')
    })

    it('sem quoteAll, aspas apenas onde RFC 4180 exige (delimitador/aspas/quebra de linha)', () => {
      const csv = generateCsv(header, rows, { quoteAll: false })
      const lines = csv.split('\r\n')
      expect(lines[0]).toBe('name,city')
      expect(lines[1]).toBe('Ana,São Paulo')
      expect(lines[2]).toBe('Bob,"Rio, RJ"')
    })

    it('escapa aspas duplas internas por duplicação', () => {
      const csv = generateCsv(['label'], [['ele disse "oi"']], { quoteAll: false })
      expect(csv.split('\r\n')[1]).toBe('"ele disse ""oi"""')
    })

    it('escapa campo com quebra de linha envolvendo em aspas', () => {
      const csv = generateCsv(['label'], [['linha1\nlinha2']], { quoteAll: false })
      expect(csv.split('\r\n').slice(1).join('\r\n')).toBe('"linha1\nlinha2"')
    })

    it('célula vazia vira campo vazio entre delimitadores', () => {
      const csv = generateCsv(header, [['', 'Rio']])
      expect(csv.split('\r\n')[1]).toBe(',Rio')
    })
  })

  describe('generateJson', () => {
    it('gera um array de objetos chaveados pelos rótulos de header', () => {
      const json = generateJson(['name', 'city'], [['Ana', 'São Paulo']])
      expect(JSON.parse(json)).toEqual([{ name: 'Ana', city: 'São Paulo' }])
    })

    it('passthrough: valores parecidos com número/booleano permanecem string', () => {
      const json = generateJson(['n', 'flag'], [['42', 'true']])
      const parsed = JSON.parse(json)
      expect(parsed[0].n).toBe('42')
      expect(typeof parsed[0].n).toBe('string')
      expect(parsed[0].flag).toBe('true')
      expect(typeof parsed[0].flag).toBe('string')
    })

    it('célula vazia vira null JSON (não a string "null")', () => {
      const json = generateJson(['name', 'city'], [['Ana', '']])
      const parsed = JSON.parse(json)
      expect(parsed[0].city).toBeNull()
    })

    it('não inclui chave de coluna oculta (header já projetado)', () => {
      const json = generateJson(['name'], [['Ana']])
      const parsed = JSON.parse(json)
      expect(Object.keys(parsed[0])).toEqual(['name'])
    })
  })

  describe('generateMarkdown', () => {
    it('gera tabela GFM com cabeçalho e linha separadora sempre presentes', () => {
      const md = generateMarkdown(['name', 'city'], [['Ana', 'São Paulo']])
      const lines = md.split('\n')
      expect(lines[0]).toBe('| name | city |')
      expect(lines[1]).toBe('| --- | --- |')
      expect(lines[2]).toBe('| Ana | São Paulo |')
    })

    it('escapa o caractere | literal como \\|', () => {
      const md = generateMarkdown(['name'], [['a|b']])
      expect(md.split('\n')[2]).toBe('| a\\|b |')
    })

    it('substitui quebra de linha embutida por um espaço, sem gerar linhas extras', () => {
      const md = generateMarkdown(['name'], [['linha1\nlinha2'], ['linha3\r\nlinha4']])
      const lines = md.split('\n')
      expect(lines).toHaveLength(4)
      expect(lines[2]).toBe('| linha1 linha2 |')
      expect(lines[3]).toBe('| linha3 linha4 |')
    })

    it('célula vazia vira célula em branco', () => {
      const md = generateMarkdown(['name', 'city'], [['Ana', '']])
      expect(md.split('\n')[2]).toBe('| Ana |  |')
    })

    it('escapa | também no cabeçalho', () => {
      const md = generateMarkdown(['a|b', 'c'], [])
      expect(md.split('\n')[0]).toBe('| a\\|b | c |')
    })
  })

  describe('generateSql', () => {
    const header = ['name', 'city']
    const rows = [['Ana', "O'Brien"]]

    it('gera um INSERT INTO por linha, com colunas iguais às visíveis na mesma ordem', () => {
      const sql = generateSql(header, rows, { tableName: 'people' })
      expect(sql).toContain("INSERT INTO people (name, city) VALUES ('Ana', 'O''Brien');")
    })

    it('escapa aspas simples internas por duplicação', () => {
      const sql = generateSql(['name'], [["O'Brien"]], { tableName: 't' })
      expect(sql).toContain("VALUES ('O''Brien');")
    })

    it('com includeHeader ligado, a primeira linha é o comentário -- col1, col2', () => {
      const sql = generateSql(header, rows, { tableName: 'people', includeHeader: true })
      expect(sql.split('\n')[0]).toBe('-- name, city')
    })

    it('com includeHeader desligado, não há linha de comentário', () => {
      const sql = generateSql(header, rows, { tableName: 'people', includeHeader: false })
      expect(sql.split('\n')[0]).toContain('INSERT INTO')
    })

    it('célula vazia vira o literal NULL sem aspas', () => {
      const sql = generateSql(header, [['Ana', '']], { tableName: 'people' })
      expect(sql).toContain("VALUES ('Ana', NULL);")
    })
  })

  describe('deriveTableName', () => {
    it("deriveTableName('transactions 2026.csv') === 'transactions_2026'", () => {
      expect(deriveTableName('transactions 2026.csv')).toBe('transactions_2026')
    })

    it("deriveTableName('2026-vendas!.csv') não começa com dígito e só contém [A-Za-z0-9_]", () => {
      const name = deriveTableName('2026-vendas!.csv')
      expect(/^[0-9]/.test(name)).toBe(false)
      expect(/^[A-Za-z0-9_]+$/.test(name)).toBe(true)
    })

    it('colapsa sequências de _ consecutivos em um único _', () => {
      expect(deriveTableName('a--b!!.csv')).toBe('a_b_')
    })

    it('nome vazio (sem base) é prefixado com _', () => {
      expect(deriveTableName('.csv')).toBe('_')
    })

    it('remove apenas a extensão final', () => {
      expect(deriveTableName('archive.tar.gz')).toBe('archive_tar')
    })
  })
})
