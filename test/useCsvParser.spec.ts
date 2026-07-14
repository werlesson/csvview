import { describe, expect, it, vi } from 'vitest'
import { useCsvParser } from '~/composables/useCsvParser'
import { CsvParseError, runParseRequest } from '~/services/csvParser'

/**
 * Web Worker falso que roteia a requisição pela mesma lógica pura
 * (`runParseRequest`) usada pelo Worker real, entregando as mensagens de forma
 * assíncrona. Permite exercitar o caminho "via Worker" do composable de forma
 * determinística sob happy-dom.
 */
class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  terminated = false

  postMessage(data: { content: string; fileName?: string }): void {
    void runParseRequest(data, (message) => {
      queueMicrotask(() => this.onmessage?.({ data: message } as MessageEvent))
    })
  }

  terminate(): void {
    this.terminated = true
  }
}

describe('useCsvParser', () => {
  it('parseFile lê um File e devolve o dataset (via Worker)', async () => {
    const worker = new FakeWorker()
    const { parseFile } = useCsvParser({
      createWorker: () => worker as unknown as Worker,
    })

    const file = new File(['id,name\n1,Ana\n2,Bruno'], 'people.csv', {
      type: 'text/csv',
    })
    const onProgress = vi.fn()

    const result = await parseFile(file, { onProgress })

    expect(result.header).toEqual(['id', 'name'])
    expect(result.row_count).toBe(2)
    expect(onProgress).toHaveBeenCalled()
    // O Worker é encerrado ao concluir.
    expect(worker.terminated).toBe(true)
  })

  it('parseFile propaga CsvParseError para arquivos vazios', async () => {
    const { parseFile } = useCsvParser({
      createWorker: () => new FakeWorker() as unknown as Worker,
    })

    const file = new File([''], 'empty.csv', { type: 'text/csv' })

    await expect(parseFile(file)).rejects.toBeInstanceOf(CsvParseError)
  })

  it('cai para o parse inline quando o Worker não pode ser criado', async () => {
    const { parseText } = useCsvParser({
      createWorker: () => {
        throw new Error('Worker indisponível neste ambiente')
      },
    })
    const onProgress = vi.fn()

    const result = await parseText('a;b\n1;2\n3;4', 'data.txt', { onProgress })

    expect(result.delimiter).toBe('semicolon')
    expect(result.header).toEqual(['a', 'b'])
    expect(result.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ])
    expect(onProgress).toHaveBeenCalled()
  })

  it('parseText reabre um conteúdo já em memória', async () => {
    const worker = new FakeWorker()
    const { parseText } = useCsvParser({
      createWorker: () => worker as unknown as Worker,
    })

    const result = await parseText('a,b,c\n1,2,3', 'stored.csv')

    expect(result.column_count).toBe(3)
    expect(result.rows).toEqual([['1', '2', '3']])
  })
})
