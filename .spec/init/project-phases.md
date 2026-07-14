# CSV View — Project Phases

<!-- inputs: project-description.md@sha256:a074e9513cf1 user-stories.md@sha256:60c1a7288d59 database-schema.md@sha256:efa2fcd3044f -->

## Overview

Este plano constrói o **MVP** do CSV View — um explorador de CSV/TSV 100% client-side,
servido como SPA estática (`nuxt generate` com `ssr: false`) — em **8 fases**, na estratégia
**fundação primeiro, depois os fluxos**. As fases 1–5 montam a base (configuração, tokens de
design, componentes reutilizáveis, persistência em IndexedDB, motor de parsing e motor de
estatísticas); as fases 6–8 entregam as telas do produto (Upload, tabela do Viewer e painel
de estatísticas). Cada fase é dimensionada para uma sessão de um agente e é referenciada por
número quando entregue para implementação.

Decisões de arquitetura em vigor: parsing em **Web Worker via PapaParse**, virtualização da
tabela via **@tanstack/vue-virtual** (alvo de ~50 MB / ~1M linhas), persistência em
**IndexedDB** com política **LRU (máx. 10 arquivos recentes)**, tema **dark por padrão**, e
interface em **português** (i18n adiado). A **linha de corte do MVP é o fim da Fase 8** — ao
concluí-la, todas as 7 user stories estão entregues.

**Conventions:**
- `[ ]` pending · `[x]` done in the codebase.
- Phases and sub-phases are numbered (`Phase 1`, `Phase 5.3`) for reference by AI agents.
- Business-logic tasks list the **feature tests** to generate; frontend-only tasks list validatable **acceptance criteria** and a **Design ref**.

---

## Phase 1: Fundação — configuração, tokens e layout base

**Goal:** Base Nuxt SPA estática, tokens de design (light/dark), fontes, layout e plumbing de estado compartilhado. · **Depends on:** none · **Covers:** Tech Stack, princípio client-side, tokens de design, tema.

### Phase 1.1: Configuração e dependências

- [ ] **Task:** Configurar a aplicação como SPA estática — `ssr: false` no `nuxt.config.ts` e preset estático do Nitro, de forma que `nuxt generate` produza um SPA sem servidor.
  - **Acceptance criteria:**
    - `yarn generate` conclui e produz saída estática servível por um CDN/host estático.
    - APIs de navegador (File, IndexedDB, Web Worker) funcionam sem erro de SSR.
    - Nenhuma rota de servidor/Nitro é adicionada.
  - **Traces:** project-description Tech Stack; workflow de deploy (SSG)

- [ ] **Task:** Adicionar as dependências de runtime: `papaparse` (+ `@types/papaparse`), `@tanstack/vue-virtual` e um wrapper de IndexedDB (`idb`), via `yarn`.
  - **Acceptance criteria:**
    - Pacotes instalados com `yarn` e registrados em `package.json` (sem uso de npm/pnpm).
    - `yarn build` e `yarn test` continuam passando após a instalação.
  - **Traces:** decisões de parser/virtualização/persistência

- [ ] **Task:** Remover o scaffold de boas-vindas: substituir `app/app.vue` (`NuxtWelcome`) por um shell com `NuxtLayout` + `NuxtPage` e habilitar o diretório de páginas.
  - **Acceptance criteria:**
    - `app/app.vue` não referencia mais `NuxtWelcome`.
    - A rota `/` renderiza a página de Upload (placeholder até a Fase 6) via `NuxtPage`.
  - **Traces:** fundação (project-description Overview)

### Phase 1.2: Tokens de design e tipografia

- [ ] **Task:** Definir os tokens de design como variáveis CSS (cores, radii) para os temas light e dark em `app/assets/css/main.css`, fiéis ao design system.
  - **Acceptance criteria:**
    - Todas as variáveis de cor de `README.md#design-tokens` existem para light e dark (bg, bg-1/2, border(-strong), text/2/3, accent(-hover/-soft/-fg), success/warning/error/info + `-soft`, shadow).
    - Os valores batem exatamente com a tabela do design.
  - **Design ref:** `.spec/init/design/README.md#design-tokens`
  - **Traces:** design system; schema `settings` (tema)

