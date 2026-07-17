# Phases: cell-editing

Gerado por /plan a partir de PLAN.md — view executável para
`./ralph.sh .spec/features/cell-editing/PHASES.md`.

## Phase 1: Serialização, mutação de célula e sobrescrita de arquivo

Antes de implementar, leia:
1. `.spec/features/cell-editing/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/cell-editing/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T01 — Serialização Dataset → texto (`stringifyDataset`)
      Arquivos: `app/services/csvParser.ts`
      Mudança: adicionar função pura `stringifyDataset(dataset, delimiter)`,
      ao lado de `parseCsv`/`detectDelimiter`, com quoting CSV padrão
      (delimitador/aspas/quebra de linha) para round-trip com `parseCsv`.
      Cobre: RF-11, CT-03
      Acceptance criteria: `stringifyDataset` existe em `app/services/
      csvParser.ts`; `parseCsv(stringifyDataset(dataset, d))` reproduz
      `header`/`rows` originais para os 3 delimitadores, inclusive campos
      contendo o delimitador, aspas duplas ou `\n`.
      Testes: `test/csvParser.spec.ts` — round-trip nos 3 delimitadores;
      quoting de campos especiais; dataset sem linhas de dados.

- [ ] T02 — `updateCell` em `useCurrentDataset`
      Arquivos: `app/composables/useCurrentDataset.ts`
      Mudança: adicionar `updateCell(rowIndex, columnIndex, value)` que
      muta `dataset.value.rows[rowIndex][columnIndex]`, preservando
      `dataset` como `readonly(dataset)` e `setDataset`/`clearDataset`
      inalterados (CT-01).
      Cobre: CT-01, RF-13
      Acceptance criteria: `updateCell(rowIndex, columnIndex, value)` muta
      `dataset.value.rows[r][c]`; `dataset` continua exposto via
      `readonly()`; índices fora dos limites ou sem dataset carregado não
      lançam exceção.
      Testes: `test/useCurrentDataset.spec.ts` — mutação lida de volta;
      `computed` que lê `dataset.value.rows` reavalia após `updateCell`;
      índices inválidos são no-op.

- [ ] T04 — `overwriteFile` em `useFilesStore`
      Arquivos: `app/composables/useFilesStore.ts`
      Mudança: adicionar `overwriteFile(id, patch)` que substitui
      `content`/`delimiter`/`size_bytes`/`row_count`/`column_count` do
      registro existente (mesmo `id`/`created_at`), atualizando
      `last_opened_at`, seguindo o padrão de transação de `touchFile`;
      retorna `undefined` sem lançar quando `id` não existe.
      Cobre: RF-15, CT-04
      Acceptance criteria: `overwriteFile(id, patch)` substitui `content`
      e metadados do registro mantendo `id`/`created_at`; `id` inexistente
      retorna `undefined` sem lançar e sem criar registro; contagem total
      de `files` não muda.
      Testes: `test/useFilesStore.spec.ts` — overwrite em id existente;
      overwrite em id inexistente; contagem de registros inalterada.

## Phase 2: Composables de edição e de salvamento

Antes de implementar, leia:
1. `.spec/features/cell-editing/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/cell-editing/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T03 — Composable `useCellEditing` (edição, validação, undo/redo)
      Arquivos: `app/composables/useCellEditing.ts`
      Mudança: novo composable com `beginEdit`/`confirmEdit`/`cancelEdit`,
      `undo`/`redo`, `canUndo`/`canRedo`, `isDirty`; valida cada
      `confirmEdit` recalculando `inferColumnType` (nunca cacheado) e
      aplicando o reconhecedor correspondente do tipo (`columnStats.ts`);
      undo/redo/dirty chaveados por `meta.value?.id`, resetados quando o id
      muda (RF-10); usa `updateCell` de T02.
      Cobre: RF-01, RF-02, RF-03, RF-04, RF-05, RF-06, RF-07, RF-08, RF-09,
      RF-10, CT-02, RNF-01, RNF-03
      Acceptance criteria: `confirmEdit` rejeita valor que viola o tipo
      inferido da coluna (não muta, não empilha) e aceita valor válido
      (empilha exatamente 1 entrada, esvazia `redoStack`); `undo`/`redo`
      revertem/reaplicam a edição mais recente; `canUndo`/`canRedo` ficam
      `false` sem entradas correspondentes e undo/redo nesse estado não
      alteram nenhuma célula; trocar `meta.id` zera as duas pilhas.
      Testes: `test/useCellEditing.spec.ts` — cada AC acima, um caso por
      RF-01 a RF-10.

