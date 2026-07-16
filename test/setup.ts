// Fornece uma implementação de IndexedDB no ambiente de testes (happy-dom não
// implementa IndexedDB). `fake-indexeddb/auto` registra os globais
// `indexedDB`, `IDBKeyRange`, etc., permitindo testar a camada de persistência
// sob o mesmo runner (vitest) usado pelo resto do projeto.
import 'fake-indexeddb/auto'

// `definePageMeta` é um macro de compilação do Nuxt: em `nuxt build`/`nuxt dev`
// o transform de páginas remove a chamada do código real (ela não tem efeito
// em runtime). Sob vitest puro (sem o pipeline do Nuxt) o identificador não
// existe — stub no-op global para permitir montar páginas que o chamam.
;(globalThis as unknown as { definePageMeta?: (meta: unknown) => void }).definePageMeta = () => {}

// `useHead`/`navigateTo` são auto-imports do Nuxt (ausentes sob vitest puro,
// sem o pipeline do Nuxt) — stubs no-op globais para permitir montar páginas
// que os chamam diretamente no `<script setup>` (ex.: `viewer.vue`).
;(globalThis as unknown as { useHead?: (meta: unknown) => void }).useHead = () => {}
;(globalThis as unknown as { navigateTo?: (path: string) => void }).navigateTo = () => {}
