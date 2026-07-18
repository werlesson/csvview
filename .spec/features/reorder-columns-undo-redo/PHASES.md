# Phases: reorder-columns-undo-redo

Gerado por /plan a partir de PLAN.md — view executável para
`./ralph.sh .spec/features/reorder-columns-undo-redo/PHASES.md`.

## Phase 1: Ponto de integração no histórico compartilhado e projeção pura de ordem

Antes de implementar, leia:
1. `.spec/features/reorder-columns-undo-redo/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/reorder-columns-undo-redo/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T01 — `useCellEditing.ts`: entrada discriminada, ponto de integração e dispatch de undo/redo
      Arquivos: `app/composables/useCellEditing.ts`
      Mudança: `HistoryEntry = ({ kind: 'cell' } & CellEditEntry) | { kind: 'reorder';
      previousOrder: number[]; previousPinned: number[]; nextOrder: number[]; nextPinned:
      number[] }` substituindo `CellEditEntry[]` em `undoStack`/`redoStack`; `confirmEdit`
      empilha `{ kind: 'cell', ... }`; novos holders de módulo `columnOrderRef`/
      `columnPinnedRef` e `registerColumnOrderState(order, pinned)` (ponto de integração de
      CT-02, chamado por `viewer.vue` em T04); `pushReorderEntry(previousOrder, previousPinned,
      nextOrder, nextPinned)` empilha `{ kind: 'reorder', ... }` e esvazia `redoStack`; `undo`/
      `redo` despacham por `entry.kind` (`'cell'` chama `updateCell` como hoje; `'reorder'`
      atribui `columnOrderRef.value.value`/`columnPinnedRef.value.value` a partir da entrada,
      com no-op defensivo se os ponteiros forem `null`); `isDirty` filtra só `kind === 'cell'`;
      watcher de reset (`useCellEditing.ts:69-79`) também zera os ponteiros registrados;
      exportar `registerColumnOrderState`, `pushReorderEntry`, `columnOrder`, `columnPinned`.
      `markSaved()`/`hasUnsavedChanges` ficam sem alteração de código (cobrem reorder por
      construção).
      Cobre: RF-02, RF-03, RF-04, RF-05, RF-07, CT-01, CT-02, RNF-01
      Acceptance criteria: `pushReorderEntry` empilha exatamente 1 entrada e esvazia
      `redoStack`; `undo()`/`redo()` numa entrada `reorder` restauram/reaplicam
      `previousOrder`/`previousPinned`/`nextOrder`/`nextPinned` exatos nos refs registrados;
      uma sequência intercalada edição→reorder→edição desfeita 3× reverte na ordem cronológica
      real, não agrupada por tipo; nova edição OU novo `pushReorderEntry` após `undo()` esvazia
      `redoStack`; `isDirty` nunca lança nem falso-positiva com entradas `reorder` na pilha;
      trocar de dataset zera `undoStack`/`redoStack` mistos e os ponteiros registrados (undo/redo
      pós-troca são no-op).
      Testes: `test/useCellEditing.spec.ts` — cada AC acima, incluindo `hasUnsavedChanges`
      true/false em torno de um `pushReorderEntry` isolado com `markSaved()`.

- [ ] T02 — `orderedColumnIndices`: projeção pura da ordem completa de colunas
      Arquivos: `app/services/csvParser.ts`
      Mudança: função pura exportada `orderedColumnIndices(columnCount, order, pinnedSequence):
      number[]`, ao lado de `stringifyDataset` — `effectiveOrder` cai para identidade quando
      `order.length !== columnCount` (mesma regra de `useViewer.ts:125-129`, reimplementada sem
      Vue); resultado = `pinnedSequence` (índices válidos, na sequência de fixação) seguido de
      `effectiveOrder` filtrando o que já está em `pinnedSequence` — cada índice original
      original aparece exatamente 1 vez, incluindo colunas ocultas (sem noção de `hidden`).
      Cobre: CT-03
      Acceptance criteria: grupo fixado primeiro na sequência de `pinnedSequence` (não ordenado
      numericamente), seguido do grupo não-fixado na sequência de `order`; `order` de tamanho
      divergente de `columnCount` cai para identidade; resultado cobre `[0, columnCount)`
      exatamente 1 vez sem duplicados/faltantes; índice de `pinnedSequence` fora de
      `[0, columnCount)` é ignorado sem lançar.
      Testes: `test/csvParser.spec.ts` — cada AC acima.

## Phase 2: Consumo do histórico compartilhado (save projetado + fiação de página)

Antes de implementar, leia:
1. `.spec/features/reorder-columns-undo-redo/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/reorder-columns-undo-redo/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T03 — `useSaveVersion.ts`: projeção pela ordem completa antes de `stringifyDataset`
      Arquivos: `app/composables/useSaveVersion.ts`
      Mudança: `UseSaveVersionOptions.cellEditing` estendido para incluir `columnOrder`/
      `columnPinned` (T01) ao lado de `markSaved`; `serializeCurrent()` calcula
      `orderedColumnIndices(current.header.length, columnOrder.value, [...columnPinned.value])`
      (T02), monta `projectedHeader`/`projectedRows` a partir dos índices e só então chama
      `stringifyDataset({ header: projectedHeader, rows: projectedRows }, delimiter)` —
      `stringifyDataset` em si intocado; NÃO usar `displayColumns`/`hidden`. `saveNewVersion`/
      `overwriteOriginal` continuam chamando `markSaved()` sem alteração.
      Cobre: RF-06, RF-07, CT-03, RNF-02
      Acceptance criteria: reordenar (via `columnOrder`/`columnPinned` injetados) e
      `saveNewVersion()`/`overwriteOriginal()` produzem `content` com cabeçalho E cada linha na
      ordem reordenada; grupo fixado aparece primeiro na sequência de fixação seguido do grupo
      não-fixado; sem reordenação (`columnOrder`/`columnPinned` vazios), o `content` serializado
      é idêntico ao comportamento anterior (sem regressão).
      Testes: `test/useSaveVersion.spec.ts` — cada AC acima.

