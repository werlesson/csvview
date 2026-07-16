# Phases: visual-highlights

Gerado por /plan a partir de PLAN.md — view executável para `./ralph.sh .spec/features/visual-highlights/PHASES.md`.

## Phase 1: Helper de duplicados, célula vazia e legenda (fundação)

Antes de implementar, leia:
1. `.spec/features/visual-highlights/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/visual-highlights/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T01 — Helper de contagem de duplicados por valor + verificação de duplicidade de linha
      Arquivos: `app/services/columnStats.ts`
      Mudança: adicionar `computeColumnDuplicateCounts(values): Map<string, number>` (uma
      passagem O(N), pula `isEmptyCell`, mapeia `value.trim() → nº de ocorrências`) e
      `rowHasDuplicateValue(row, duplicateCounts): boolean` (O(colunas), retorna `true` se algum
      valor da linha tem contagem `>1` no mapa da sua coluna) — ambos puros, framework-free.
      Cobre: RF-02, RF-03, RNF-02
      Acceptance criteria: para `["A","B","A","A"]`, `computeColumnDuplicateCounts` retorna
      `Map{A→3, B→1}`; `rowHasDuplicateValue` retorna `true` para uma linha com ao menos uma
      célula com contagem `>1` e `false` caso contrário; nenhuma comparação par a par (O(N²)).
      Testes: `test/columnStats.spec.ts` — novo `describe('duplicate-counts')` com os casos acima
      mais células vazias ignoradas na contagem.

- [ ] T03 — `CsvCell.vue`: célula vazia com padrão hachurado + rótulo "empty" (RF-01)
      Arquivos: `app/components/CsvCell.vue`, `test/CsvCell.spec.ts`
      Mudança: substituir o placeholder `'—'` itálico (`CsvCell.vue:18-24,64-67`) por um fundo
      hachurado (`repeating-linear-gradient`, tokens `--border`/`--bg-2`) e o texto "empty"
      centralizado, preservando `csv-cell--numeric`/`csv-cell--selected` (RNF-01, compõem, não se
      substituem). Atualizar `test/CsvCell.spec.ts:12` — a asserção antiga do "—" MUDA por decisão
      explícita de RF-01 (não é a regressão que RNF-01 protege, que cobre só seleção/numérico/pin).
      Cobre: RF-01, RNF-01
      Acceptance criteria: valor vazio (`null`/`undefined`/`''`) exibe o texto "empty" + o padrão
      hachurado, nunca mais "—"; uma célula vazia numérica mantém alinhamento à direita; uma
      célula vazia numa coluna selecionada mantém `csv-cell--selected`.
      Testes: `test/CsvCell.spec.ts` — placeholder "empty" + hachurado; composição com
      `numeric`/`selected` preservada.

- [ ] T05 — `HighlightLegend.vue` (novo componente): legenda fixa dos 4 tipos de destaque (UI-01)
      Arquivos: `app/components/HighlightLegend.vue` (novo), `test/HighlightLegend.spec.ts` (novo)
      Mudança: componente apresentacional, sem lógica de negócio, com 4 pares swatch+rótulo fixos:
      "vazio" (hachurado), "duplicado" (`--accent`), "negativo" (`--error`), "data inválida"
      (`--warning`) — fiel a `.spec/init/design/screen-5-highlights.png`. Sem props dinâmicas.
      Cobre: UI-01
      Acceptance criteria: o componente renderiza exatamente 4 pares swatch+rótulo, com os
      rótulos "vazio", "duplicado", "negativo", "data inválida".
      Testes: `test/HighlightLegend.spec.ts` — conta 4 pares swatch+rótulo com os textos esperados.

## Phase 2: Composable e props restantes de CsvCell

Antes de implementar, leia:
1. `.spec/features/visual-highlights/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/visual-highlights/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T02 — Expor `columnDuplicateCounts` e `isRowDuplicate` em `useViewer`
      Arquivos: `app/composables/useViewer.ts`
      Mudança: `computed` `columnDuplicateCounts: Map<string, number>[]` (por índice de coluna,
      paralelo a `columnStats`) usando `computeColumnDuplicateCounts` sobre `dataset.value`
      **completo** (não `filteredRows`/`sortedRows`) e uma função `isRowDuplicate(row: string[]):
      boolean` que envolve `rowHasDuplicateValue(row, columnDuplicateCounts.value)`. Adicionar
      ambos ao retorno do composable.
      Cobre: RF-02, RF-03
      Acceptance criteria: `columnDuplicateCounts` não muda quando um filtro/busca reduz
      `filteredRows` (RF-02: "dup ×3" continua "dup ×3", não vira "dup ×2"); `isRowDuplicate`
      retorna `true`/`false` corretamente para linhas de um dataset fixo; ocultar uma coluna não
      altera `columnDuplicateCounts` nem `isRowDuplicate`.
      Testes: `test/useViewer.spec.ts` — os três casos acima.

- [ ] T04 — `CsvCell.vue`: badge de duplicado, texto negativo e borda de data inválida
      Arquivos: `app/components/CsvCell.vue`, `test/CsvCell.spec.ts`
      Mudança: props opcionais `dupCount?: number`, `negative?: boolean`, `invalidDate?: boolean`.
      `dupCount > 1` exibe badge "dup ×N" (`--accent`/`--accent-soft`); `negative` aplica `--error`
      ao texto (mesmo tom de `signClass`, `StatsPanel.vue:92-93`); `invalidDate` aplica borda
      `--warning` + ícone + prefixo "⚠ " ao valor bruto (já sem reformatação, `CsvCell.vue:18-22`).
      As três compõem com `csv-cell--empty`/`--numeric`/`--selected` (RNF-01), sem sobrescrever.
      Cobre: RF-02, RF-04, RF-05, RNF-01
      Acceptance criteria: `dupCount={3}` exibe "dup ×3"; `dupCount` ausente/`1` não exibe badge;
      `negative` aplica cor `--error`; `invalidDate` aplica borda + "⚠ " mantendo o valor bruto
      exato; as três props coexistem com `numeric`/`selected` sem removê-las.
      Testes: `test/CsvCell.spec.ts` — badge, cor negativa, borda+ícone de data inválida,
      composição com `numeric`/`selected`.

