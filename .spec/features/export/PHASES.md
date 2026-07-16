# Phases: export

Gerado por /plan a partir de PLAN.md — view executável para `./ralph.sh .spec/features/export/PHASES.md`.

## Phase 1: Geradores de conteúdo por formato e gatilho da toolbar

Antes de implementar, leia:
1. `.spec/features/export/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/export/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T01 — Geradores puros CSV/JSON/Markdown/SQL + projeção de colunas + nome de tabela
      Arquivos: `app/services/exportData.ts`
      Mudança: Implementar `projectColumns`, `generateCsv`, `generateJson`, `generateMarkdown`, `generateSql` e `deriveTableName` como funções puras framework-free (ver PLAN.md T01 para as assinaturas e regras completas de cada gerador — cabeçalho condicional, aspas RFC 4180 vs "aspas em todos os campos", passthrough sem coerção no JSON, escape de `|`/quebra de linha no Markdown, aspas simples/comentário no SQL, célula vazia por convenção nativa de cada formato, sanitização do nome de tabela).
      Cobre: RF-05, RF-06, RF-08, RF-09, RF-11, RF-12, RF-13, RF-14, RF-17, CT-01
      Acceptance criteria: cada gerador produz exatamente a string descrita nos ACs de RF-09/RF-11/RF-12/RF-13/RF-17 do SPEC; `deriveTableName('transactions 2026.csv')` === `'transactions_2026'`; `deriveTableName('2026-vendas!.csv')` não começa com dígito e só contém `[A-Za-z0-9_]`; `projectColumns` nunca inclui um índice fora da lista passada.
      Testes: `test/exportData.spec.ts` — um `describe` por gerador (cabeçalho on/off, aspas-todas vs RFC 4180 mínimo, passthrough JSON, escape Markdown, escape/comentário SQL, célula vazia por formato, casos de borda de `deriveTableName`).

- [ ] T02 — Gerador XLSX (lib de terceiros via `import()` dinâmico) + truncamento
      Arquivos: `app/services/exportXlsx.ts`, `package.json`, `yarn.lock`
      Mudança: Adicionar a lib de terceiros (ex. SheetJS `xlsx`) como dependência de runtime; implementar `generateXlsx(header, rows, options)` com `await import('xlsx')` **dentro** da função (nunca no topo do módulo) para isolar o chunk (RNF-02); montar planilha única com cabeçalho condicional (RF-10), célula vazia sem `'—'` (RF-17) e truncamento em 1.048.576 linhas com `truncated: true` sem lançar erro nem dividir em planilhas (RF-18).
      Cobre: RF-10, RF-17, RF-18, RNF-02, CT-01
      Acceptance criteria: o `ArrayBuffer` retornado abre como `.xlsx` de planilha única válido; com escopo > 1.048.576 linhas, `truncated === true` e o total de linhas (dados + cabeçalho) é exatamente `1_048_576`; dentro do limite, `truncated === false` e nenhuma linha é descartada; inspecionando os chunks do build de produção, o código da lib XLSX não aparece nos chunks eager de Upload/Viewer.
      Testes: `test/exportXlsx.spec.ts` — geração com/sem cabeçalho, célula vazia, truncamento acima/dentro do limite (dataset sintético ou mock de `rows.length`), mock de `import('xlsx')` onde necessário em `happy-dom`.

- [ ] T03 — Botão "Exportar" na `ViewerToolbar`
      Arquivos: `app/components/ViewerToolbar.vue`
      Mudança: Adicionar um controle "Exportar" em `toolbar__meta`, entre os controles existentes e o contador de linhas, emitindo `open-export` ao clique; atualizar o comentário em `ViewerToolbar.vue:16-17` que hoje marca a exportação como fora do escopo do MVP.
      Cobre: UI-04
      Acceptance criteria: o controle "Exportar" está presente entre os controles existentes e o contador de linhas; um clique emite `open-export` exatamente uma vez, sem alterar nenhum outro estado da toolbar.
      Testes: `test/ViewerToolbar.spec.ts` — novo caso: renderiza o botão "Exportar" e emite `open-export` ao clique.

## Phase 2: Composable de orquestração da exportação

Antes de implementar, leia:
1. `.spec/features/export/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/export/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T04 — Composable `useExportModal` (orquestração)
      Arquivos: `app/composables/useExportModal.ts`
      Mudança: Expor `format`/`scope`/`includeHeader`/`quoteAll` (com defaults `'csv'`/`'filtered'`/`true`/`false`), `resetSelection()`, `optionsEnabled` (por formato, RF-02–RF-06), `scopeCounts` (via `formatRowCount`, UI-02), `downloadLabel` (UI-05), `rowsForScope` (sempre `filteredRows`/`dataset.rows`, nunca `sortedRows` — RF-07), `xlsxWarning` (RF-18) e `download()` — projeta `header`/`rows` via `displayColumns` (RF-08), chama o gerador do formato atual (T01 síncrono ou T02 assíncrono), monta o `Blob` com MIME fixo por formato (CT-02) e dispara o download nomeado `<fileName sem extensão>.<ext>` (RF-15) via `URL.createObjectURL` + `<a download>`, sem nenhuma chamada de rede (RNF-01).
      Cobre: RF-01, RF-02, RF-03, RF-04, RF-05, RF-06, RF-07, RF-08, RF-14, RF-15, RF-16, RF-18, UI-02, UI-05, CT-02, RNF-01, RNF-02
      Acceptance criteria: alternar `format` atualiza `optionsEnabled`/`downloadLabel` imediatamente; `rowsForScope` reflete exatamente o escopo escolhido; `download()` nunca inclui índices de coluna fora de `displayColumns.value`; após `resetSelection()`, os valores voltam aos defaults (`csv`/`filtered`/`true`/`false`); `download()` em XLSX com escopo > 1.048.576 linhas define `xlsxWarning` com mensagem não vazia.
      Testes: `test/useExportModal.spec.ts` — uma suíte por RF coberto, incl. fixtures com colunas ocultas/fixadas/reordenadas (RF-08) e um dataset sintético > 1.048.576 linhas (RF-18).

