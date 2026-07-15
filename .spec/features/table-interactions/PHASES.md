# Phases: table-interactions

Gerado por /plan a partir de PLAN.md — view executável para `./ralph.sh .spec/features/table-interactions/PHASES.md`.

## Phase 1: parseDate no serviço columnStats (pt-BR DMY)

Antes de implementar, leia:
1. `.spec/features/table-interactions/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/table-interactions/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T01 — parseDate: conversão de célula-data em valor comparável (pt-BR DMY)
      Arquivos: `app/services/columnStats.ts`
      Mudança: adicionar `parseDate(value: Cell): number | null` pura, reusando `DATE_ISO_RE`/`DATE_DMY_RE` (`columnStats.ts:83-117`); ISO = ano/mês/dia; ramo ambíguo `DD..MM..YYYY` assume dia/mês/ano (DMY) para a coluna inteira; vazio/não-data → null. Não alterar `isDateValue`/`inferColumnType`.
      Cobre: RF-03
      Acceptance criteria: `parseDate('2026-01-02') < parseDate('2026-01-10')`; `parseDate('03/02/2026')` = 3 de fevereiro (DMY); `parseDate('')`/`null`/`'foo'` → null.
      Testes: `test/columnStats.spec.ts` — ISO ordenável, DMY para ambíguo, null para vazio/não-data.

## Phase 2: Comparador por tipo inferido com vazios ao fim

Antes de implementar, leia:
1. `.spec/features/table-interactions/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/table-interactions/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T02 — Comparador por tipo inferido com vazios ao fim
      Arquivos: `app/services/columnStats.ts`
      Mudança: adicionar `makeComparator(type, direction)` puro; vazios por `isEmptyCell` (`columnStats.ts:63`) sempre ao fim em qualquer direção; `number` via `parseNumber`, `date` via `parseDate` (T01), `text` estável (localeCompare/code-point); empates → 0 (sort estável do V8).
      Cobre: RF-03
      Acceptance criteria: `number` ordena `2 < 10 < 100` (não como texto); `date` ordena `2026-01-02` antes de `2026-01-10`; em asc e desc os vazios ficam após os preenchidos.
      Testes: `test/columnStats.spec.ts` — casos number, date e vazios-ao-fim nas duas direções.

## Phase 3: Máquina de estados de ordenação e sortedRows em useViewer

Antes de implementar, leia:
1. `.spec/features/table-interactions/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/table-interactions/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T03 — Máquina de estados de ordenação + sortedRows em useViewer
      Arquivos: `app/composables/useViewer.ts`
      Mudança: adicionar `sortKeys` (chave = índice original), `sortColumn(index)` (clique simples RF-01: chave única, ciclo asc→desc→sem-ordenação) e `sortColumnAdditive(index)` (Shift RF-02: adiciona ao fim preservando prioridade, remove ao chegar em sem-ordenação); `computed sortedRows` derivado de `filteredRows` (`useViewer.ts:93-101`), síncrono (RNF-02), aplicando `makeComparator` (T02) por tipo em prioridade decrescente; só em memória (RNF-04). Exportar no return.
      Cobre: RF-01, RF-02, RF-03, RNF-02, RNF-04
      Acceptance criteria: 3× `sortColumn(i)` → asc, desc, ordem original; multi-sort + `sortColumn` reduz a uma chave; `sortColumnAdditive(A)` então `(B)` ordena por A e, em empate, por B (A=1/B=2); 3º `sortColumnAdditive(A)` remove A e B vira prioridade 1; `sortedRows` deriva de `filteredRows`.
      Testes: `test/useViewer.spec.ts` — ciclo single, redução multi→single, adição/remoção de chave, prioridade, derivação da busca.

## Phase 4: Estado de larguras de coluna em useViewer

Antes de implementar, leia:
1. `.spec/features/table-interactions/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/table-interactions/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T04 — Estado de larguras de coluna em useViewer (chave = índice original)
      Arquivos: `app/composables/useViewer.ts`
      Mudança: adicionar `widths: Map<number, number>` (chave = índice original, sobrevive a ocultar/reexibir/reordenar RF-04) e `resizeColumn(index, width)` com `Math.max(48, width)` (mínimo 48px, sem máximo); helper `columnWidth(index)` (fallback 180). Só em memória (RNF-04), O(1) sem re-parse/cópia de linhas (RNF-03). Exportar no return.
      Cobre: RF-04, RNF-03, RNF-04
      Acceptance criteria: `resizeColumn(0,300)` → `columnWidth(0)===300`; `resizeColumn(0,10)` clampa em 48; alterar visibilidade de outra coluna não muda `columnWidth(0)`.
      Testes: `test/useViewer.spec.ts` — set/get largura, clamp em 48, chave por índice original resiste a toggle de visibilidade.

## Phase 5: Estado de ordem e pin com displayColumns em useViewer

