# CSV View — Project Description

## Overview

**CSV View é um explorador de arquivos CSV/TSV que roda 100% no navegador.** Não há
backend: o arquivo é lido, parseado e inspecionado inteiramente na máquina do usuário —
**os dados nunca saem do dispositivo**. O produto é entregue como um site estático
(SSG), então "abrir o app" é só carregar uma página; nenhuma linha de dado trafega para
um servidor.

O público-alvo é de **uso geral, incluindo pessoas não-técnicas**: qualquer um que recebe
um `.csv` e quer apenas *ver* e *entender* o conteúdo sem abrir Excel ou uma planilha
pesada. O valor central é a combinação de **privacidade** (client-side), **rapidez**
(sem upload para servidor) e uma **leitura rica** da tabela — não só as células, mas
estatísticas por coluna que dão contexto imediato sobre os dados.

O **núcleo do produto (MVP)** são duas telas: **(1) Upload** — soltar/selecionar um
arquivo e reabrir arquivos recentes — e **(2) Viewer** — a tabela navegável com um
**painel de estatísticas por coluna** (tipo inferido, nulos, únicos, duplicados,
min/max/média, distribuição) e busca global. Arquivos abertos são **persistidos no
navegador via IndexedDB** (conteúdo completo), para que o usuário reabra sem refazer o
upload.

Ficam **fora do MVP**, planejadas para depois: filtros avançados por coluna, exportação
(CSV/JSON/XLSX/MD/SQL), comparação (diff) de dois arquivos e realce visual condicional de
células. A referência visual completa dessas telas já existe em `.spec/init/design/`.

### Key Concepts

- **Arquivo (CSV/TSV):** dado delimitado carregado pelo usuário. Delimitador inferido a
  partir do conteúdo/extensão (`.csv` → vírgula, `.tsv` → tab, `.txt` → detecção). A
  primeira linha é tratada como **cabeçalho** por padrão.
- **Dataset:** a representação parseada de um arquivo — cabeçalho + linhas de dados.
- **Coluna:** um campo do dataset, com um **tipo inferido** (`número`, `data` ou `texto`).
- **Estatísticas da coluna:** métricas derivadas por coluna — **nulos**, **únicos**,
  **duplicados**, **preenchido**, e para numéricas **mínimo / máximo / média** +
  **distribuição** (mini-histograma).
- **Renderização de célula:** valores `null`/`undefined`/`''` são exibidos como um
  **placeholder em travessão (—) em itálico**; demais valores são convertidos para texto.
  (Regra já implementada em `app/components/CsvCell.vue`.)
- **Busca global:** filtro textual que casa em qualquer célula da tabela.
- **Arquivos recentes:** arquivos abertos anteriormente, **persistidos com conteúdo
  completo em IndexedDB** e reabríveis a partir da tela inicial sem novo upload.
- **Tabela virtualizada:** a tabela renderiza apenas as linhas visíveis, para suportar
  arquivos grandes sem travar o navegador.
- **Client-side / privacidade:** todo parsing, indexação e cálculo acontece no navegador;
  não há servidor de dados.

## Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| Linguagem | TypeScript `^7.0.2` |
| Framework | Nuxt `^4.4.8` + Vue `^3.5.39` |
| Roteamento | vue-router `^5.1.0` |
| Estilo | Tailwind CSS v4 (`@tailwindcss/vite`), entrypoint `app/assets/css/main.css` |
| Persistência | **IndexedDB** (navegador) — sem banco de servidor |
| Build / deploy | **Estático (SSG)** via `nuxt generate`, hospedagem em CDN/estático |
| Testes | Vitest `^4.1.10` + `@vue/test-utils` `^2.4.11` sob `happy-dom` |
| Type checking | `vue-tsc` `^3.3.7` |
| Runtime / dev | Node `>=22.12.0`, gerenciador `yarn` |
| Tipografia (design) | Geist / Geist Mono (ver `.spec/init/design/`) |

Sem backend, sem API HTTP, sem banco de servidor. Não há autenticação (o app é anônimo e
local).

## Core Workflows

### 1. Abrir / importar um CSV

1. Na tela de **Upload**, o usuário **arrasta** um arquivo para a dropzone ou usa
   **Escolher arquivo** (aceita `.csv`, `.tsv`, `.txt`).
2. O app **detecta o delimitador** e **parseia** o conteúdo no navegador (idealmente em
   Web Worker para não bloquear a UI).
3. A primeira linha vira **cabeçalho**; o restante vira as linhas do **dataset**.
4. O arquivo (conteúdo + metadados: nome, tamanho, nº de linhas, data) é **gravado em
   IndexedDB**.
5. O app navega para o **Viewer** com o dataset carregado.

Casos de borda: arquivo vazio, cabeçalho ausente/duplicado, linhas com nº de colunas
divergente, encoding não-UTF-8, arquivo muito grande (ver Open Questions).

### 2. Visualizar a tabela (Viewer)

1. O Viewer exibe a **tabela virtualizada** com cabeçalho fixo; colunas numéricas
   alinhadas à direita em fonte mono.
2. Células vazias aparecem como **— (travessão) em itálico** (`CsvCell.vue`).
3. A toolbar mostra: nome do arquivo, **busca global** ("Buscar em tudo…"), contagem de
   linhas e seletor de colunas.
4. A **busca global** filtra as linhas que casam com o termo em qualquer célula.

### 3. Inspecionar estatísticas de uma coluna

1. O usuário seleciona uma coluna (ou abre o painel de estatísticas).
2. O app mostra o **tipo inferido** (número/data/texto) e as métricas: **nulos, únicos,
   duplicados, preenchido**.
3. Para colunas numéricas, exibe também **mínimo, máximo, média** e um **mini-histograma**
   de distribuição.
4. As estatísticas são calculadas client-side sobre o dataset carregado.

### 4. Reabrir um arquivo recente

1. A tela de **Upload** lista os **arquivos recentes** lidos do IndexedDB (nome, nº de
   linhas, tamanho, "há quanto tempo").
2. Ao clicar em um recente, o app **recarrega o conteúdo persistido** e abre o Viewer
   **sem exigir novo upload**.

## Open Questions

- **Porte máximo de arquivo:** ainda não definido. Isso determina o quão agressiva precisa
  ser a arquitetura (parsing em Web Worker, virtualização da tabela, limites de memória). O
  mock de design ilustra 1,2M linhas / 8.4 MB, mas a meta oficial de suporte está em aberto
  — decidir em `/init:project-phases`.
- **Idioma (i18n):** o design traz textos em **pt e en**. Definir se o MVP é bilíngue ou
  apenas pt.
- **Gestão do IndexedDB:** política de limite/limpeza dos arquivos persistidos (quota do
  navegador, quantos recentes manter, expiração/remoção manual).