- [ ] **Task:** Auto-hospedar as fontes Geist (sans) e Geist Mono (mono), sem depender de CDN externo (privacidade/offline).
  - **Acceptance criteria:**
    - As fontes carregam de assets locais; nenhuma requisição a host externo.
    - `--font` mapeia para Geist e `--mono` para Geist Mono.
  - **Design ref:** `.spec/init/design/README.md#tipografia`
  - **Traces:** design system; princípio client-side

- [ ] **Task:** Aplicar o tema via atributo `data-theme` no elemento raiz, com **dark** como padrão, lendo/escrevendo a preferência (integra com a Fase 3).
  - **Acceptance criteria:**
    - Sem preferência salva, o tema inicial é dark.
    - Alternar o tema troca as variáveis CSS aplicadas em toda a UI.
  - **Traces:** schema `settings` (theme=dark)

### Phase 1.3: Layout e estado compartilhado

- [ ] **Task:** Criar o layout base com header (marca `csvview.app`, selo "100% no navegador" e toggle de tema) e área de conteúdo.
  - **Acceptance criteria:**
    - O header aparece em todas as telas e é responsivo.
    - O toggle de tema está presente e funcional no header.
  - **Design ref:** `.spec/init/design/README.md` (header / Produto)
  - **Traces:** design system

- [ ] **Task:** Criar um composable de estado do dataset atual (`useCurrentDataset`) compartilhado entre Upload e Viewer (dataset parseado + metadados em memória).
  - **Acceptance criteria:**
    - O composable expõe o dataset atual, seus metadados e uma ação para defini-lo/limpá-lo.
    - Navegar do Upload para o Viewer preserva o dataset carregado sem re-parsear.
  - **Traces:** US-2.1, US-3.1 (plumbing compartilhado)

---

## Phase 2: Design system — componentes base

**Goal:** Componentes reutilizáveis do design system usados pelas telas do MVP. · **Depends on:** Phase 1 · **Covers:** seção "Biblioteca de componentes" do design; base visual de US-1.1, US-2.x, US-3.1.

### Phase 2.1: Controles

- [ ] **Task:** Componente `Button` com variantes primary, secondary, ghost e danger, tamanho small, e estados hover e disabled.
  - **Acceptance criteria:**
    - Todas as variantes e estados renderizam conforme os tokens de cor/raio do design.
    - Estado disabled bloqueia clique e reduz opacidade conforme design.
  - **Design ref:** `.spec/init/design/README.md` (Biblioteca de componentes → Buttons)
  - **Traces:** design system

- [ ] **Task:** Componentes de entrada: campo de busca ("Buscar em tudo…") e select base.
  - **Acceptance criteria:**
    - Campo de busca com placeholder e ícone conforme design; emite o valor digitado.
    - Select estilizado conforme tokens; acessível via teclado.
  - **Design ref:** `.spec/init/design/README.md` (Biblioteca de componentes → Inputs & select)
  - **Traces:** design system; US-2.2

- [ ] **Task:** Componente `ThemeToggle` (dark/light) que integra com o estado de tema da Fase 1.
  - **Acceptance criteria:**
    - Clicar alterna o tema e reflete o estado atual (ícone/estado).
  - **Design ref:** `.spec/init/design/README.md` (Produto / header)
  - **Traces:** schema `settings` (theme)

### Phase 2.2: Exibição e overlays

- [ ] **Task:** Componentes `Badge` (default, accent, status settled/pending/failed, info) e `ColumnChip` (chip de coluna com tipo, ex.: date/amount/id).
  - **Acceptance criteria:**
    - Cada variante usa a cor de status e a variante `-soft` corretas do design.
    - `ColumnChip` exibe o rótulo e o tipo da coluna.
  - **Design ref:** `.spec/init/design/README.md` (Biblioteca de componentes → Badges & column chips)
  - **Traces:** design system; US-2.1, US-3.1

- [ ] **Task:** Componente `Tooltip` e componente `Dropdown`/popover (base para o seletor de colunas).
  - **Acceptance criteria:**
    - Tooltip aparece no hover/foco e some ao sair.
    - Dropdown abre/fecha, fecha ao clicar fora e é navegável por teclado.
  - **Design ref:** `.spec/init/design/README.md` (Biblioteca de componentes → Tabs & tooltip, dropdown)
  - **Traces:** design system; US-2.3

