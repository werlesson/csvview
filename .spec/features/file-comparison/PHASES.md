# Phases: file-comparison

Gerado por /plan a partir de PLAN.md — view executável para `./ralph.sh .spec/features/file-comparison/PHASES.md`.

## Phase 1: Motor de diff puro e entrada no Viewer

Antes de implementar, leia:
1. `.spec/features/file-comparison/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/file-comparison/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T01 — Serviço puro `diffDatasets.ts` (pareamento, classificação, equivalência por tipo)
      Arquivos: `app/services/diffDatasets.ts`
      Mudança: Implementar `commonKeyColumns`, `pairByKey` (Map de chave concatenada → linha, RF-04), `pairByPosition` (fallback por índice, RF-05), `valuesEqual` (equivalência por tipo inferido reusando `parseNumber`/`parseDate` de `columnStats.ts`, RF-06), `diffRecord` e `diffDatasets` (orquestração + contagens, RF-03). Framework-free, em `app/services/`.
      Cobre: RF-03, RF-04, RF-05, RF-06, CT-02
      Acceptance criteria: para qualquer par de datasets, a soma de `added+removed+changed+unchanged` de `diffDatasets(...)` é igual ao total de registros pareados, sem sobreposição de categoria; `valuesEqual('number', '10', '10.0')` e datas equivalentes em formatos distintos retornam `true`; texto que difere em qualquer caractere retorna `false`; chave presente só em A/B nunca é pareada com outro registro.
      Testes: `test/diffDatasets.spec.ts` — `commonKeyColumns` com/sem interseção; `pairByKey`/`pairByPosition` nos casos de borda (chave só em A, só em B, chave duplicada, A/B de tamanhos diferentes); `valuesEqual` por tipo; `diffDatasets` fim a fim com soma de contagens.
- [ ] T07 — Entrada "Comparar" no Viewer
      Arquivos: `app/components/ViewerToolbar.vue`, `app/pages/viewer.vue`
      Mudança: Novo botão "Comparar" em `ViewerToolbar.vue` (padrão visual dos botões existentes em `toolbar__meta`), emitindo `open-compare`; `viewer.vue` escuta `@open-compare` e chama `navigateTo('/compare')`. Nenhuma outra mudança em `viewer.vue`/`useViewer.ts`.
      Cobre: RF-02
      Acceptance criteria: clicar "Comparar" na toolbar do Viewer navega para `/compare`; nenhum comportamento existente do Viewer (busca, filtros, edição, exportação, undo/redo) muda.
      Testes: `test/ViewerToolbar.spec.ts` — clique emite `open-compare`; `test/pages/viewer.spec.ts` — `@open-compare` dispara `navigateTo('/compare')`.

## Phase 2: Estado paralelo de comparação (CT-01, RF-01, RNF-01)

Antes de implementar, leia:
1. `.spec/features/file-comparison/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/file-comparison/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T02 — Composable `useComparisonDatasets` (estado paralelo CT-01, RF-01, RNF-01; abertura de B dedicada e sem persistência)
      Arquivos: `app/composables/useComparisonDatasets.ts`
      Mudança: Composable de estado em escopo de módulo expondo `datasetA`/`metaA` (passthrough somente-leitura de `useCurrentDataset`, nunca reatribuído), `datasetB`/`metaB` (refs locais, nunca persistidas), `keyColumn`/`availableKeyColumns` (CT-02, via `commonKeyColumns` de T01), `result`/`summary` (via `diffDatasets` de T01). `openFileB(file)` e `reopenRecentB(id)` são um caminho de abertura **dedicado e paralelo** a `useOpenFile.ts` (não uma instância dele): reaproveitam apenas `hasAcceptedExtension`/`ACCEPTED_EXTENSIONS` (constantes puras de `useOpenFile.ts`) e o `parser.parseText()` (`useCsvParser()`, mesmo Web Worker); `reopenRecentB` usa `filesStore.getFile(id)` (leitura pura). Nenhum dos dois caminhos chama `useFilesStore().saveFile()` nem `.touchFile()` — dataset B nunca é persistido em IndexedDB nem altera a ordem/`last_opened_at` dos recentes de A. `exceedsCeiling(sizeBytes, rowCount)` aplica o teto de RNF-01 (~50 MB / ~1M linhas) antes de aceitar B, populando `comparisonError` em caso de excesso. `clearComparison()` e `watch(() => useCurrentDataset().meta.value?.id, clearComparison, { flush: 'sync' })` resetam B ao trocar A.
      Cobre: RF-01, CT-01, CT-02, RNF-01
      Acceptance criteria: após carregar B, `useCurrentDataset().dataset`/`.meta` permanecem byte-a-byte iguais a antes (mesmo `rowCount`/`columnCount`/conteúdo) — nenhuma chamada a `setDataset` sobre A; `openFileB`/`reopenRecentB` nunca chamam `saveFile`/`touchFile` do `filesStore` injetado, e `useFilesStore().listFiles()` não ganha nenhuma entrada nova nem tem `last_opened_at`/ordem alterados após abrir B por upload ou por recente; um arquivo B acima de ~50 MB ou ~1M linhas é rejeitado (`comparisonError` populado, `datasetB` permanece `null`) tanto via `openFileB` quanto via `reopenRecentB`; trocar o `id` de A limpa `datasetB`/`metaB`/`keyColumn`/`comparisonError`.
      Testes: `test/useComparisonDatasets.spec.ts` — RF-01 (A intacto), não-persistência de B nos dois caminhos (spy de `saveFile`/`touchFile` + `listFiles()` inalterado), rejeição de RNF-01 nos dois caminhos de abertura, reset automático ao trocar A, `availableKeyColumns` refletindo a interseção real dos cabeçalhos.