- [ ] T04 — `viewer.vue`: ponto de integração explícito (registro + captura de snapshot por gesto)
      Arquivos: `app/pages/viewer.vue`
      Mudança: logo após `useViewer(() => dataset.value)`, chamar `registerColumnOrderState(order,
      pinned)` (T01) com os MESMOS refs mutáveis retornados por `useViewer`; nova função
      `onReorder(from, to)` que copia `previousOrder`/`previousPinned` ANTES de `reorderColumn
      (from, to)`, copia `nextOrder`/`nextPinned` DEPOIS, e chama `pushReorderEntry(...)` (T01)
      só quando o conteúdo difere (nenhuma chamada em gesto no-op); substituir
      `@reorder="reorderColumn"` por `@reorder="onReorder"` no template.
      Cobre: RF-01, CT-02, CT-04
      Acceptance criteria: um drag-and-drop completo que reordena empilha exatamente 1 entrada
      `{ kind: 'reorder', ... }` em `useCellEditing().undoStack` com `previousOrder`/`nextOrder`
      corretos; um `drop` na mesma posição de origem (no-op) não faz `undoStack` crescer;
      `registerColumnOrderState` é chamado com os mesmos refs que `displayColumns` deriva.
      Testes: `test/pages/viewer.spec.ts` — cada AC acima, via simulação de
      `dragstart`/`dragover`/`drop`/`dragend`.

## Phase 3: Testes de integração cross-cutting

Antes de implementar, leia:
1. `.spec/features/reorder-columns-undo-redo/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/reorder-columns-undo-redo/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T05 — Testes de integração cross-cutting (interleaving cronológico, guard, reset por troca de dataset)
      Arquivos: `test/pages/viewer.spec.ts`, `test/useUnsavedChangesGuard.spec.ts`
      Mudança: nenhuma alteração de produção — apenas testes ponta a ponta montando `viewer.vue`
      real: (1) reorder → edição de célula → reorder, seguido de 3× "Desfazer" pela toolbar,
      revertendo na ordem cronológica real; (2) reorder sem salvamento subsequente dispara o
      guard/modal de alterações não salvas ao navegar (ex. "Comparar"); (3) reorder → "Salvar
      nova versão" → reabrir o registro salvo mostra cabeçalho/linhas na ordem reordenada, e
      `hasUnsavedChanges` volta a `false`; (4) reorder sem salvar → trocar para um dataset
      diferente → reabrir o dataset original → "Desfazer" não tem efeito (histórico vazio) e a
      ordem de colunas parte do estado padrão da nova sessão.
      Cobre: RF-01, RF-05, RF-06, RF-07, RF-08
      Acceptance criteria: os 4 cenários acima passam em `test/pages/viewer.spec.ts`
      (cenário 2 também isolado em `test/useUnsavedChangesGuard.spec.ts`), sem nenhuma ação
      adicional do usuário além das simuladas.
      Testes: `test/pages/viewer.spec.ts` — os 4 cenários acima; `test/useUnsavedChangesGuard.spec.ts`
      — cenário (2) isolado.