---

## Phase 3: Persistência — IndexedDB (files + settings)

**Goal:** Camada de persistência client-side com os object stores `files` e `settings` e política LRU. · **Depends on:** Phase 1 · **Covers:** tabelas `files` e `settings`; US-4.1.

### Phase 3.1: Stores e CRUD

- [ ] **Task:** Inicializar o banco IndexedDB (via `idb`) com os object stores `files` (chave auto-incremento, índice por `last_opened_at`) e `settings` (chave = `key`).
  - **Acceptance criteria:**
    - O banco é criado com os dois stores e o índice de `last_opened_at` em `files`.
    - A abertura é idempotente (reabrir não recria/duplica stores).
  - **Feature tests:** `idb-init` → cria os stores `files` e `settings` e o índice esperado.
  - **Traces:** schema `files`, `settings`; US-4.1

- [ ] **Task:** CRUD do store `files`: salvar (name, delimiter, size_bytes, row_count, column_count, content, created_at, last_opened_at), obter por id, listar ordenado por `last_opened_at` desc e deletar.
  - **Acceptance criteria:**
    - Salvar retorna o id; obter recupera o registro idêntico.
    - Listar retorna os arquivos do mais recente ao mais antigo.
  - **Feature tests:** `files-crud` → salva/recupera preserva campos; `files-list-order` → ordenação por `last_opened_at` desc.
  - **Traces:** schema `files`; US-4.1

### Phase 3.2: LRU e settings

- [ ] **Task:** Política LRU no store `files`: manter no máximo 10 registros; ao exceder, remover o mais antigo por `last_opened_at`; reabrir atualiza `last_opened_at`.
  - **Acceptance criteria:**
    - Inserir o 11º arquivo remove exatamente o mais antigo.
    - Reabrir um arquivo o move para o topo da lista de recentes.
  - **Feature tests:** `files-lru-evict` → 11ª inserção remove o mais antigo; `files-lru-touch` → reabrir atualiza a ordem.
  - **Traces:** schema `files`; US-4.1 (política de quota)

- [ ] **Task:** Store `settings`: get/set chave-valor com seed padrão `theme=dark` quando ausente; usado pelo tema da Fase 1.
  - **Acceptance criteria:**
    - Ler `theme` sem valor salvo retorna `dark`.
    - Definir `theme` persiste entre recarregamentos da página.
  - **Feature tests:** `settings-default-theme` → default dark; `settings-persist` → set persiste e é relido.
  - **Traces:** schema `settings`

---

## Phase 4: Motor de parsing CSV/TSV

**Goal:** Parsing robusto em Web Worker com detecção de delimitador e tratamento de bordas. · **Depends on:** Phase 1 · **Covers:** US-1.1, US-1.2; workflow 1.

### Phase 4.1: Parse e delimitador

- [ ] **Task:** Serviço de parse em Web Worker usando PapaParse, retornando cabeçalho, linhas e metadados (`row_count`, `column_count`), com a primeira linha tratada como cabeçalho.
  - **Acceptance criteria:**
    - Parse ocorre em Web Worker, sem bloquear a main thread.
    - Campos com aspas, vírgulas internas e quebras de linha entre aspas são corretamente parseados.
  - **Feature tests:** `parse-basic` → CSV simples vira header + linhas; `parse-quoted` → campos com aspas/vírgula/newline preservados.
  - **Traces:** US-1.1; workflow 1

- [ ] **Task:** Detecção de delimitador por extensão e conteúdo: `,` para `.csv`, tab para `.tsv`, detecção para `.txt`/variantes (`;`).
  - **Acceptance criteria:**
    - `.csv` → comma, `.tsv` → tab.
    - Conteúdo predominantemente com `;` é detectado como semicolon.
  - **Feature tests:** `delimiter-by-ext` → csv/tsv corretos; `delimiter-by-content` → `;` detectado como semicolon.
  - **Traces:** schema `files.delimiter`; US-1.1

### Phase 4.2: Bordas e desempenho

