# Phases: filters

Gerado por /plan a partir de PLAN.md — view executável para `./ralph.sh .spec/features/filters/PHASES.md`.

## Phase 1: Predicado puro (serviço columnFilters)

Antes de implementar, leia:
1. `.spec/features/filters/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/filters/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T01 — Módulo de predicado puro `columnFilters`
      Arquivos: `app/services/columnFilters.ts` (novo)
      Mudança: criar módulo puro estilo `columnStats.ts` (sem I/O). Exportar o modelo CT-01 `ColumnFilter { column: number; operator: FilterOperator; value?: string | number | { from; to } }` e a união `FilterOperator` (igual, diferente, contem, naoContem, maiorQue, menorQue, entre, intervaloDatas, vazio, preenchido, verdadeiro, falso); `typeFamily(type)` mapeando number→numero, date→data, boolean→booleano, text|email|url→texto (degrada sem booleano); `operatorsForFamily(family)` conforme RF-01; `isFilterInert(filter)` (RF-05); predicados por operador (RF-02) reutilizando `isEmptyCell`/`parseNumber`/`isDateValue` de `columnStats.ts`, `entre`/`intervaloDatas` inclusivos `[from,to]`, texto caixa-insensível, não-parseável nunca satisfaz relacional/intervalo, negação mantém vazias, `verdadeiro`/`falso` consomem o reconhecedor booleano de `rich-types-and-stats` (não redefinir tokens), normalização de data local DMY+ISO; combinador `matchesFilters(filters, row, columnTypes): boolean` (AND de filtros não-inertes, puro/determinístico).
      Cobre: RF-01, RF-02, RF-03, CT-01, RNF-02
      Acceptance criteria: `operatorsForFamily` para number inclui maiorQue/menorQue/entre e exclui contem; text inclui contem/naoContem e exclui entre; date inclui intervaloDatas; vazio/preenchido em todas; booleano só quando family='booleano'. Semântica: vazio==isEmptyCell e preenchido=complemento; `"100"`==`"100.0"`==`" 100 "` no igual numérico e não-numérico nunca satisfaz; entre `[from,to]` inclusivo; intervaloDatas aceita DMY e ISO inclusivo; não-parseável excluída de relacional/intervalo; diferente/naoContem mantêm célula vazia; `matchesFilters` faz AND de múltiplos filtros (inclusive dois na mesma coluna) e ignora filtro inerte; mesmo input → mesmo resultado.
      Testes: `test/columnFilters.spec.ts` (novo, Vitest) — casos de operadores por família, semântica dos 12 operadores, inclusividade, caixa, não-parseável, negação com vazio, AND multi-filtro, inércia e determinismo.

## Phase 2: Estado reativo (composable useViewer)

Antes de implementar, leia:
1. `.spec/features/filters/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/filters/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T02 — Ampliar `useViewer` com estado de filtros + composição busca+filtros
      Arquivos: `app/composables/useViewer.ts`
      Mudança: adicionar `filters = ref<ColumnFilter[]>([])` (só em memória, RF-07); mutadores `addFilter`/`updateFilter`/`removeFilter`/`clearFilters`; `activeFilters` (não-inertes) e `activeFilterCount`; ESTENDER o computed `filteredRows` (`useViewer.ts:93`) para aplicar `matchesFilters(activeFilters, row, columnTypes)` APÓS a busca, na mesma passagem O(N), lendo `columnTypes` uma única vez; estender `noResults` (`useViewer.ts:108`) para busca OU filtros ativos com resultado vazio; acrescentar os novos símbolos ao retorno (`useViewer.ts:164`) preservando nome/semântica de search/filteredRows/totalRows/visibleRowCount/noResults/columnTypes/visibleColumns. Sem filtros ativos, `filteredRows` permanece idêntico ao de hoje.
      Cobre: RF-03, RF-04, RF-05, RF-06, RF-07, CT-02, RNF-01, RNF-02, RNF-03
      Acceptance criteria: `amount>100` reduz linhas; `amount>100` E `status=failed` retorna a interseção; dois filtros na mesma coluna combinam por E; remover filtro reamplia; busca `"pix"` + `amount>0` = interseção e limpar só a busca mantém o filtro (e vice-versa); `visibleRowCount` acompanha; `noResults` verdadeiro em combinação vazia; `clearFilters()` com busca vazia restaura `dataset.value.rows`; filtro inerte não restringe; sem filtros o comportamento da busca é idêntico ao atual e os testes existentes seguem verdes.
      Testes: `test/useViewer.spec.ts` (estender) — cenários acima + regressão da busca sem filtros.

## Phase 3: Componentes de UI

