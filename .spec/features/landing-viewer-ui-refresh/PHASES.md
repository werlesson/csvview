# Phases: landing-viewer-ui-refresh

Gerado por /plan a partir de PLAN.md — view executável para
`./ralph.sh .spec/features/landing-viewer-ui-refresh/PHASES.md`.

## Phase 1: Componentes independentes (assets, textos, transições isoladas)

Antes de implementar, leia:
1. `.spec/features/landing-viewer-ui-refresh/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/landing-viewer-ui-refresh/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T01 — Asset da logo SVG + componente `LogoMark.vue`
      Arquivos: `public/logo.svg`, `app/components/LogoMark.vue`, `test/LogoMark.spec.ts`
      Mudança: copiar `/mnt/c/Users/werlesson/Desktop/image.svg` para `public/logo.svg` (asset estático, sem processamento Vite); criar `LogoMark.vue` apresentacional puro (`<img src="/logo.svg">`, sem estado/composable), reutilizável entre landing e Viewer.
      Cobre: RF-03, RNF-04
      Acceptance criteria: `public/logo.svg` existe e é incluído por `yarn generate` entre os assets estáticos; `LogoMark.vue` renderiza uma imagem/SVG referenciando o asset local, sem dependência de rede externa, e não introduz estado (sem `ref`/composable).
      Testes: `test/LogoMark.spec.ts` — monta sem props obrigatórias; asserta `<img>`/`<svg>` presente com `alt` não vazio apontando para o asset local.

- [ ] T05 — `RecentFiles.vue`: ícones decorativos só com `--accent`
      Arquivos: `app/components/RecentFiles.vue`, `test/RecentFiles.spec.ts`
      Mudança: remover `recent__icon--${i % 3}` e as classes `.recent__icon--0/1/2` (`--success`/`--info`/`--warning`); `.recent__icon` passa a usar `--accent`/`--accent-soft` para qualquer índice.
      Cobre: RF-05, RNF-03
      Acceptance criteria: nenhum `.recent__icon` da lista usa `--success`, `--info` ou `--warning` (em nenhuma posição); todos resolvem para `--accent`/`--accent-soft`. Evidência de contraste (não requer mudança de token): dark `#6e62f7` sobre composto `rgb(29,27,52)` ≈ 3.78:1; light `#5a4fe0` sobre composto `rgb(237,236,252)` ≈ 4.96:1 — ambos ≥ 3:1 (RNF-03).
      Testes: `test/RecentFiles.spec.ts` — com 3+ itens, nenhum elemento tem classe `recent__icon--0/1/2`; todos usam a mesma classe única `recent__icon`.

- [ ] T06 — Landing: novo título e subtítulo do hero
      Arquivos: `app/pages/index.vue`, `test/pages/index.spec.ts`
      Mudança: substituir `.upload__title` por "O explorador de CSV para quem vive nos dados" e `.upload__subtitle` pelo novo texto de apoio especificado na SPEC (RF-02), sem tocar `Dropzone`/`RecentFiles`/`useOpenFile`.
      Cobre: RF-01, RF-02
      Acceptance criteria: o DOM renderizado contém o título com o texto exato novo e não contém mais "Solte um CSV e comece a explorar."; o subtítulo contém o texto exato novo e não contém mais o texto de apoio anterior.
      Testes: `test/pages/index.spec.ts` (novo) — monta `index.vue` com stubs de `useOpenFile`/`useFilesStore`; asserta texto exato do título/subtítulo novos e ausência dos textos antigos.

- [ ] T07 — `Dropdown.vue`: transição animada de abrir/fechar
      Arquivos: `app/components/Dropdown.vue`, `test/Dropdown.spec.ts`
      Mudança: envolver `<div class="dropdown__panel" v-show="open">` num `<Transition name="dropdown">` com fade + leve `translateY`, 150–300ms, e `@media (prefers-reduced-motion: reduce)` zerando a duração dentro do próprio `<style scoped>` do componente; `v-show="open"` continua o gatilho; foco/teclado/clique-fora inalterados.
      Cobre: RF-06 (item c — abrir/fechar painel "Colunas"), UI-02, RNF-01, RNF-02
      Acceptance criteria: abrir o menu produz um estado intermediário observável (classe `dropdown-enter-active`/equivalente) antes do estado final aberto; fechar produz o equivalente na direção inversa; a duração declarada está entre 150ms e 300ms; com `prefers-reduced-motion: reduce` emulado, a transição tem duração 0 (troca instantânea equivalente ao estado atual).
      Testes: `test/Dropdown.spec.ts` (existente, revisado) — ajustar as asserções de `style.display === 'none'` para aguardar o ciclo de transição/checar a classe intermediária em vez do `display` imediato; foco no primeiro item ao abrir e retorno de foco ao Escape continuam funcionando.