## Phase 3: Fiação central em ViewerTable

Antes de implementar, leia:
1. `.spec/features/visual-highlights/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/visual-highlights/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T06 — `ViewerTable.vue`: fiar os sinais de destaque por célula e o destaque de linha duplicada
      Arquivos: `app/components/ViewerTable.vue`, `test/ViewerTable.spec.ts`
      Mudança: props `columnDuplicateCounts?: Map<string, number>[]` e `isRowDuplicate?: (row:
      string[]) => boolean`. No corpo virtualizado: `dupCount` via
      `columnDuplicateCounts?.[column.index]?.get(String(value).trim())`; `negative` via
      `column.type === 'number' && parseNumber(value) !== null && parseNumber(value)! < 0`
      (importar `parseNumber`); `invalidDate` via `column.type === 'date' && !isEmptyCell(value)
      && !isDateValue(value)` (importar `isEmptyCell`/`isDateValue`) — repassados ao `CsvCell`.
      Classe `viewer-table__row--duplicate` na `<tr>` quando `isRowDuplicate?.(rows[virtualRow
      .index])` for `true` (RF-03), com `background-color` distinguível do padrão e do hover
      (`ViewerTable.vue:675-677`), aditiva (não substitui o hover). Preservar
      `csv-cell--selected`/`--numeric` e o offset sticky de pin (`ViewerTable.vue:193-206`)
      inalterados (RNF-01).
      Cobre: RF-02, RF-03, RF-04, RF-05, RNF-01
      Acceptance criteria: célula com valor duplicado recebe `dupCount` correto; linha com
      `isRowDuplicate` true recebe `viewer-table__row--duplicate` com fundo diferente do padrão e
      do hover; célula `number` negativa recebe `negative=true`; célula `date` inválida recebe
      `invalidDate=true`; as suítes existentes de seleção/numérico/pin/virtualização
      (`test/ViewerTable.spec.ts:185-597`) continuam passando sem alteração de asserção.
      Testes: `test/ViewerTable.spec.ts` — os casos acima mais a regressão de contagem de `<tr>`
      limitada (invariante de virtualização).

## Phase 4: Legenda integrada e fiação da página

Antes de implementar, leia:
1. `.spec/features/visual-highlights/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/visual-highlights/PLAN.md` — decomposição completa, dependências e riscos
3. `.spec/features/visual-highlights/PLAN.md#t05` — HighlightLegend.vue (T05) já implementado na Fase 1

- [ ] T07 — `ViewerTable.vue`: renderizar `HighlightLegend` fixa acima do cabeçalho (UI-01)
      Arquivos: `app/components/ViewerTable.vue`, `test/ViewerTable.spec.ts`
      Mudança: importar e renderizar `HighlightLegend` dentro de `.viewer-table`, acima do
      `<thead>`, sticky (mesma técnica de `.viewer-table__head`, `ViewerTable.vue:489-500`) — a
      legenda permanece visível durante o scroll vertical; o `<thead>` ajusta seu `top` para não
      sobrepor a legenda.
      Cobre: UI-01
      Acceptance criteria: a legenda está presente no DOM montado, acima do `<thead>`, e contém
      exatamente 4 pares swatch+rótulo.
      Testes: `test/ViewerTable.spec.ts` — presença e posição da legenda antes do `<thead>`.

- [ ] T08 — `viewer.vue`: repassar `columnDuplicateCounts`/`isRowDuplicate` ao `ViewerTable`
      Arquivos: `app/pages/viewer.vue`
      Mudança: desestruturar `columnDuplicateCounts`/`isRowDuplicate` de `useViewer(...)` e
      passá-los como props ao `<ViewerTable>` (ao lado de `displayColumns`/`sortedRows` já
      fiados, `viewer.vue:118-132`).
      Cobre: RF-02, RF-03
      Acceptance criteria: a página monta sem erro com um dataset contendo as quatro condições e
      o `ViewerTable` recebe as novas props não vazias.
      Testes: `test/pages/viewer.spec.ts` — montagem com dataset de teste e props não vazias.

## Phase 5: Integração final (RF-06)

Antes de implementar, leia:
1. `.spec/features/visual-highlights/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/visual-highlights/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T09 — Teste de integração: todos os destaques no primeiro render, sem interação (RF-06)
      Arquivos: `test/pages/viewer.spec.ts` (ou `test/ViewerTable.spec.ts`)
      Mudança: nenhuma mudança de produção — task de teste dedicada, cobrindo a exigência
      combinada que nenhuma task anterior isoladamente valida.
      Cobre: RF-06
      Acceptance criteria: com um dataset fixo contendo as quatro condições (vazio, duplicado,
      negativo, data inválida) e SEM nenhuma interação/clique prévio, os quatro destaques e a
      legenda aparecem simultaneamente no primeiro render montado.
      Testes: montagem única com dataset fixo, asserção simultânea dos quatro destaques + legenda,
      sem nenhum `trigger`/`click` antes das asserções.
