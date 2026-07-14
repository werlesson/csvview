# CSV View — User Stories

<!-- inputs: project-description.md@sha256:a074e9513cf1 -->

## Overview

CSV View é um explorador de arquivos CSV/TSV que roda 100% no navegador, sem backend: o
usuário abre um arquivo, navega pela tabela e inspeciona estatísticas por coluna sem que os
dados saiam da máquina. Este documento cobre o **MVP** — as telas de **Upload** e
**Viewer** (com painel de estatísticas e arquivos recentes). Features adiadas (filtros
avançados, exportação, comparação e destaques visuais) ficam fora deste backlog até o MVP
fechar.

Como o app é anônimo e local, há um único tipo de usuário. Não há autenticação, papéis nem
permissões.

**User Types:**
- **Usuário** - qualquer pessoa (inclusive não-técnica) que recebe um arquivo CSV/TSV e quer visualizá-lo e entendê-lo no navegador, sem Excel e sem enviar os dados para um servidor.

---

## 1. Importação de arquivos

### US-1.1: Abrir um CSV por arrastar-e-soltar ou seleção
**As a** Usuário
**I want to** soltar um arquivo na dropzone ou selecioná-lo pelo seletor de arquivos
**So that** eu comece a visualizar meus dados sem configuração

**Acceptance Criteria:**
- [ ] A dropzone aceita arrastar-e-soltar e também abre o seletor de arquivo ao clicar em "Escolher arquivo".
- [ ] São aceitos os formatos `.csv`, `.tsv` e `.txt`.
- [ ] Durante o arraste sobre a dropzone há um estado visual de "drag-over".
- [ ] Ao carregar, o app detecta o delimitador (`,` para `.csv`, tab para `.tsv`, detecção por conteúdo para `.txt`).
- [ ] A primeira linha é tratada como cabeçalho por padrão.
- [ ] Após o parse, o app navega automaticamente para o Viewer com o dataset carregado.

**Expected Result:** o arquivo é parseado inteiramente no navegador e o Viewer abre exibindo os dados.

---

### US-1.2: Tratar arquivos inválidos ou problemáticos
**As a** Usuário
**I want to** receber um feedback claro quando o arquivo não puder ser lido normalmente
**So that** eu entenda o que houve em vez de ver uma tela quebrada

**Acceptance Criteria:**
- [ ] Arquivo vazio (0 bytes ou sem linhas) exibe uma mensagem de erro em vez de abrir uma tabela vazia.
- [ ] Extensão/tipo não suportado é rejeitado com mensagem explicando os formatos aceitos.
- [ ] Linhas com número de colunas divergente do cabeçalho são exibidas sem quebrar o layout (células faltantes ficam vazias; excedentes são preservadas ou sinalizadas).
- [ ] Um arquivo sem cabeçalho detectável ainda é aberto, tratando a primeira linha como cabeçalho.
- [ ] O parse ocorre sem bloquear a interface (feedback de carregamento visível para arquivos maiores).

**Expected Result:** entradas problemáticas produzem mensagens compreensíveis ou degradação suave, nunca um travamento.

---

## 2. Visualização da tabela

### US-2.1: Navegar pela tabela de dados
**As a** Usuário
**I want to** ver os dados do arquivo em uma tabela navegável
**So that** eu leia e explore o conteúdo linha a linha

**Acceptance Criteria:**
- [ ] A tabela renderiza cabeçalho fixo e as linhas de dados do dataset.
- [ ] A renderização é virtualizada: apenas as linhas visíveis são montadas, para suportar arquivos com muitas linhas sem travar.
- [ ] Colunas numéricas são alinhadas à direita em fonte monoespaçada.
- [ ] Células com valor `null`/`undefined`/vazio são exibidas como um travessão (—) em itálico.
- [ ] A toolbar mostra o nome do arquivo e a contagem total de linhas.

**Expected Result:** o usuário consegue rolar e ler toda a tabela de forma fluida, mesmo em arquivos grandes.

---

### US-2.2: Buscar em toda a tabela
**As a** Usuário
**I want to** digitar um termo e filtrar as linhas que o contêm
**So that** eu encontre rapidamente registros de interesse