- [ ] T08 — Destaque animado ao trocar a coluna selecionada
      Arquivos: `app/components/ViewerTable.vue`, `app/components/StatsPanel.vue`, `test/ViewerTable.spec.ts`, `test/StatsPanel.spec.ts`
      Mudança: adicionar `transition: background-color, box-shadow, border-color` (150–300ms) a `.viewer-table__th--selected` em `ViewerTable.vue`; envolver `.stats-panel__content` num `<Transition name="stats-fade" mode="out-in">` em `StatsPanel.vue`; ambos com `@media (prefers-reduced-motion: reduce)` zerando a duração. Sem mudança de props/`selectColumn`.
      Cobre: RF-06 (item b — trocar coluna selecionada), UI-03, RNF-01, RNF-02
      Acceptance criteria: selecionar uma nova coluna dispara uma transição CSS observável (duração mensurável >0ms, entre 150–300ms) no `<th>` selecionado e/ou no painel de estatísticas; com `prefers-reduced-motion: reduce`, a duração é 0 sem quebrar a troca de conteúdo.
      Testes: `test/ViewerTable.spec.ts` — a classe `viewer-table__th--selected` continua aplicada/removida corretamente ao mudar `selectedIndex` (caso existente ~linha 148-150 permanece verde); `test/StatsPanel.spec.ts` — trocar `stats`/`label` via re-render, aguardando `nextTick`, não quebra a renderização final do conteúdo.

- [ ] T09 — Feedback animado ao abrir um arquivo
      Arquivos: `app/components/Dropzone.vue`, `test/Dropzone.spec.ts`
      Mudança: adicionar `opacity` ao `transition` já existente em `.dropzone` (hoje só `border-color`/`background`), ajustado para 150–300ms; adicionar um indicador visual adicional (ex.: pulso em `.dropzone__icon-wrap` via `@keyframes`) enquanto `disabled` (vinculado a `isOpening`) está ativo; `@media (prefers-reduced-motion: reduce)` desabilita a animação de pulso. Sem mudança de props/eventos.
      Cobre: RF-06 (item a — abrir arquivo via dropzone), RNF-01, RNF-02
      Acceptance criteria: com `disabled=true`, existe uma propriedade `transition`/`animation` aplicada ao elemento afetado com duração mensurável entre 150–300ms; o comportamento funcional de `disabled` (bloqueio de clique/seleção) permanece idêntico ao atual; com `prefers-reduced-motion: reduce`, a animação de pulso é removida/zerada.
      Testes: `test/Dropzone.spec.ts` (existente) — `.dropzone--disabled` continua aplicada corretamente quando `disabled=true`; novo caso confere a presença da classe/estrutura que dispara a animação de pulso quando `disabled`.

## Phase 2: Header (logo) e transição de página

Antes de implementar, leia:
1. `.spec/features/landing-viewer-ui-refresh/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/landing-viewer-ui-refresh/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T02 — Header (rotas fora do Viewer): logo substitui o wordmark de texto
      Arquivos: `app/layouts/default.vue`, `test/DefaultLayout.spec.ts`
      Mudança: no branch `v-else` do `.brand`, substituir `brand__mark` + `brand__badge` (texto) por `<LogoMark />`; manter `.brand` como link para `/` na posição atual (canto esquerdo, UI-04); remover a regra `@media (max-width: 640px) { .brand__badge { display: none } }` órfã (o badge de texto deixa de existir).
      Cobre: RF-03, UI-04
      Acceptance criteria: fora da rota `/viewer`, o DOM do header não contém mais os nós de texto "csvview.app" nem "100% no navegador"; contém `LogoMark` referenciando um asset versionado do repositório; em telas ≥640px e <640px o logo permanece visível e alinhado à esquerda, sem quebrar o layout responsivo existente.
      Testes: `test/DefaultLayout.spec.ts` (novo, iniciado aqui) — fora de `/viewer`, ausência dos textos antigos e presença de `LogoMark`.

- [ ] T10 — Transição de página landing → Viewer
      Arquivos: `app/pages/index.vue`, `app/pages/viewer.vue`, `app/assets/css/main.css`
      Mudança: adicionar `definePageMeta({ pageTransition: { name: 'view', mode: 'out-in' } })` em ambas as páginas; em `main.css`, classes globais `.view-enter-active`/`.view-leave-active` com fade (150–300ms) e `@media (prefers-reduced-motion: reduce)` desabilitando a transição. Sem mudança em `useOpenFile.navigate`/`navigateTo`.
      Cobre: RF-07, RNF-01, RNF-02
      Acceptance criteria: uma transição de página está configurada e observável (classes `*-enter-active`/`*-leave-active`) na troca de `/` para `/viewer`; a duração declarada está entre 150–300ms; com `prefers-reduced-motion: reduce`, a transição é removida/zerada sem quebrar a navegação.
      Testes: smoke em `test/pages/index.spec.ts` (de T06) ou verificação equivalente de que `definePageMeta`/`pageTransition.name === 'view'` está presente em ambas as páginas; validação manual complementar via `yarn dev` documentada (limitação de `mount()` isolado sem `@nuxt/test-utils` para exercitar a transição de rota real).

## Phase 3: Header do Viewer — logo + filename simultâneos

Antes de implementar, leia:
1. `.spec/features/landing-viewer-ui-refresh/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/landing-viewer-ui-refresh/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T03 — Header do Viewer: logo + filename lado a lado
      Arquivos: `app/layouts/default.vue`, `test/DefaultLayout.spec.ts`
      Mudança: eliminar a exclusividade mútua `v-if="currentFile"`/`v-else` do `.brand`; `.brand` (com `LogoMark`, de T02) passa a renderizar sempre; `brand__file` vira elemento irmão dentro de `.app-header__inner`, posicionado à direita (ex.: `margin-left: auto`), visível só quando `currentFile` existe, sem mais ocultar o logo.
      Cobre: RF-04
      Acceptance criteria: no Viewer com dataset carregado, o header contém tanto o elemento de logo quanto o elemento com o nome do arquivo; a ordem no DOM/posicionamento visual coloca o nome do arquivo depois do logo, na mesma linha do header.
      Testes: `test/DefaultLayout.spec.ts` — no Viewer com `currentFile` presente (mock/stub de `useCurrentDataset`), header contém `LogoMark` e o texto do arquivo, nessa ordem.