- [ ] **Task:** Tratamento de bordas: arquivo vazio → erro sinalizado; linhas com nº de colunas divergente → normalizadas (faltantes vazias, excedentes preservadas); arquivo sem cabeçalho detectável → 1ª linha vira cabeçalho.
  - **Acceptance criteria:**
    - Arquivo de 0 linhas retorna um erro tratável (não uma tabela vazia silenciosa).
    - Linhas irregulares não quebram a estrutura de colunas.
  - **Feature tests:** `parse-empty` → erro; `parse-ragged` → linhas normalizadas; `parse-no-header` → 1ª linha como header.
  - **Traces:** US-1.2

- [ ] **Task:** Streaming/progresso para arquivos grandes (até ~50 MB / ~1M linhas) mantendo a UI responsiva e reportando progresso.
  - **Acceptance criteria:**
    - Parsear um arquivo grande não congela a interface.
    - Um indicador de progresso é reportado durante o parse.
  - **Feature tests:** `parse-large-progress` → callback de progresso é chamado e o resultado tem a contagem de linhas esperada.
  - **Traces:** US-1.2 (não bloquear UI); porte-alvo ~50 MB

---

## Phase 5: Inferência de tipo e estatísticas de coluna

**Goal:** Motor client-side de inferência de tipo e métricas por coluna. · **Depends on:** Phase 4 · **Covers:** US-3.1.

### Phase 5.1: Tipo e métricas gerais

- [ ] **Task:** Inferência de tipo por coluna: `number`, `date` ou `text`.
  - **Acceptance criteria:**
    - Coluna toda numérica → `number`; datas reconhecíveis → `date`; caso contrário → `text`.
    - Células vazias não invalidam a inferência do tipo dominante.
  - **Feature tests:** `infer-number`, `infer-date`, `infer-text-mixed` → cada um afirma o tipo inferido correto.
  - **Traces:** US-3.1

- [ ] **Task:** Métricas gerais por coluna: nulos, únicos, duplicados e preenchido.
  - **Acceptance criteria:**
    - As contagens batem para um dataset de referência conhecido.
    - Vazio/`null`/`''` conta como nulo (consistente com a regra de célula).
  - **Feature tests:** `stats-general` → nulos/únicos/duplicados/preenchido corretos em dataset fixo.
  - **Traces:** US-3.1

### Phase 5.2: Métricas numéricas e distribuição

- [ ] **Task:** Métricas numéricas (mínimo, máximo, média) para colunas do tipo `number`.
  - **Acceptance criteria:**
    - min/max/média corretos ignorando células nulas.
    - Não são calculadas para colunas não-numéricas.
  - **Feature tests:** `stats-numeric` → min/max/média corretos; `stats-numeric-skip-null` → nulos ignorados.
  - **Traces:** US-3.1

- [ ] **Task:** Distribuição (histograma em bins) para colunas numéricas.
  - **Acceptance criteria:**
    - A soma das contagens dos bins é igual ao total de valores numéricos não-nulos.
    - O número de bins é estável e determinístico para o mesmo input.
  - **Feature tests:** `stats-histogram-sum` → bins somam ao total; `stats-histogram-bins` → nº de bins determinístico.
  - **Traces:** US-3.1

---

## Phase 6: Tela de Upload e arquivos recentes

**Goal:** Página inicial de upload (dropzone, seleção, tratamento de erro) e lista de recentes com reabertura. · **Depends on:** Phase 2, Phase 3, Phase 4 · **Covers:** US-1.1, US-1.2, US-4.1; workflows 1 e 4.

### Phase 6.1: Upload e abertura

- [ ] **Task:** Página `/` de Upload: título "Solte um CSV e comece a explorar.", dropzone, marca e selo de privacidade.
  - **Acceptance criteria:**
    - Layout fiel à tela de referência (título, dropzone, marca, selo).
    - Renderiza os estados idle e drag-over.
  - **Design ref:** `.spec/init/design/README.md#screen-1--tela-inicial--upload`
  - **Traces:** US-1.1

- [ ] **Task:** Dropzone com arrastar-e-soltar + seletor de arquivo (aceita `.csv`, `.tsv`, `.txt`) e estado visual de drag-over.
  - **Acceptance criteria:**
    - Soltar um arquivo e clicar em "Escolher arquivo" iniciam o mesmo fluxo.
    - Durante o arraste há feedback visual de drag-over.
  - **Design ref:** `.spec/init/design/README.md#screen-1--tela-inicial--upload`
  - **Traces:** US-1.1