## Phase 3: Componente do modal (Screen 4)

Antes de implementar, leia:
1. `.spec/features/export/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/export/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T05 — Componente `ExportModal.vue` (Screen 4)
      Arquivos: `app/components/ExportModal.vue`
      Mudança: Modal seguindo o padrão de overlay de `FilterPanel.vue` (backdrop `@click.self`, `Transition`, `role="dialog"`, foco inicial via `watch(open)` para o Escape funcionar); props `open`/`filteredRows`/`allRows`/`displayColumns`/`fileName`; instancia `useExportModal` (T04) internamente; template fiel à Screen 4 — título "Exportar dados", subtítulo "Escolha o formato e o escopo.", 5 abas de formato, 2 rádios de escopo com contagem, 2 toggles de opção com estado `disabled` (UI-03), banner de aviso de truncamento (`xlsxWarning`), rodapé Cancelar/Baixar com rótulo dinâmico (UI-05); todo caminho de dismiss (X/Cancelar/backdrop/Escape) chama `resetSelection()` e `emit('close')` sem gerar/baixar nada (RF-16); "Baixar" chama `download()` e depois `emit('close')`.
      Cobre: RF-01, RF-02, RF-03, RF-04, RF-05, RF-06, RF-16, RF-18, UI-01, UI-02, UI-03, UI-05
      Acceptance criteria: com `open=true`, renderiza título, subtítulo, 5 abas, 2 rádios com contagem e 2 toggles, e o rodapé Cancelar/Baixar simultaneamente visíveis; os toggles refletem `optionsEnabled` por formato e não respondem a clique quando desabilitados; os 4 caminhos de dismiss não disparam `download()` e emitem `close`; reabrir o modal após um dismiss sem baixar mostra o estado padrão, não a seleção anterior.
      Testes: `test/ExportModal.spec.ts` — render fiel à Screen 4, troca de aba atualiza toggles/rótulo do botão, os 4 caminhos de dismiss não chamam download, "Baixar" chama a lógica de download exatamente uma vez.

## Phase 4: Wiring na página do Viewer

Antes de implementar, leia:
1. `.spec/features/export/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/export/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T06 — Wiring em `viewer.vue`
      Arquivos: `app/pages/viewer.vue`
      Mudança: Importar `ExportModal`; adicionar `showExport = ref(false)`; escutar `open-export` da `ViewerToolbar` (T03) para abrir o modal; renderizar `<ExportModal :open="showExport" :filtered-rows="filteredRows" :all-rows="dataset.rows" :display-columns="displayColumns" :file-name="meta?.name ?? ''" @close="showExport = false" />`; desestruturar `filteredRows` de `useViewer` (ainda não usado nesta página).
      Cobre: RF-01, RF-07, RF-08, RF-14, RF-15
      Acceptance criteria: clicar em "Exportar" na toolbar abre o `ExportModal`; o modal recebe exatamente `filteredRows`/`dataset.rows`/`displayColumns`/`meta.name` correntes do Viewer; fechar o modal (qualquer caminho) volta `showExport` a `false` sem navegar nem alterar o dataset.
      Testes: `test/pages/viewer.spec.ts` — clicar em "Exportar" na toolbar renderiza o `ExportModal` com `open=true`; fechar o modal reverte para `open=false`.