Antes de implementar, leia:
1. `.spec/features/table-interactions/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/table-interactions/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T05 — Estado de ordem + pin e displayColumns em useViewer
      Arquivos: `app/composables/useViewer.ts`
      Mudança: adicionar `order: number[]` (posição→índice original) e `pinned: Set<number>` com registro da sequência de fixação (RF-06); `pinColumn`/`unpinColumn`/`togglePin`; `reorderColumn(from,to)` que reposiciona dentro do grupo (fixado vs não-fixado) respeitando o limite entre grupos (RF-05); `computed displayColumns` = visíveis = [fixadas na ordem de fixação] ++ [não-fixadas na ordem de `order`], anotadas com `pinned`/largura. Adicionar `pinned` a `ViewerColumn`. Só em memória (RNF-04), O(colunas) sem re-parse/cópia O(linhas) (RNF-03). Exportar no return.
      Cobre: RF-05, RF-06, RNF-03, RNF-04
      Acceptance criteria: `reorderColumn(2,0)` move coluna da posição 3 para 1 em `displayColumns`; soltar não-fixada à esquerda de fixada mantém-na no grupo não-fixado; `pinColumn(C)` então `pinColumn(A)` → displayColumns inicia C, A antes das não-fixadas; ocultar/reexibir preserva ordem/pin.
      Testes: `test/useViewer.spec.ts` — reorder intra-grupo, limite entre grupos, ordem de fixação, persistência por índice original.

## Phase 6: ViewerTable — ordenação por clique, indicadores e affordance de estatísticas

Antes de implementar, leia:
1. `.spec/features/table-interactions/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/table-interactions/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T06 — ViewerTable: ordenação por clique, indicadores/prioridade e affordance de estatísticas
      Arquivos: `app/components/ViewerTable.vue`
      Mudança: clique simples no `<th>` (`ViewerTable.vue:93-100`) → emitir `sort` (RF-01); `event.shiftKey` → `sort-additive` (RF-02). Prop `sortKeys` para renderizar indicador asc/desc por forma/ícone (UI-01) e número de prioridade em multi-sort (UI-02). Affordance dedicado (ícone/botão) para `select-column` de stats (UI-06), distinto do clique de ordenação. Manter `useVirtualizer` intacto (RF-07). Estilo via `<style scoped>` + tokens (convenção de-facto do Viewer).
      Cobre: RF-01, RF-02, UI-01, UI-02, UI-06
      Acceptance criteria: clique simples ordena e não abre stats; cabeçalho ordenado mostra ícone asc/desc distinguível por forma; multi-sort mostra prioridade correta por cabeçalho; affordance dedicado abre/atualiza stats sem alterar ordenação. Ref design: `.spec/init/design/screen-2-visualizador.png`.
      Testes: `test/ViewerTable.spec.ts` — emissão de sort/sort-additive, render de indicador e prioridade, affordance de stats separado (atualizado em T12).

## Phase 7: ViewerTable — redimensionamento por arraste e larguras por coluna

Antes de implementar, leia:
1. `.spec/features/table-interactions/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/table-interactions/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T07 — ViewerTable: redimensionamento por arraste e larguras por coluna
      Arquivos: `app/components/ViewerTable.vue`
      Mudança: handle de resize (~6px na borda direita do `<th>`) com Pointer Events emitindo `resize(index, width)` (para `resizeColumn`, T04), cursor `col-resize` distinto (UI-03). Substituir `gridWidth` uniforme (`ViewerTable.vue:55`) pela soma das larguras por coluna; aplicar `--col-w` por `<th>`/célula a partir da largura de cada coluna (`ViewerTable.vue:139`). Preservar virtualização (RF-07).
      Cobre: RF-04, UI-03, RF-07
      Acceptance criteria: arrastar a borda muda a largura renderizada e ela permanece ao rolar/ordenar/alternar visibilidade; não reduz abaixo de 48px; ponteiro na borda mostra affordance de resize distinto da ordenação/arraste. Ref design: `.spec/init/design/screen-2-visualizador.png`.
      Testes: `test/ViewerTable.spec.ts` — emissão de resize e largura por coluna refletida (coberto em T12).

## Phase 8: ViewerTable — reordenação de colunas por arraste com feedback

Antes de implementar, leia:
1. `.spec/features/table-interactions/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/table-interactions/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T08 — ViewerTable: reordenação de colunas por arraste com feedback
      Arquivos: `app/components/ViewerTable.vue`
      Mudança: corpo do `<th>` arrastável (Pointer Events/drag) emitindo `reorder(from, to)` (para `reorderColumn`, T05) ao concluir, refletindo a ordem imediatamente via `displayColumns` (RF-05); feedback visual da coluna movida e/ou posição-alvo (UI-04); zona de arraste distinta do handle de resize (UI-03) e do affordance de stats (UI-06). Preservar virtualização (RF-07).
      Cobre: RF-05, UI-04, RF-07
      Acceptance criteria: arrastar coluna da posição 3 para 1 re-renderiza cabeçalho/células nessa posição sem recarregar; há indicação visível da coluna movida ou do ponto de inserção; soltar não-fixada à esquerda de fixada não a insere no grupo fixado. Ref design: `.spec/init/design/screen-2-visualizador.png`.
      Testes: `test/ViewerTable.spec.ts` — emissão de reorder e ordem refletida (coberto em T12).