## Phase 3: Componentes de apresentação (seletor, resumo, tabela de diff)

Antes de implementar, leia:
1. `.spec/features/file-comparison/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/file-comparison/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T03 — Componente `CompareFileSelector.vue` (UI-01: escolha do arquivo B)
      Arquivos: `app/components/CompareFileSelector.vue`
      Mudança: Modal reaproveitando `Dropzone.vue`/`RecentFiles.vue` por composição (sem prop/variante nova em `Dropzone.vue`), no padrão visual de overlay/backdrop/foco/`Transition` de `ExportModal.vue`. `RecentFiles.vue` lista apenas os recentes de A; escolher um item aciona `reopenRecentB` (T02), que nunca escreve nessa lista. Props: `open`, `recents`, `isOpening`, `error`. Emits: `select(file)`, `open-recent(id)`, `close`.
      Cobre: UI-01
      Acceptance criteria: soltar/escolher um arquivo emite `select`; clicar um item da lista de recentes emite `open-recent`; backdrop/Escape/"X" emitem `close`; `error` (quando presente) fica visível no modal.
      Testes: `test/CompareFileSelector.spec.ts` — emissão de `select`/`open-recent`/`close`; exibição de `error`; estado `isOpening`.
- [ ] T04 — Componente `CompareSummary.vue` (UI-03: resumo de contagens)
      Arquivos: `app/components/CompareSummary.vue`
      Mudança: Componente presentacional exibindo `counts: { added, removed, changed, unchanged }` no formato da Screen 5 (`+N adicionadas · −N removidas · ~N alteradas`), reaproveitando `Badge.vue`.
      Cobre: UI-03
      Acceptance criteria: as três contagens exibidas (adicionados/removidos/alterados) refletem exatamente a prop `counts` recebida; `unchanged` nunca aparece nos três badges visíveis.
      Testes: `test/CompareSummary.spec.ts` — renderização das três contagens; `unchanged` fora da exibição.
- [ ] T05 — Componente `CompareTable.vue` (UI-02: diff célula a célula + UI-04: renderização filtrada)
      Arquivos: `app/components/CompareTable.vue`
      Mudança: Tabela virtualizada reaproveitando o padrão de `ViewerTable.vue`/`@tanstack/vue-virtual`. Props: `commonColumns`, `records` (já filtrados pelo chamador quando "somente diferenças" está ativo), `noResults`. Cada linha exibe status (`added`/`removed`/`changed`/`unchanged` via `Badge.vue`); em linhas `changed`, células cujo nome está em `record.diffColumns` recebem indicador visual distinto. Sem edição de célula.
      Cobre: UI-02, UI-04
      Acceptance criteria: em um registro `changed`, toda célula com nome em `diffColumns` recebe o indicador visual e nenhuma célula fora dessa lista o recebe; registros `added`/`removed` não exibem indicador de diff de célula; `noResults` mostra o estado vazio.
      Testes: `test/CompareTable.spec.ts` — marcação exata das células divergentes; ausência de marcação em `added`/`removed`; estado vazio.

## Phase 4: Página de comparação (fiação completa)

Antes de implementar, leia:
1. `.spec/features/file-comparison/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/file-comparison/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T06 — Página `compare.vue` (RF-02: rota dedicada + fiação completa)
      Arquivos: `app/pages/compare.vue`
      Mudança: Nova rota `/compare`; guarda `navigateTo('/')` sem dataset A carregado (mesmo padrão de `viewer.vue`). Usa `useComparisonDatasets()` (T02): sem B, renderiza `CompareFileSelector` (T03) alimentado por `useFilesStore().listFiles()`; com B, renderiza um `<Select>` (CT-02, `v-model` em `keyColumn` com `availableKeyColumns`), `CompareSummary` (T04), toggle "Somente diferenças" (UI-04, `ref` local `onlyDifferences`, default `false`) e `CompareTable` (T05) com `records` filtrados por `onlyDifferences`.
      Cobre: RF-02, CT-02, UI-03, UI-04
      Acceptance criteria: acesso direto a `/compare` sem dataset A carregado redireciona a `/`; com A carregado e sem B, `CompareFileSelector` é exibido; após selecionar B, `CompareSummary`+`CompareTable` são exibidos; ativar "Somente diferenças" remove os registros `unchanged` da lista passada a `CompareTable` e desativar restaura todos.
      Testes: `test/pages/compare.spec.ts` — guarda de rota; alternância seletor↔comparação; toggle "Somente diferenças".