Antes de implementar, leia:
1. `.spec/features/filters/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/filters/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T03 — Novo componente `FilterPanel` (chips + Adicionar filtro + editor + Limpar)
      Arquivos: `app/components/FilterPanel.vue` (novo)
      Mudança: componente fino/apresentacional. Props `columns: ViewerColumn[]` (todas, inclusive ocultas) e `filters: ColumnFilter[]`; emits `add`/`update`/`remove`/`clear`. UI: um chip por filtro ativo com rótulo `<coluna> <operador> <valor>` (nome mesmo se oculta); botão "Adicionar filtro" abrindo editor dropdown/popover (reusar `Dropdown.vue`/`Select.vue`) para escolher coluna (lista todas), operador via `operatorsForFamily(typeFamily(column.type))` de T01 e valor (único, par `{from,to}` para entre/intervaloDatas, ou sem valor para vazio/preenchido/verdadeiro/falso); botão "Limpar"; chips reusam `Badge.vue`/`ColumnChip.vue`. Sem controles de filtro no `<th>`; sem botão "Aplicar".
      Cobre: UI-01, RF-01
      Acceptance criteria: renderiza um chip por filtro com rótulo `<coluna> <operador> <valor>`; coluna oculta aparece no seletor e no chip; coluna number oferece "maior que"/"entre" e não "contém", coluna text oferece "contém" e não "entre"; "Adicionar filtro" emite `add`, remover chip emite `remove`, "Limpar" emite `clear`; nenhum controle de filtro dentro de `<th>`.
      Testes: `test/FilterPanel.spec.ts` (novo, `@vue/test-utils mount`) — chips, operadores por família, coluna oculta, emissão de eventos.
- [ ] T04 — Badge de contagem de filtros na `ViewerToolbar`
      Arquivos: `app/components/ViewerToolbar.vue`
      Mudança: adicionar controle "Filtros" com badge de contagem (reusar `Badge.vue`), espelhando o design (`README.md:78`); nova prop `activeFilterCount: number` (exibe o número quando `>0`, oculta quando `0`); emitir `toggle-filters` para abrir o painel (visibilidade coordenada em `viewer.vue`); manter busca/seletor de colunas/contador inalterados.
      Cobre: UI-02
      Acceptance criteria: `activeFilterCount=2` renderiza badge "2" no controle Filtros; `activeFilterCount=0` não renderiza contagem; controles existentes seguem renderizados; clicar em Filtros emite o evento de abertura.
      Testes: `test/ViewerToolbar.spec.ts` (estender) — badge por contagem, ausência de badge em zero, controles existentes, evento de abertura.
- [ ] T05 — Estado vazio + ação "Limpar filtros" no `ViewerTable`
      Arquivos: `app/components/ViewerTable.vue`
      Mudança: no bloco `viewer-table__empty` (`ViewerTable.vue:126`), quando `hasActiveFilters` (nova prop opcional, default `false`), ajustar a dica para mencionar filtros e expor ação visível de limpar filtros emitindo `clear-filters`; sem filtros mantém o texto atual da busca; virtualização (`ViewerTable.vue:59`) inalterada.
      Cobre: UI-03, RF-06
      Acceptance criteria: com `rows=[]` e `hasActiveFilters=true` renderiza a ação de limpar filtros e emite `clear-filters` ao acioná-la; com `hasActiveFilters=false` mantém a dica atual da busca; cabeçalho segue sem controles de filtro; nº de linhas montadas continua proporcional à viewport.
      Testes: `test/ViewerTable.spec.ts` (estender) — estado vazio com/sem filtros, emissão de `clear-filters`, cabeçalho intacto.

## Phase 4: Fiação da página

Antes de implementar, leia:
1. `.spec/features/filters/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/filters/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T06 — Fiação em `viewer.vue`
      Arquivos: `app/pages/viewer.vue`
      Mudança: desestruturar do `useViewer` os novos símbolos (`filters`, `activeFilterCount`, `addFilter`, `updateFilter`, `removeFilter`, `clearFilters`, `noResults`, `visibleRowCount`); montar `FilterPanel` entre `ViewerToolbar` e `viewer__body` ligando `add/update/remove/clear`; passar `:active-filter-count` à `ViewerToolbar`; passar `:has-active-filters` e `noResults` ao `ViewerTable` e ligar `clear-filters` → `clearFilters`; visibilidade do editor via estado local disparado por `toggle-filters`. Sem acesso a IndexedDB/localStorage (RF-07).
      Cobre: RF-04, RF-05, RF-06, RF-07, UI-01, UI-02, UI-03, RNF-01
      Acceptance criteria: adicionar filtro reduz as linhas renderizadas em tempo real e o contador atualiza; combinação sem resultado renderiza "Nenhuma linha encontrada" com ação de limpar; limpar filtros restaura as linhas; badge reflete a contagem; nenhum acesso a storage durável para salvar/restaurar filtros.
      Testes: `test/viewer.spec.ts` (novo ou estender, `mount`) — integração add/limpar/estado vazio/badge e ausência de persistência.
