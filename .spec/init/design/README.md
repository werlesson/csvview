# CSV View — Design System & Reference Screens

> Índice legível por agente para `.spec/init/design/`. A fonte visual completa é
> [`csv-view-design-system.html`](./csv-view-design-system.html) (bundle de Artifact,
> abra no navegador para ver renderizado). Este README existe porque o bundle é
> JS minificado e opaco para leitura em texto: use-o como **referência de design**
> nas tarefas de `/init:project-phases`. Cada tela abaixo é uma ref citável
> (ex.: `Design ref: .spec/init/design/README.md#screen-2--visualizador-principal`).

## Produto (conceito)

- **Tagline:** *"O explorador de CSV para quem vive nos dados."*
- **Princípio-chave:** **100% no navegador · seus dados não saem daqui** — processamento
  client-side, **sem backend**.
- Escopo do design: **6 telas de referência** + biblioteca de componentes base.

## Stack de design vs. implementação

- O design foi prototipado com **blocos shadcn-vue** (botões, inputs, badges, chips,
  tabs, tooltip, dropdown, modal).
- O projeto real é **Nuxt 4 + Vue 3 + Tailwind v4** (ver `AGENTS.md`). Ao implementar,
  reproduza a **aparência e o comportamento** destes componentes com Tailwind v4;
  não é obrigatório adotar shadcn-vue, mas os tokens abaixo são normativos.

## Design tokens

Dois temas. Default é **dark** (`state.theme = 'dark'`). Formato: `token = light / dark`.

### Cores

| Token | Light | Dark |
|-------|-------|------|
| `--bg` (fundo app) | `#fbfbfc` | `#08080a` |
| `--bg-1` (superfície) | `#ffffff` | `#0f0f12` |
| `--bg-2` (superfície 2) | `#f5f5f7` | `#161619` |
| `--bg-hover` | `#eeeef1` | `#1d1d22` |
| `--border` | `#e7e7ec` | `#232329` |
| `--border-strong` | `#d6d6dd` | `#31313a` |
| `--text` (primário) | `#17171c` | `#eaeaee` |
| `--text-2` (secundário) | `#5a5a66` | `#a1a1ac` |
| `--text-3` (terciário) | `#6a6a74` | `#9a9aa6` |
| `--accent` | `#5a4fe0` | `#6e62f7` |
| `--accent-hover` | `#4a3fce` | `#8a7fff` |
| `--accent-soft` | `rgba(90,79,224,.11)` | `rgba(110,98,247,.15)` |
| `--accent-fg` | `#ffffff` | `#ffffff` |
| `--success` | `#0f9d63` | `#3ecf8e` |
| `--warning` | `#c1830f` | `#f3b13c` |
| `--error` | `#dc3d43` | `#f2555a` |
| `--info` | `#2b7fff` | `#54a8ff` |
| `--shadow` | `0 8px 30px rgba(20,20,40,.12)` | `0 8px 30px rgba(0,0,0,.5)` |

Cada cor de status (`success/warning/error/info`) tem variante `-soft` para fundos de badge.

### Tipografia

- **Sans:** `Geist` (`--font`) · **Mono:** `Geist Mono` (`--mono`) — dados tabulares em mono.
- **Escala (px):** `12, 12.5, 13, 14, 15, 17, 19, 26, 34, 38, 44`.
  Corpo/UI ~`13–15`; títulos de seção `17–19`; hero `34–44`.

### Raio e espaçamento

- **Border-radius (px):** `2–14` para chips/inputs/botões/cards; `20` para pílulas/superfícies grandes.
- **Gaps de layout (px):** `10, 12, 14, 16, 18, 20, 24, 32, 44`.

## Telas de referência

Cada tela tem um cabeçalho `NN · <nome>`. Idioma default: **pt** (há EN em paralelo).

### Screen 1 — Tela inicial / upload
- **Título:** "Solte um CSV e comece a explorar." · marca `csvview.app` + selo `100% no navegador`.
- **Dropzone:** "Arraste um arquivo CSV aqui" / "ou selecione" / botão **Escolher arquivo**;
  formatos aceitos `.csv · .tsv · .txt`.
- **Arquivos recentes:** lista com nome, contagem de linhas, tamanho e "há quanto tempo"
  (ex.: `transactions_2026.csv · 1,204,882 linhas · 8.4 MB · 2m`).
- **Estados:** idle, drag-over, lista vazia (sem recentes).

### Screen 2 — Visualizador principal
- **Toolbar:** nome do arquivo, busca "Buscar em tudo…", botão **Filtros** (com badge de
  contagem), **Colunas**, contador de linhas (`1,204,882 linhas`), **Exportar**.
- **Tabela:** colunas `id, date, description, amount, status`; `amount` alinhado à direita em
  mono com sinal +/−; `status` como badge (`settled/pending/failed`).
- **Painel de estatísticas da coluna:** tipo (`number`), Nulos, Únicos, Duplicados,
  Preenchido, Mínimo, Máximo, Média, Distribuição (mini-histograma).
- Tela mais densa (~14.6k de markup) — é o core do produto.

### Screen 3 — Filtros avançados
- **Título:** "Filtros avançados" · sub "Combine múltiplas condições por coluna."
- **Regras:** linhas `Onde <coluna> <operador> <valor>` unidas por **E**
  (ex.: `amount is between -1000 e 0`; `status equals failed/pending/settled`).
- **Ações:** **Adicionar filtro**, **Limpar**, **Aplicar**.

### Screen 4 — Exportação
- **Título:** "Exportar dados" · sub "Escolha o formato e o escopo."
- **Formato:** `CSV · JSON · XLSX · MD · SQL`.
- **Escopo:** "Linhas filtradas" (`18,204`) vs "Todas as linhas" (`1,204,882`).
- **Opções:** Incluir cabeçalho, Aspas em todos os campos. **Ações:** Cancelar / **Baixar**.
- Renderizada como **modal**.

### Screen 5 — Comparação de arquivos
- **Título:** "Comparar arquivos" · resumo `+128 adicionadas · −54 removidas · ~312 alteradas`.
- **Visão lado a lado:** `transactions_v1.csv` vs `transactions_v2.csv`, linhas numeradas,
  realce de added/removed/changed.

### Screen 6 — Destaques visuais
- **Título:** "Destaques na tabela" — realce condicional de células.
- **Legendas/estados:** `vazio`, `duplicado`, `negativo`, `data inválida`.
- Tabela `id, date, customer, category, amount` demonstrando cada realce
  (célula vazia, linha duplicada `×3`, valor negativo, `05/13/26` como data inválida).

## Biblioteca de componentes (seção "Components")

Blocos base (aparência shadcn-vue, implementar em Tailwind v4):

- **Buttons:** Primary, Hover, Secondary, Ghost, Danger, Small, Disabled.
- **Inputs & select:** campo de busca "Buscar em tudo…", selects.
- **Badges & column chips:** `default`, `accent`, status (`settled/pending/failed`), `info`;
  chips de coluna com tipo (`date`, `amount`, `id · pinned`).
- **Tabs & tooltip**, **dropdown de filtro**, **modal**.

## Como usar em `/init:project-phases`

- Toda tarefa de tela/componente **deve** citar `Design ref:` apontando para a seção
  correspondente acima e ser **fiel** ao design (tokens, layout, estados).
- Cobertura de design: as 6 telas + componentes base cobrem o MVP do viewer de CSV.
  Telas fora desta lista → construir com default sensato **ou** abrir questão de design.
