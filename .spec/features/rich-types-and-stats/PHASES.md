# Phases: rich-types-and-stats

Gerado por /plan a partir de PLAN.md — view executável para `./ralph.sh .spec/features/rich-types-and-stats/PHASES.md`.

## Phase 1: Motor de inferência e métricas (columnStats.ts)

Antes de implementar, leia:
1. `.spec/features/rich-types-and-stats/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/rich-types-and-stats/PLAN.md` — decomposição completa, dependências e riscos

Nota de coordenação: a feature `table-interactions` também edita `app/services/columnStats.ts` — não remova símbolos exportados; todas as mudanças aqui são aditivas.

- [ ] T01 — Ampliar contratos de tipo `ColumnType` e `NumericStats`
      Arquivos: `app/services/columnStats.ts`
      Mudança: expandir `ColumnType` (linha 16) para `'number' | 'date' | 'boolean' | 'email' | 'url' | 'text'` (preservar number/date/text); adicionar a `NumericStats` (linha 29) os campos obrigatórios `sum: number`, `median: number`, `numericKind: 'integer' | 'decimal'` com JSDoc; manter nome/tipo/semântica dos campos existentes; sem lógica nova ainda. Inteiro/decimal NÃO são membros de `ColumnType`.
      Cobre: CT-01, CT-02, RF-06
      Acceptance criteria: `ColumnType` inclui boolean/email/url preservando number/date/text; `NumericStats` tem sum/median/numericKind obrigatórios; `yarn test` continua verde (nenhum teste existente afrouxado).
      Testes: `test/columnStats.spec.ts` — suíte existente permanece verde; casos de valor chegam em T04.
- [ ] T02 — Helpers puros: reconhecedores e detecção inteiro/decimal
      Arquivos: `app/services/columnStats.ts`
      Mudança: adicionar (no padrão `parseNumber`/`isDateValue`, com regex/allowlists constantes no topo) `isBooleanValue` (allowlist case-insensitive `{true,false,sim,não,yes,no}`; `0`/`1` NÃO booleano), `isEmailValue` (`^[^@\s]+@[^@\s]+\.[^@\s]+$`), `isUrlValue` (apenas `http://`/`https://`) e o helper compartilhado `numericKindOf(numbers)` (decimal se algum `!Number.isInteger(n)`, senão integer). Puros, sem I/O nem locale.
      Cobre: RF-01, RF-02, RNF-01
      Acceptance criteria: reconhecedores retornam true/false corretos (e-mail com espaço e `ftp://` rejeitados; `0`/`1` não-booleano); `numericKindOf([1,2,-3])==='integer'`, `numericKindOf([1,2.5])==='decimal'`; `["1.0","5.00","2e3"]` via parse → integer.
      Testes: `test/columnStats.spec.ts` — positivos/negativos dos três reconhecedores e de `numericKindOf`.
- [ ] T03 — Precedência determinística em `inferColumnType`
      Arquivos: `app/services/columnStats.ts`
      Mudança: reescrever `inferColumnType` (linha 127) na sequência por coluna número → data → booleano → e-mail → URL → texto (fallback terminal); ignorar células vazias via `isEmptyCell`; coluna sem preenchidas → text; passagem única O(N); documentar a precedência em JSDoc. Inteiro/decimal permanecem `type === 'number'`.
      Cobre: RF-02, RF-03, RNF-01, RNF-02
      Acceptance criteria: `["a@b.com","c@d.org"]`→email; `["https://x.io","http://y.io/p"]`→url; tokens booleanos→boolean; `["0","1","1","0"]`→number; `["1","2","","3"]`→number; `["",""]`→text; misto→text; mesmo input produz o mesmo tipo em duas execuções; sem operação O(N²).
      Testes: `test/columnStats.spec.ts` — precedência, vazias ignoradas e determinismo.