## Phase 4: Consolidação do toggle de tema

Antes de implementar, leia:
1. `.spec/features/landing-viewer-ui-refresh/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/landing-viewer-ui-refresh/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T04 — Consolidar o toggle de tema (elimina duplicação)
      Arquivos: `app/layouts/default.vue`, `app/components/ThemeToggle.vue`, `test/ThemeToggle.spec.ts`, `test/DefaultLayout.spec.ts`
      Mudança: remover o `<button class="theme-toggle">` inline de `default.vue` (glifos `☾`/`☀`) e usar `<ThemeToggle />`; em `ThemeToggle.vue`, adicionar transição animada entre os ícones lua/sol (`opacity`+`transform: scale`, 150–300ms) com `@media (prefers-reduced-motion: reduce)` escopado ao componente; preserva `toggleTheme`/`aria-pressed`/persistência de `useTheme.ts` inalterados.
      Cobre: RF-08, UI-01, RNF-01, RNF-02
      Acceptance criteria: existe exatamente um controle de alternância de tema renderizado no header, em qualquer rota; acioná-lo chama `toggleTheme` e persiste a escolha; não há um segundo controle de tema duplicado (órfão ou inline) coexistindo no código; `aria-pressed` e o ícone diferem entre os dois temas, e a troca anima (não é um salto instantâneo).
      Testes: `test/ThemeToggle.spec.ts` (existente, ajustado se necessário para a nova transição sem quebrar `aria-pressed`/`data-theme-state`) + `test/DefaultLayout.spec.ts` — exatamente um `theme-toggle` no header, nenhum inline residual.

## Phase 5: Regressão e fechamento

Antes de implementar, leia:
1. `.spec/features/landing-viewer-ui-refresh/SPEC.md` — requisitos RIGID que esta fase cobre
2. `.spec/features/landing-viewer-ui-refresh/PLAN.md` — decomposição completa, dependências e riscos

- [ ] T11 — Regressão: smoke test do header consolidado + suíte completa
      Arquivos: `test/DefaultLayout.spec.ts`
      Mudança: nenhuma mudança de produção — completar `test/DefaultLayout.spec.ts` com os casos finais: (a) fora do Viewer, logo visível e nenhum toggle duplicado; (b) no Viewer com dataset, logo + filename simultâneos, nome depois do logo; (c) exatamente um `ThemeToggle` no DOM em qualquer rota; (d) breakpoint 640px não quebra (ausência da regra órfã de `brand__badge`). Rodar `yarn test` completo.
      Cobre: RF-03, RF-04, RF-08, UI-01, UI-04 (regressão/fechamento)
      Acceptance criteria: `test/DefaultLayout.spec.ts` cobre os 4 casos acima e passa; `yarn test` roda a suíte completa (`RecentFiles`, `Dropdown`, `ViewerTable`, `StatsPanel`, `Dropzone`, `ThemeToggle` inclusos) com 0 falhas.
      Testes: `test/DefaultLayout.spec.ts` (casos finais) + `yarn test` (suíte completa).