## Phase 9: ViewerTable pin sticky e controle de pin na Toolbar

Antes de implementar, leia:
1. `.spec/features/table-interactions/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/table-interactions/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T09 — ViewerTable: renderização de pin (sticky) e controle de pin no cabeçalho
      Arquivos: `app/components/ViewerTable.vue`
      Mudança: renderizar colunas fixadas com `position: sticky; left: <offset>` acumulando larguras das fixadas à esquerda (RF-06), estado visual "fixada" distinto (UI-05a); ícone/botão de pin no `<th>` emitindo `toggle-pin(index)` (para `togglePin`, T05); consumir `displayColumns` (fixadas primeiro, na ordem de fixação); preservar alinhamento das células fixadas no corpo virtualizado (RF-07).
      Cobre: RF-06, UI-05, RF-07
      Acceptance criteria: com scroll horizontal a coluna fixada permanece na borda esquerda enquanto as não-fixadas rolam sob ela; fixar C depois A renderiza C à esquerda de A antes das não-fixadas; a fixada é visualmente distinguível; o botão de pin alterna a fixação. Ref design: `.spec/init/design/screen-2-visualizador.png`.
      Testes: `test/ViewerTable.spec.ts` — offset sticky por acúmulo de larguras e emissão de toggle-pin (coberto em T12).
- [ ] T10 — ViewerToolbar: controle de pin no menu "Colunas" reusando ColumnChip
      Arquivos: `app/components/ViewerToolbar.vue`
      Mudança: em cada item do menu "Colunas" (`ViewerToolbar.vue:68-81`) adicionar controle equivalente de fixar/desfixar emitindo `toggle-pin(index)`, refletindo o estado pinned reusando a variação de `ColumnChip.vue` (`ColumnChip.vue:26-40`). Requer `pinned` em `ViewerColumn` (T05). Mesmo estado do cabeçalho (UI-05).
      Cobre: UI-05
      Acceptance criteria: fixar/desfixar pelo menu "Colunas" produz o mesmo resultado que pelo cabeçalho (mesmo estado); o item de coluna fixada é visualmente distinguível reusando a variação `pinned`. Ref design: `.spec/init/design/screen-2-visualizador.png`.
      Testes: `test/ViewerToolbar.spec.ts` — emissão de toggle-pin e render da variação pinned no item de coluna.

## Phase 10: viewer.vue — fiação ponta-a-ponta das novas interações

Antes de implementar, leia:
1. `.spec/features/table-interactions/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/table-interactions/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T11 — viewer.vue: fiação ponta-a-ponta das novas interações
      Arquivos: `app/pages/viewer.vue`
      Mudança: extrair de `useViewer` os novos itens (`sortKeys`, `sortColumn`, `sortColumnAdditive`, `sortedRows`, `resizeColumn`, `columnWidth`, `reorderColumn`, `togglePin`, `displayColumns`); passar `displayColumns` como `:columns` e `sortedRows` como `:rows` ao ViewerTable (`viewer.vue:53-58`); ligar `@sort`, `@sort-additive`, `@resize`, `@reorder`, `@toggle-pin`, `@select-column`; passar `columns` (com pinned) e `@toggle-pin` ao ViewerToolbar (`viewer.vue:45-50`).
      Cobre: RF-01, RF-02, RF-04, RF-05, RF-06, UI-05, UI-06
      Acceptance criteria: no Viewer real, ordenar/redimensionar/reordenar/fixar pelo cabeçalho e o pin pelo menu "Colunas" produzem o efeito das ACs de RF-01..RF-06; a tabela recebe linhas ordenadas e colunas na ordem de exibição; recarregar descarta todo o estado (RNF-04).
      Testes: validação de integração via `yarn test` (specs de useViewer/ViewerTable/ViewerToolbar verdes com a nova fiação).

## Phase 11: Invariante de virtualização sob todas as interações

Antes de implementar, leia:
1. `.spec/features/table-interactions/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/table-interactions/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T12 — Invariante de virtualização sob todas as interações
      Arquivos: `test/ViewerTable.spec.ts`
      Mudança: adicionar caso(s) garantindo que, com dataset grande e ordenação/resize/reorder/pin aplicados, a contagem de `<tr>` de corpo no DOM fica limitada a (visíveis + overscan=12, `ViewerTable.vue:64`) e não cresce com o total de linhas (RF-07, RNF-01); ajustar specs existentes para a nova semântica de clique (sort em vez de select) e novas props, mantendo `@vue/test-utils mount` (regra 4).
      Cobre: RF-07, RNF-01
      Acceptance criteria: com N grande de linhas e cada interação aplicada, `<tr>` de corpo permanece na ordem de (visíveis + 12) independente de N; specs de ViewerTable passam com a nova semântica (`yarn test`).
      Testes: `test/ViewerTable.spec.ts` — contagem de `<tr>` limitada sob interações; possível stub de dimensões do scroller no happy-dom.
