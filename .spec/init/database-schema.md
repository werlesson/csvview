# CSV View — Database Schema

<!-- inputs: project-description.md@sha256:a074e9513cf1 user-stories.md@sha256:60c1a7288d59 -->

## Overview

CSV View **não tem banco de servidor**. A única camada de persistência é o **IndexedDB do
navegador** (US-4.1), usado para guardar os arquivos abertos (para reabrir sem novo upload)
e as preferências do usuário. O DBML abaixo é uma **representação de referência** dos
*object stores* do IndexedDB — não é SQL a ser migrado. As duas entidades persistidas são
**`files`** (o arquivo carregado, com conteúdo em texto bruto + metadados) e **`settings`**
(preferências chave/valor, como o tema).

Convenções em vigor: como o IndexedDB é um armazenamento **não-relacional (key/object
store)**, não há chaves estrangeiras nem tabelas de lookup reais — campos categóricos (como
o delimitador) são guardados como string com um conjunto de valores documentado (ver
*Lookup Table Seeds*). Tudo o que é **derivado** do conteúdo (dataset parseado, colunas,
tipos inferidos, estatísticas, resultados de busca) é **calculado em runtime e não
persistido**.

## Schema (DBML)

```dbml
// IndexedDB object stores modelados como tabelas DBML (referência, não SQL).
// Sem FKs/lookup reais: o IndexedDB é key/object store.

// Arquivos abertos e persistidos para reabertura (recentes). US-4.1
Table files {
  id bigint [pk, increment]          // chave do object store (auto-incremento)
  name varchar [not null]            // nome original do arquivo
  delimiter varchar [not null]       // categórico: comma | tab | semicolon (ver seeds)
  size_bytes bigint [not null]       // tamanho do conteúdo original
  row_count bigint [not null]        // nº de linhas de dados (sem o cabeçalho)
  column_count int [not null]        // nº de colunas do cabeçalho
  content text [not null]            // conteúdo bruto do arquivo (re-parseado ao abrir)
  created_at timestamp [not null]    // quando foi aberto pela primeira vez
  last_opened_at timestamp [not null]// última reabertura (ordena a lista de recentes)
}

// Preferências do usuário (chave/valor). Ex.: tema claro/escuro.
Table settings {
  key varchar [pk]                   // ex.: "theme"
  value varchar [not null]           // ex.: "dark" | "light"
  updated_at timestamp [not null]
}
```

## Relationships

- Não há relacionamentos: o IndexedDB é um armazenamento não-relacional e os dois stores
  (`files`, `settings`) são independentes.
- A lista de **arquivos recentes** não é uma tabela separada — é o próprio store `files`
  ordenado por `last_opened_at` decrescente.

## Lookup Table Seeds

Como não há tabelas de lookup relacionais, abaixo ficam os **conjuntos de valores
documentados** dos campos categóricos e os defaults do store `settings`:

- **`files.delimiter`** (valores possíveis): `comma` (`,` — `.csv`), `tab` (`\t` — `.tsv`),
  `semicolon` (`;` — variantes de `.csv`/`.txt`). O valor é inferido no parse (US-1.1).
- **`settings`** (linha inicial/seed): `key = "theme"`, `value = "dark"` (default do design).

## Notes & Conventions

- **Motor de armazenamento:** IndexedDB (navegador). O DBML é só documentação da forma dos
  object stores; não existe migração/DDL de servidor.
- **Sem FK/lookup/enum:** por ser key/object store, campos categóricos ficam como string com
  conjunto de valores documentado (regra da casa "sem coluna enum" respeitada: `delimiter` é
  `varchar`, não `enum`).
- **Conteúdo em texto bruto:** `files.content` guarda o arquivo original; o dataset é
  **re-parseado ao abrir** (decisão do desenvolvedor), evitando versionar formato parseado.
- **Recentes = `files` ordenado:** índice recomendado por `last_opened_at` para listar
  rápido os recentes (US-4.1).
- **Gestão de quota (open question):** política de limite/limpeza dos arquivos persistidos
  (quantos manter, expiração, quota do navegador) ainda indefinida — pode exigir, no futuro,
  um flag `pinned`/`is_favorite` em `files`.

### Cobertura de conceitos não persistidos

- **Dataset, Coluna, Estatísticas da coluna:** derivados em runtime a partir de
  `files.content`; não persistidos.
- **Renderização de célula, Tabela virtualizada, Busca global:** comportamento de UI/runtime;
  não persistidos.
- **Client-side / privacidade:** princípio do produto, não um dado.

## Open Questions

- **Gestão do IndexedDB:** quantos arquivos manter, expiração/remoção e comportamento ao
  atingir a quota do navegador. Pode introduzir um `pinned boolean` em `files`.