- [ ] T05 — Composable `useSaveVersion`
      Arquivos: `app/composables/useSaveVersion.ts`
      Mudança: `saveNewVersion()` serializa via `stringifyDataset` (T01) e
      chama `filesStore.saveFile` criando sempre um registro novo (nunca
      reusa `meta.id`), respeitando o LRU de `saveFile`; `overwriteOriginal()`
      chama `filesStore.overwriteFile` (T04) no mesmo `id`; ambas retornam
      `false` e populam `error` em falha, sem limpar o dataset em memória
      (RNF-02).
      Cobre: RF-11, RF-12, RF-14, RF-15, CT-03, CT-04, RNF-02
      Acceptance criteria: `saveNewVersion` cria um registro novo cujo
      `content` reflete as edições e preserva o registro original intacto;
      `overwriteOriginal` substitui `content` do mesmo `id` sem criar
      registro adicional; `saveNewVersion` isolado nunca chama
      `overwriteFile`; falha simulada retorna `false`, popula `error` e não
      descarta o dataset/edições em memória.
      Testes: `test/useSaveVersion.spec.ts` — cada AC acima.

## Phase 3: Célula editável e toolbar de ações

Antes de implementar, leia:
1. `.spec/features/cell-editing/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/cell-editing/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T06 — `CsvCell.vue`: modo de edição inline
      Arquivos: `app/components/CsvCell.vue`
      Mudança: props `editable`/`editing`/`invalidEdit`/`dirty` e emits
      `edit-start`/`edit-confirm(value)`/`edit-cancel`; clique/duplo-clique
      entra em edição (RF-01); input com foco automático, visualmente
      distinto (UI-01); Enter/Tab confirma (RF-02); Esc cancela (RF-03);
      `invalidEdit` mostra indicador não-cromático (UI-02); `dirty` mostra
      indicador restrito à célula (UI-03).
      Cobre: RF-01, RF-02, RF-03, UI-01, UI-02, UI-03
      Acceptance criteria: clique/duplo-clique numa célula `editable` emite
      `edit-start`; input em modo `editing` recebe foco e vem pré-preenchido;
      Enter/Tab emitem `edit-confirm` com o valor digitado; Esc emite
      `edit-cancel` sem emitir `edit-confirm`; `invalidEdit`/`dirty`
      renderizam seus indicadores só quando `true`.
      Testes: `test/CsvCell.spec.ts` — cada AC acima.

- [ ] T08 — `ViewerToolbar.vue`: ações de undo/redo e salvar/sobrescrever
      Arquivos: `app/components/ViewerToolbar.vue`
      Mudança: botões "Desfazer"/"Refazer" (desabilitados sem
      `canUndo`/`canRedo`, RF-09) e "Salvar nova versão"/"Sobrescrever
      original" (RF-11/RF-12/RF-15, visualmente distintos entre si,
      CT-04), seguindo o padrão do botão "Exportar" existente; exibe erro
      de T05 (RNF-02) sem bloquear os demais controles.
      Cobre: RF-06, RF-07, RF-09, RF-11, RF-12, RF-15, RNF-02
      Acceptance criteria: "Desfazer"/"Refazer" desabilitados quando
      `canUndo`/`canRedo` são `false`, emitem seus eventos quando `true`;
      "Salvar nova versão" e "Sobrescrever original" emitem eventos
      distintos; mensagem de erro é exibida quando a prop de erro está
      preenchida.
      Testes: `test/ViewerToolbar.spec.ts` — cada AC acima.

## Phase 4: `ViewerTable.vue` — orquestração por linha visível

Antes de implementar, leia:
1. `.spec/features/cell-editing/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/cell-editing/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T07 — `ViewerTable.vue`: orquestra edição/undo por linha visível
      Arquivos: `app/components/ViewerTable.vue`
      Mudança: consome `useCellEditing()` (T03), repassa
      `editable`/`editing`/`invalid-edit`/`dirty` a cada `CsvCell` (T06) e
      escuta `edit-start`/`edit-confirm`/`edit-cancel`, chamando
      `beginEdit`/`confirmEdit`/`cancelEdit`; nenhum emit/prop de
      multi-seleção, paste ou estrutura é adicionado (RF-14).
      Cobre: RF-01, RF-02, RF-03, RF-04, RF-05, UI-01, UI-02, UI-03, RF-14
      Acceptance criteria: clicar numa célula editável entra em modo de
      edição só naquela célula; confirmar valor válido atualiza a linha
      exibida e limpa o indicador de erro; confirmar valor inválido mantém
      o valor anterior e mostra o indicador; nenhuma interação de
      multi-seleção/paste/estrutura é disparada.
      Testes: `test/ViewerTable.spec.ts` — cada AC acima (usar o stub de
      `offsetHeight`/duplo `nextTick` já usado nos testes existentes de
      linhas do corpo, virtualização via `@tanstack/vue-virtual` sobre
      `happy-dom`).

