# Phases: sessions

Gerado por /plan a partir de PLAN.md — view executável para `./ralph.sh .spec/features/sessions/PHASES.md`.

## Phase 1: Fundação — schema, exposição de estado e tema

Antes de implementar, leia:
1. `.spec/features/sessions/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/sessions/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T01 — Object store `sessions` no banco IndexedDB
      Arquivos: `app/composables/useDatabase.ts`
      Mudança: bump `DB_VERSION` de `1` para `2`; adicionar `SESSIONS_STORE = 'sessions'`; adicionar `SessionRecord` (`fileId` keyPath, `columnCount`, `filters`, `sortKeys`, `hidden: number[]`, `widths: [number, number][]`, `order: number[]`, `pinned: number[]`, `updated_at`); estender `CsvViewDBSchema` e `upgrade()` com criação condicional (`if (!db.objectStoreNames.contains(SESSIONS_STORE))`), mesmo padrão de `files`/`settings`.
      Cobre: CT-01, RNF-02
      Acceptance criteria: abrir o banco cria o store `sessions` com keyPath `fileId`; reabrir não duplica/recria stores; um banco pré-existente só com `files`/`settings` (schema v1) abre sem erro e preserva os registros desses dois stores.
      Testes: `test/useDatabase.spec.ts` — criação do store `sessions`; idempotência da abertura; preservação de dados pré-existentes.
- [ ] T04 — Expor `hidden` no retorno de `useViewer.ts`
      Arquivos: `app/composables/useViewer.ts`
      Mudança: adicionar `hidden` ao objeto retornado por `useViewer()` (já existe como ref local, só não é exposto).
      Cobre: CT-01 (pré-requisito)
      Acceptance criteria: `hidden` está presente no objeto retornado por `useViewer()`; atribuir `hidden.value = new Set([...])` de fora reflete em `columns`/`visibleColumns` do mesmo jeito que `toggleColumn`.
      Testes: `test/useViewer.spec.ts` — `hidden` exposto e mutável externamente, refletindo em `columns`/`visibleColumns`.
- [ ] T05 — Serialização/validação pura da sessão
      Arquivos: `app/services/viewerSession.ts`
      Mudança: funções puras framework-free `serializeViewerSession(snapshot, columnCount)` e `deserializeViewerSession(record, columnCount)`; RF-06 — `columnCount` divergente retorna `null` (descarte total); RNF-03 — com `columnCount` igual, filtra índices fora de `[0, columnCount)` em `hidden`/`widths`/`order`/`pinned`/`filters[].column`/`sortKeys[].index` e degrada campos malformados para vazio, sem lançar.
      Cobre: CT-01, RF-06, RNF-03
      Acceptance criteria: roundtrip serialize→deserialize preserva os seis aspectos; `columnCount` divergente retorna `null`; índices fora do intervalo são removidos individualmente por campo quando `columnCount` bate; entrada malformada não lança e degrada para vazio.
      Testes: `test/viewerSession.spec.ts` — roundtrip; mismatch de `columnCount`; sanitização por campo; entrada malformada.
- [ ] T08 — `useTheme.ts` delega a `useSettingsStore`
      Arquivos: `app/composables/useTheme.ts`
      Mudança: manter `theme`/`setTheme`/`toggleTheme` com assinatura idêntica (CT-02); primeira chamada mantém leitura síncrona de `localStorage` como cache de primeira pintura e dispara, uma única vez, `useSettingsStore().getTheme()` assíncrono que sobrescreve o tema se divergir; `setTheme` continua síncrono e adicionalmente chama `useSettingsStore().setTheme(value)` fire-and-forget (try/catch, log em `console.error`), mantendo `localStorage` como cache secundário (não mais único caminho).
      Cobre: RF-04, CT-02
      Acceptance criteria: após `setTheme('light')`, uma nova instância de `useSettingsStore().getTheme()` resolve `'light'`; limpar `localStorage` mas manter valor em `settings` ainda resolve o tema correto após aguardar a resolução assíncrona; os testes síncronos existentes continuam passando inalterados.
      Testes: `test/useTheme.spec.ts` — persistência efetiva via IndexedDB; resolução assíncrona sem `localStorage`; regressão dos três testes síncronos existentes; regressão de `test/ThemeToggle.spec.ts`/`test/DefaultLayout.spec.ts`.

## Phase 2: CRUD de sessão, cascade delete e limpeza de documentação

Antes de implementar, leia:
1. `.spec/features/sessions/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/sessions/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T02 — Composable `useSessionStore.ts` (CRUD do store `sessions`)
      Arquivos: `app/composables/useSessionStore.ts`
      Mudança: `getSession(fileId)`, `saveSession(record)`, `deleteSession(fileId)` usando `openDatabase()`/`SESSIONS_STORE` (T01), no mesmo padrão de `useSettingsStore.ts`/`useFilesStore.ts` — sem lógica de domínio (validação/serialização fica em T05).
      Cobre: CT-01
      Acceptance criteria: salvar/recuperar preserva os campos; `deleteSession` remove o registro; `getSession` de `fileId` inexistente retorna `undefined`; sobrescrever o mesmo `fileId` substitui o registro anterior.
      Testes: `test/useSessionStore.spec.ts` — CRUD completo, incluindo overwrite e chave ausente.