- [ ] **Task:** Fluxo de abrir arquivo: parsear (Fase 4) → persistir em `files` (Fase 3) → carregar no `useCurrentDataset` → navegar ao Viewer.
  - **Acceptance criteria:**
    - Um arquivo válido é persistido em `files` e abre o Viewer com o dataset carregado.
    - O `last_opened_at` é gravado na abertura.
  - **Feature tests:** `open-flow-persist` → após abrir, existe um registro em `files` com os metadados corretos.
  - **Traces:** US-1.1; schema `files`; workflow 1

- [ ] **Task:** UI de erro para arquivos inválidos/vazios (mensagem clara + formatos aceitos), consumindo os erros da Fase 4.
  - **Acceptance criteria:**
    - Arquivo vazio e tipo não suportado exibem mensagem específica, sem quebrar a tela.
  - **Design ref:** `.spec/init/design/README.md#screen-1--tela-inicial--upload`
  - **Traces:** US-1.2

### Phase 6.2: Recentes

- [ ] **Task:** Lista de arquivos recentes (nome, nº de linhas, tamanho, "há quanto tempo") lida do store `files`.
  - **Acceptance criteria:**
    - Os recentes aparecem do mais recente ao mais antigo, com os metadados formatados.
  - **Design ref:** `.spec/init/design/README.md#screen-1--tela-inicial--upload`
  - **Traces:** US-4.1; schema `files`

- [ ] **Task:** Reabrir um recente: recarrega o conteúdo persistido, re-parseia e abre o Viewer sem novo upload; atualiza a ordem (LRU touch).
  - **Acceptance criteria:**
    - Clicar em um recente abre o Viewer com os dados, sem pedir o arquivo de novo.
    - O item reaberto vai para o topo da lista.
  - **Feature tests:** `reopen-recent` → reabrir carrega o dataset e atualiza `last_opened_at`.
  - **Traces:** US-4.1; workflow 4

- [ ] **Task:** Estado vazio da lista de recentes (quando não há arquivos persistidos).
  - **Acceptance criteria:**
    - Sem recentes, a área exibe um estado vazio conforme design.
  - **Design ref:** `.spec/init/design/README.md#screen-1--tela-inicial--upload`
  - **Traces:** US-4.1

---

## Phase 7: Viewer — tabela virtualizada, busca e colunas

**Goal:** Tela do Viewer com tabela virtualizada, busca global e seleção de colunas. · **Depends on:** Phase 2, Phase 4, Phase 6 · **Covers:** US-2.1, US-2.2, US-2.3; workflow 2.

### Phase 7.1: Tabela

- [ ] **Task:** Página `/viewer` com toolbar (nome do arquivo, contagem de linhas, campo de busca e seletor de colunas). Controles de features adiadas (Filtros/Exportar) ficam fora do escopo do MVP.
  - **Acceptance criteria:**
    - Toolbar fiel à tela de referência, exibindo nome do arquivo e total de linhas.
    - Apenas controles do MVP (busca, colunas) estão presentes/ativos.
  - **Design ref:** `.spec/init/design/README.md#screen-2--visualizador-principal`
  - **Traces:** US-2.1

- [x] **Task:** Componente `CsvCell` — renderização de célula com placeholder em travessão (—) itálico para `null`/`undefined`/`''` e coerção de números para texto. Já implementado em `app/components/CsvCell.vue` com testes em `test/CsvCell.spec.ts`.
  - **Acceptance criteria:**
    - Valores vazios exibem "—" em itálico; demais valores viram texto.
    - Testes existentes cobrem valor, placeholder e coerção de número.
  - **Feature tests:** `test/CsvCell.spec.ts` (existente) → valor, placeholder de vazio, coerção numérica.
  - **Traces:** US-2.1

- [ ] **Task:** Tabela virtualizada com `@tanstack/vue-virtual` (cabeçalho fixo, renderiza só as linhas visíveis) usando o `CsvCell`.
  - **Acceptance criteria:**
    - Um dataset com ~1M linhas rola de forma fluida.
    - Apenas as linhas visíveis (mais overscan) existem no DOM.
  - **Design ref:** `.spec/init/design/README.md#screen-2--visualizador-principal`
  - **Traces:** US-2.1; porte-alvo ~1M linhas

