import { describe, expect, it } from 'vitest'
import {
  extractHeaderTags,
  formatBytes,
  formatRelativeTime,
  formatRowCount,
  nextCopyName,
} from '~/services/formatFile'

describe('formatFile', () => {
  describe('formatRowCount', () => {
    it('agrupa milhares com separador', () => {
      expect(formatRowCount(0)).toBe('0')
      expect(formatRowCount(42)).toBe('42')
      expect(formatRowCount(1_204_882)).toBe('1,204,882')
    })
  })

  describe('formatBytes', () => {
    it('mostra bytes abaixo de 1 KB', () => {
      expect(formatBytes(0)).toBe('0 B')
      expect(formatBytes(42)).toBe('42 B')
      expect(formatBytes(1023)).toBe('1023 B')
    })

    it('escala para KB/MB/GB com uma casa decimal', () => {
      expect(formatBytes(1024)).toBe('1 KB')
      expect(formatBytes(1536)).toBe('1.5 KB')
      // 8.4 MB (ex. do design)
      expect(formatBytes(Math.round(8.4 * 1024 * 1024))).toBe('8.4 MB')
      expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3 GB')
    })

    it('usa inteiro a partir de 100 na unidade', () => {
      expect(formatBytes(150 * 1024)).toBe('150 KB')
    })
  })

  describe('formatRelativeTime', () => {
    const now = 10_000_000_000

    it('mostra "agora" abaixo de 1 minuto', () => {
      expect(formatRelativeTime(now, now)).toBe('agora')
      expect(formatRelativeTime(now - 59_000, now)).toBe('agora')
    })

    it('mostra minutos, horas e dias', () => {
      expect(formatRelativeTime(now - 2 * 60_000, now)).toBe('2m')
      expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe('3h')
      expect(formatRelativeTime(now - 5 * 86_400_000, now)).toBe('5d')
    })

    it('trata diferenças negativas como "agora"', () => {
      expect(formatRelativeTime(now + 10_000, now)).toBe('agora')
    })
  })

  describe('nextCopyName', () => {
    it('insere "(cópia)" antes da extensão', () => {
      expect(nextCopyName('transactions.csv')).toBe('transactions (cópia).csv')
    })

    it('incrementa o número ao aplicar sobre um nome já marcado como cópia', () => {
      expect(nextCopyName('transactions (cópia).csv')).toBe('transactions (cópia 2).csv')
      expect(nextCopyName('transactions (cópia 2).csv')).toBe('transactions (cópia 3).csv')
      expect(nextCopyName('transactions (cópia 9).csv')).toBe('transactions (cópia 10).csv')
    })

    it('funciona sem extensão', () => {
      expect(nextCopyName('README')).toBe('README (cópia)')
    })

    it('preserva múltiplos pontos no nome, usando só a última extensão', () => {
      expect(nextCopyName('relatorio.2026.csv')).toBe('relatorio.2026 (cópia).csv')
    })
  })

  describe('extractHeaderTags', () => {
    it('separa os nomes de coluna da primeira linha pelo delimitador', () => {
      const result = extractHeaderTags('id,nome,valor\n1,Ana,10', 'comma')
      expect(result).toEqual({ names: ['id', 'nome', 'valor'], overflow: 0 })
    })

    it('respeita o delimitador semicolon/tab', () => {
      expect(extractHeaderTags('id;nome;valor\n1;Ana;10', 'semicolon')).toEqual({
        names: ['id', 'nome', 'valor'],
        overflow: 0,
      })
      expect(extractHeaderTags('id\tnome\tvalor\n1\tAna\t10', 'tab')).toEqual({
        names: ['id', 'nome', 'valor'],
        overflow: 0,
      })
    })

    it('limita ao número informado e reporta o excedente em "overflow"', () => {
      const result = extractHeaderTags(
        'imovel,bairro,valor,area,quartos,vagas,tipo,cidade,uf\n1,Centro,100,50,2,1,casa,SP,SP',
        'comma',
        3,
      )
      expect(result).toEqual({ names: ['imovel', 'bairro', 'valor'], overflow: 6 })
    })

    it('não reporta overflow quando a contagem é igual ao limite', () => {
      const result = extractHeaderTags('a,b,c\n1,2,3', 'comma', 3)
      expect(result).toEqual({ names: ['a', 'b', 'c'], overflow: 0 })
    })

    it('funciona com uma única coluna e sem quebra de linha', () => {
      expect(extractHeaderTags('id', 'comma')).toEqual({ names: ['id'], overflow: 0 })
    })

    it('remove aspas envolvendo o nome da coluna', () => {
      const result = extractHeaderTags('"id","nome com, vírgula"\n1,Ana', 'comma')
      // Split simples (não aspas-aware): a vírgula dentro das aspas quebra o nome.
      expect(result.names[0]).toBe('id')
    })

    it('ignora conteúdo vazio', () => {
      expect(extractHeaderTags('', 'comma')).toEqual({ names: [], overflow: 0 })
    })

    it('trata CRLF sem incluir o \\r no último nome', () => {
      const result = extractHeaderTags('id,nome\r\n1,Ana', 'comma')
      expect(result.names).toEqual(['id', 'nome'])
    })
  })
})