- [ ] T03 — Cascade delete de sessão em `useFilesStore.ts`
      Arquivos: `app/composables/useFilesStore.ts`
      Mudança: importar `SESSIONS_STORE`; ampliar a transação de `deleteFile(id)` e do laço de eviction LRU em `saveFile()` para `db.transaction([FILES_STORE, SESSIONS_STORE], 'readwrite')`, deletando o registro de sessão de cada `id` removido (manual ou evictado) na mesma transação.
      Cobre: RF-07, CT-03
      Acceptance criteria: excluir manualmente um arquivo com sessão salva remove ambos os registros; a 11ª inserção evictando o mais antigo remove também a sessão do evictado; consultar a sessão de um `id` já excluído não retorna registro; suíte existente de CRUD/listagem/LRU/touch continua passando inalterada.
      Testes: `test/useFilesStore.spec.ts` — cascade delete manual, cascade delete por eviction LRU, ausência de órfãos, regressão dos casos existentes.
- [ ] T09 — Corrigir comentários "RNF-04" obsoletos em `useViewer.ts`
      Arquivos: `app/composables/useViewer.ts`
      Mudança: atualizar as 5 ocorrências de JSDoc ("nada é gravado em IndexedDB (RNF-04)", `useViewer.ts:82,89,97,104,111`) para refletir que a persistência agora existe via `useViewerSession.ts` (composable irmão, T06), sem que `useViewer.ts` ganhe qualquer import de `idb`/`useDatabase`.
      Cobre: manutenção de documentação — preserva a regra 2 de `coding_guidelines.md` (estado derivado puro)
      Acceptance criteria: nenhuma ocorrência de "nada é gravado em IndexedDB" permanece em `useViewer.ts`; suíte existente de `useViewer.spec.ts` continua verde sem alteração.
      Testes: `test/useViewer.spec.ts` — suíte existente inalterada (mudança é só de comentário).

## Phase 3: Composable de restauração e escrita debounced

Antes de implementar, leia:
1. `.spec/features/sessions/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/sessions/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T06 — Composable `useViewerSession.ts` (restauração + escrita debounced)
      Arquivos: `app/composables/useViewerSession.ts`
      Mudança: `useViewerSession(viewer, meta, options?)` sobre `{ filters, sortKeys, hidden, widths, order, pinned }` (T04) e `meta` de `useCurrentDataset`, com `sessionStore`/`debounceMs` injetáveis (default `useSessionStore()`/`300`). Restauração (RF-02/03/05): `watch(meta, ..., { immediate: true })` — sem `id`, nenhuma leitura em store algum; com `id`, `getSession` + `deserializeViewerSession` (T05); resultado `null` com registro divergente → `deleteSession` (RF-06) e estado padrão mantido (RNF-03); resultado válido → aplica aos refs sob flag `isRestoring`. Escrita debounced (RF-01/RNF-01): `watch([filters, sortKeys, hidden, widths, order, pinned], ...)` debounced; ao disparar, lê `meta.value?.id` no momento do disparo — `undefined` não escreve em nenhum store (RF-05 AC2, sem retroatividade); definido → `serializeViewerSession` + `saveSession` em `try/catch`, erro só logado em `console.error`, nunca lançado.
      Cobre: RF-01, RF-02, RF-03, RF-05, RF-06 (fiação), RNF-01, RNF-03 (fiação)
      Acceptance criteria: sem `id`, nenhuma mutação chama `saveSession`; com `id`, mutações coalescem numa única `saveSession` por janela de debounce; um registro válido pré-semeado restaura os refs do viewer; um registro com `columnCount` divergente não é aplicado E é deletado; uma falha em `saveSession` não propaga exceção e é apenas logada; mutações antes da transição de `id` indefinido→definido nunca são salvas retroativamente.
      Testes: `test/useViewerSession.spec.ts` (`vi.useFakeTimers()`) — os seis cenários acima.

## Phase 4: Fiação na página do Viewer

Antes de implementar, leia:
1. `.spec/features/sessions/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/sessions/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T07 — Fiar `useViewerSession` em `viewer.vue`
      Arquivos: `app/pages/viewer.vue`
      Mudança: após `const { ... } = useViewer(...)`, chamar `useViewerSession({ filters, sortKeys, hidden, widths, order, pinned }, meta)` (T06), com `meta` já vindo de `useCurrentDataset()`; sem marcação nova no `<template>`.
      Cobre: RF-01, RF-02, RF-03 (fim a fim)
      Acceptance criteria: aplicar filtro + ordenar (Shift+clique, 2 colunas) + ocultar + redimensionar + reordenar + fixar, avançar os fake timers do debounce, desmontar e remontar `ViewerPage` (mesmo dataset/meta em memória) restaura os seis aspectos idênticos; reabrir com `meta.id` diferente não herda a sessão do primeiro arquivo; um dataset com `meta.id === undefined` permanece funcional sem acesso extra a `indexedDB`/`localStorage` além do já esperado.
      Testes: `test/pages/viewer.spec.ts` — cenário completo de mutação + remount; isolamento por `id`; regressão do dataset sem `id`.
