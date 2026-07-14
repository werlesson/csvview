// Fornece uma implementação de IndexedDB no ambiente de testes (happy-dom não
// implementa IndexedDB). `fake-indexeddb/auto` registra os globais
// `indexedDB`, `IDBKeyRange`, etc., permitindo testar a camada de persistência
// sob o mesmo runner (vitest) usado pelo resto do projeto.
import 'fake-indexeddb/auto'
