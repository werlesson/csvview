import { describe, expect, it } from 'vitest'
import {
  formatBytes,
  formatRelativeTime,
  formatRowCount,
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
})