## Phase 5: Testes de integração cross-cutting

Antes de implementar, leia:
1. `.spec/features/file-comparison/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/file-comparison/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T08 — Testes de integração cross-cutting (RF-01 fim a fim, RNF-01 nos dois caminhos, reset em troca de A, não-persistência de B)
      Arquivos: `test/useComparisonDatasets.spec.ts`, `test/pages/compare.spec.ts`
      Mudança: Cenários fim a fim: (1) abrir A → abrir B via upload (caminho dedicado, sem persistência) → abrir um terceiro arquivo como novo A (fluxo real, não mockado) → `datasetB`/`metaB`/`keyColumn` são limpos automaticamente; (2) RNF-01 rejeitado tanto via `openFileB` quanto via `reopenRecentB`, mesma mensagem de erro; (3) RF-03 AC fim a fim com fixture de added/removed/changed/unchanged conhecidos — soma das quatro contagens bate com o total de registros pareados; (4) abrir B por upload e por recente, com `useFilesStore()` real, não altera a contagem de registros em `files` nem o `last_opened_at`/ordem dos existentes.
      Cobre: RF-01, RF-03, RNF-01
      Acceptance criteria: os quatro cenários acima passam usando os composables/páginas reais (sem mocks de `useOpenFile`/`useCurrentDataset`/`useFilesStore` no cenário 4), comprovando o comportamento cross-cutting não coberto pelos testes unitários de T01/T02.
      Testes: os arquivos listados em Arquivos — casos descritos acima.
</content>