- [ ] T04 — Métricas numéricas: soma, mediana e numericKind
      Arquivos: `app/services/columnStats.ts`
      Mudança: estender `computeNumericStats` (linha 197) com `sum` (acumulada no laço existente), `median` (ordenar cópia dos `numbers`; valor central, média dos dois centrais quando par) e `numericKind` (via `numericKindOf` de T02); manter min/max/mean/histogram idênticos; `numeric` presente só quando `type === 'number'`.
      Cobre: RF-01, RF-04, CT-02, RNF-02
      Acceptance criteria: `[1,2,3,4]`→sum=10, median=2.5; `[5,1,3]`→sum=9, median=3; numericKind integer vs decimal correto; min/max/mean/histogram inalterados para os inputs já testados; mediana é a única operação O(N log N) introduzida.
      Testes: `test/columnStats.spec.ts` — sum/median/numericKind e paridade de min/max/mean/histogram.

## Phase 2: Reflexo em componentes e regressão

Antes de implementar, leia:
1. `.spec/features/rich-types-and-stats/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/rich-types-and-stats/PLAN.md` — decomposição completa, dependências e riscos
3. `.spec/init/design/screen-2-visualizador.png` — referência visual do painel e chips

- [ ] T05 — `StatsPanel`: rótulos pt-BR dos novos tipos + linhas soma/mediana
      Arquivos: `app/components/StatsPanel.vue`
      Mudança: tornar `TYPE_LABELS: Record<ColumnType, string>` (linha 29) exaustivo — manter `number: 'número'`, `date`, `text`; adicionar `boolean: 'booleano'`, `email: 'e-mail'`, `url: 'URL'`. Derivar rótulo de `type === 'number'` de `numericKind` (`inteiro`/`decimal`) via novo `computed`. Adicionar ao bloco `stats-panel__rows` (linhas 107-127) duas linhas `data-metric="sum"` (Soma) e `data-metric="median"` (Mediana), reutilizando `formatNumber`/`signClass`. Componente permanece fino/apresentacional.
      Cobre: UI-01
      Acceptance criteria: badge mostra `e-mail`/`URL`/`booleano`; coluna numérica inteira mostra `inteiro`, decimal mostra `decimal`; `[data-metric="sum"]` e `[data-metric="median"]` exibem os valores do motor; `yarn test` verde.
      Testes: `test/StatsPanel.spec.ts` — rótulos dos novos tipos, inteiro/decimal e linhas soma/mediana.
- [ ] T06 — `ColumnChip`: ampliar a união de tipo sem importar o motor
      Arquivos: `app/components/ColumnChip.vue`
      Mudança: ampliar a união local `ColumnType` (linhas 12-18) com `'integer' | 'decimal' | 'boolean' | 'email' | 'url'`, preservando `id`, `amount`, `status`, `date`, `number`, `text`. NÃO importar `ColumnType` de `~/services/columnStats`. Sem mudança de template/estilo.
      Cobre: UI-02
      Acceptance criteria: `<ColumnChip type="integer|decimal|boolean|email|url" />` renderiza o texto do tipo em `.chip__type` sem string vazia e sem erro de tipo; `id`/`amount`/`status` continuam aceitos; nenhum import do serviço no componente.
      Testes: `test/ColumnChip.spec.ts` — render dos cinco tipos novos e dos membros de design system preservados.
- [ ] T07 — Regressão RF-05/RF-06: alinhamento numérico e suíte verde
      Arquivos: `test/ViewerTable.spec.ts`
      Mudança: adicionar caso cobrindo colunas inteira e decimal — ambas mantêm `type === 'number'`, logo o cabeçalho recebe `viewer-table__th--numeric` e a célula recebe `numeric` (paridade com o caso atual em ViewerTable.spec.ts:54-57); colunas text/date/boolean/email/url NÃO recebem alinhamento à direita. Sem editar `ViewerTable.vue`/`useViewer.ts`. Rodar `yarn test` e confirmar suíte integral verde.
      Cobre: RF-05, RF-06, RNF-03
      Acceptance criteria: coluna integer e decimal alinhadas à direita; demais tipos não; `type === 'number'` intacto em `ViewerTable`/`useViewer` sem edição de código; `yarn test` verde end-to-end.
      Testes: `test/ViewerTable.spec.ts` — alinhamento integer/decimal e não-alinhamento dos demais; suíte completa verde.