**Acceptance Criteria:**
- [ ] Um campo de busca ("Buscar em tudo…") está disponível na toolbar do Viewer.
- [ ] A busca casa o termo em qualquer célula de qualquer coluna.
- [ ] A tabela é atualizada para mostrar apenas as linhas que casam com o termo.
- [ ] Limpar o campo de busca restaura todas as linhas.
- [ ] Uma busca sem resultados exibe um estado de "nenhuma linha encontrada".

**Expected Result:** a tabela reflete em tempo real as linhas que correspondem ao termo buscado.

---

### US-2.3: Escolher quais colunas exibir
**As a** Usuário
**I want to** mostrar ou ocultar colunas
**So that** eu foque apenas nos campos relevantes

**Acceptance Criteria:**
- [ ] Um seletor de colunas na toolbar lista todas as colunas do dataset.
- [ ] Ocultar uma coluna a remove da tabela; reexibi-la a traz de volta.
- [ ] A busca e as estatísticas continuam corretas independentemente das colunas ocultas.

**Expected Result:** a tabela exibe somente as colunas escolhidas pelo usuário.

---

## 3. Estatísticas por coluna

### US-3.1: Inspecionar estatísticas de uma coluna
**As a** Usuário
**I want to** ver métricas resumidas de uma coluna
**So that** eu entenda a qualidade e a forma dos dados sem cálculos manuais

**Acceptance Criteria:**
- [ ] Ao selecionar uma coluna, um painel de estatísticas é exibido para ela.
- [ ] O painel mostra o tipo inferido da coluna: `número`, `data` ou `texto`.
- [ ] Para toda coluna, mostra: nulos, únicos, duplicados e preenchido (contagens/quantidades).
- [ ] Para colunas numéricas, mostra também mínimo, máximo e média.
- [ ] Para colunas numéricas, exibe um mini-histograma de distribuição.
- [ ] As estatísticas são calculadas client-side sobre o dataset atualmente carregado.

**Expected Result:** o usuário obtém um resumo estatístico imediato e correto de qualquer coluna.

---

## 4. Arquivos recentes

### US-4.1: Ver e reabrir arquivos recentes
**As a** Usuário
**I want to** ver a lista de arquivos que já abri e reabrir um deles
**So that** eu retome a análise sem refazer o upload

**Acceptance Criteria:**
- [ ] A tela de Upload lista os arquivos recentes com nome, número de linhas, tamanho e há quanto tempo foram abertos.
- [ ] Cada arquivo aberto é persistido com conteúdo completo em IndexedDB.
- [ ] Clicar em um recente recarrega o conteúdo persistido e abre o Viewer sem exigir novo upload.
- [ ] Quando não há recentes, a lista exibe um estado vazio.

**Expected Result:** o usuário reabre um arquivo previamente carregado com um clique, a partir do armazenamento local.

---

## Open Questions

- **Porte máximo de arquivo:** meta oficial de suporte (tamanho/linhas) ainda indefinida; afeta a agressividade da virtualização e o uso de Web Worker no parse (US-1.1, US-2.1). A decidir em `/init:project-phases`.
- **Idioma (i18n):** MVP tratado como pt; alternância pt/en fica fora do escopo por ora.
- **Gestão do IndexedDB:** política de limite/limpeza dos arquivos persistidos (quota, quantidade de recentes, expiração/remoção) — relevante para US-4.1.

---

## Appendix: User Story Status

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| US-1.1 | Abrir um CSV por arrastar-e-soltar ou seleção | High | Pending |
| US-2.1 | Navegar pela tabela de dados | High | Pending |
| US-3.1 | Inspecionar estatísticas de uma coluna | High | Pending |
| US-4.1 | Ver e reabrir arquivos recentes | High | Pending |
| US-1.2 | Tratar arquivos inválidos ou problemáticos | Medium | Pending |
| US-2.2 | Buscar em toda a tabela | Medium | Pending |
| US-2.3 | Escolher quais colunas exibir | Medium | Pending |