- [ ] **Task:** Alinhamento à direita em fonte monoespaçada para colunas numéricas, usando a inferência de tipo da Fase 5.
  - **Acceptance criteria:**
    - Colunas `number` alinham à direita em mono; demais alinham à esquerda.
  - **Design ref:** `.spec/init/design/README.md#screen-2--visualizador-principal`
  - **Traces:** US-2.1

### Phase 7.2: Busca e colunas

- [ ] **Task:** Busca global que filtra as linhas que casam com o termo em qualquer célula; limpar restaura todas as linhas.
  - **Acceptance criteria:**
    - Digitar filtra as linhas em tempo real; casamento em qualquer coluna.
    - Limpar o campo restaura o dataset completo.
  - **Feature tests:** `search-any-column` → casa em qualquer coluna; `search-clear-restores` → limpar restaura; `search-case-insensitive` → busca ignora caixa.
  - **Traces:** US-2.2

- [ ] **Task:** Estado "nenhuma linha encontrada" quando a busca não retorna resultados.
  - **Acceptance criteria:**
    - Uma busca sem correspondências exibe um estado vazio dedicado.
  - **Design ref:** `.spec/init/design/README.md#screen-2--visualizador-principal`
  - **Traces:** US-2.2

- [ ] **Task:** Seletor de colunas (mostrar/ocultar) mantendo busca e estatísticas corretas sobre as colunas ocultas.
  - **Acceptance criteria:**
    - Ocultar/reexibir coluna atualiza a tabela.
    - Busca e estatísticas permanecem corretas independentemente da visibilidade.
  - **Feature tests:** `columns-toggle` → ocultar remove a coluna da tabela; `columns-hidden-stats-intact` → busca/stats inalteradas com coluna oculta.
  - **Traces:** US-2.3

---

## Phase 8: Viewer — painel de estatísticas de coluna

**Goal:** Painel de estatísticas por coluna na tela do Viewer, consumindo o motor da Fase 5. · **Depends on:** Phase 5, Phase 7 · **Covers:** US-3.1; workflow 3.

### Phase 8.1: Painel de estatísticas

- [ ] **Task:** Abrir o painel de estatísticas ao selecionar uma coluna do Viewer.
  - **Acceptance criteria:**
    - Selecionar uma coluna exibe o painel de estatísticas dela.
    - Trocar de coluna atualiza o painel.
  - **Design ref:** `.spec/init/design/README.md#screen-2--visualizador-principal`
  - **Traces:** US-3.1; workflow 3

- [ ] **Task:** Exibir o tipo inferido e as métricas gerais (nulos, únicos, duplicados, preenchido) no painel.
  - **Acceptance criteria:**
    - O painel mostra o tipo (`número`/`data`/`texto`) e as quatro métricas gerais.
    - Os valores correspondem ao motor da Fase 5.
  - **Design ref:** `.spec/init/design/README.md#screen-2--visualizador-principal`
  - **Traces:** US-3.1

- [ ] **Task:** Exibir mínimo, máximo e média apenas para colunas numéricas.
  - **Acceptance criteria:**
    - As métricas numéricas aparecem só quando o tipo é `number`.
  - **Design ref:** `.spec/init/design/README.md#screen-2--visualizador-principal`
  - **Traces:** US-3.1

- [ ] **Task:** Renderizar o mini-histograma de distribuição para colunas numéricas.
  - **Acceptance criteria:**
    - O histograma reflete os bins da Fase 5 e some para colunas não-numéricas.
  - **Design ref:** `.spec/init/design/README.md#screen-2--visualizador-principal`
  - **Traces:** US-3.1

## Open Questions

- Nenhuma pendência de escopo do MVP. As decisões anteriores (porte ~50 MB, PapaParse, TanStack Virtual, LRU de 10, SPA estático, pt-only) fecham as questões em aberto herdadas das specs anteriores. Features adiadas (filtros avançados, exportação, comparação, destaques visuais) serão planejadas em fases futuras após o MVP.