## Phase 5: `viewer.vue` — fiação final

Antes de implementar, leia:
1. `.spec/features/cell-editing/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/cell-editing/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T09 — `viewer.vue`: fiação final
      Arquivos: `app/pages/viewer.vue`
      Mudança: instancia `useCellEditing()` (T03) e `useSaveVersion()`
      (T05) ao lado de `useViewer`/`useViewerSession`; passa o estado de
      edição/undo/redo para `ViewerTable` (T07) e `ViewerToolbar` (T08) via
      props/emits, sem estado de edição próprio na página.
      Cobre: RF-01 a RF-15, UI-01 a UI-03, CT-01 a CT-04 (integração)
      Acceptance criteria: fluxo completo editar → confirmar → undo → redo
      → "Salvar nova versão" → "Sobrescrever original" funciona ponta a
      ponta em `viewer.vue`, com os composables corretos acionados em cada
      etapa.
      Testes: `test/pages/viewer.spec.ts` — o fluxo completo acima, com
      `useFilesStore` injetado/mockado para verificar o registro criado
      (`saveNewVersion`) e o `id` sobrescrito (`overwriteOriginal`).

## Phase 6: Testes de integração cross-cutting

Antes de implementar, leia:
1. `.spec/features/cell-editing/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/cell-editing/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T10 — Testes de integração cross-cutting (RF-13, RF-10 na troca de dataset)
      Arquivos: `test/pages/viewer.spec.ts`
      Mudança: nenhuma alteração de produção — apenas testes: edição que
      viola um filtro ativo remove a linha da view imediatamente (RF-13);
      edição que muda a posição relativa sob ordenação ativa reposiciona a
      linha imediatamente (RF-13); reabrir um dataset diferente zera
      `canUndo`/`canRedo` e o indicador "sujo" de qualquer célula editada
      no dataset anterior (RF-10, ponta a ponta).
      Cobre: RF-13, RF-10
      Acceptance criteria: os 3 cenários acima passam em
      `test/pages/viewer.spec.ts`, sem nenhuma ação adicional do usuário
      além da edição/reabertura simuladas.
      Testes: `test/pages/viewer.spec.ts` — os 3 cenários acima.
