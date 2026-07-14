/// <reference lib="webworker" />
import { runParseRequest, type ParseRequest } from './csvParser'

/**
 * Web Worker de parsing: recebe uma {@link ParseRequest}, roda a lógica pura
 * de parse (que faz o trabalho pesado fora da main thread, mantendo a UI
 * responsiva — US-1.2) e devolve mensagens de progresso/resultado/erro.
 *
 * Toda a lógica vive em `csvParser.ts`; este arquivo é apenas o plumbing do
 * Worker (postMessage/onmessage).
 */
self.addEventListener('message', (event: MessageEvent<ParseRequest>) => {
  void runParseRequest(event.data, (message) => self.postMessage(message))
})
