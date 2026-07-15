# CSV View — Backlog de Features (pós-MVP)

> Roadmap das funcionalidades futuras, fatiadas para o pipeline **`bc-harness:plan`**.
> O MVP (Fases 1–8) já está implementado. Cada linha abaixo vira **uma invocação de `/plan`**,
> que grava em `.spec/features/[slug]/` (`SPEC.md` + `PLAN.md` + `PHASES.md` executável pelo `ralph.sh`).

## Status do planejamento

| Feature | Planejada? | Artefatos |
|---|---|---|
| `table-interactions` | ✅ sim | `.spec/features/table-interactions/` (SPEC v1.1, PLAN, PHASES — 12 tarefas / 11 fases) |
| `rich-types-and-stats` | ✅ sim | `.spec/features/rich-types-and-stats/` (SPEC v1.1, PLAN, PHASES — 7 tarefas / 2 fases) |
| `filters` | ✅ sim | `.spec/features/filters/` (SPEC v1.1, PLAN, PHASES — 6 tarefas / 4 fases) |
| demais (#4 em diante) | ⏳ pendente | rodar `/plan` por slug |

## Como usar este backlog

1. Escolha uma feature (comece pelo Tier 1, na ordem).
2. Rode `/plan` passando a descrição da feature (coluna **Escopo** + notas).
3. O `/plan` gera `.spec/features/[slug]/PHASES.md`.
4. Rode o `ralph.sh` nesse `PHASES.md` — mesmo fluxo das 8 fases do MVP.

**Granularidade:** cada feature é uma capacidade coesa que rende ~3–8 fases. Ordenação e colunas
avançadas foram agrupadas (ambas são UX de tabela); tipos e estatísticas idem (ambos alimentam
filtros/destaques). Evita specs anêmicas de uma tarefa só.

---

## Tier 1 — Completar o produto (adiado do MVP)

| # | Slug | Escopo | Depende de | Tamanho |
|---|------|--------|-----------|---------|
| 1 | `table-interactions` | Ordenação (simples + multi-coluna), redimensionar, reordenar e fixar colunas | — | M |
| 2 | `rich-types-and-stats` | Expandir inferência de tipo (inteiro/decimal, booleano, e-mail, URL) + métricas soma e mediana | — | M |
| 3 | `filters` | Filtros por tipo de dado (igual, diferente, contém, não contém, maior/menor, entre, intervalo de datas, vazio/preenchido), combináveis | 2 | G |
| 4 | `export` | Exportar para CSV, JSON, Excel, Markdown e SQL INSERT (respeitando filtros e colunas visíveis) | 3 | M |
| 5 | `visual-highlights` | Destacar automaticamente: células vazias, valores duplicados, números negativos, datas inválidas, valores inconsistentes | 2 | M |
| 6 | `sessions` | Persistir no IndexedDB: filtros aplicados, ordenação, colunas ocultas, config da tabela e preferências | 1, 3 | M |
| 7 | `cell-editing` | Editar células, desfazer/refazer alterações, salvar uma nova versão do arquivo | — | G |
| 8 | `file-comparison` | Abrir 2 CSVs simultaneamente e diferenciar: registros adicionados, removidos e alterados | — | G |

## Tier 2 — Possíveis Evoluções (avançado)

| # | Slug | Escopo | Depende de | Tamanho |
|---|------|--------|-----------|---------|
| 9  | `sql-duckdb` | Consultas SQL sobre o dataset via DuckDB WASM | — | G |
| 10 | `charts` | Geração automática de gráficos por coluna | 2 | M |
| 11 | `dashboards` | Dashboards interativos combinando múltiplos gráficos | 10 | G |
| 12 | `merge-files` | União de múltiplos arquivos CSV | 8 | M |
| 13 | `data-quality` | Detecção automática de inconsistências nos dados | 2 | M |
| 14 | `ai-assistant` | Assistente de IA: explicar datasets, gerar filtros, identificar padrões, responder em linguagem natural | 3, 9 | G |
| 15 | `pwa-offline` | Aplicação como PWA com suporte offline | — | M |
| 16 | `desktop-tauri` | Versão desktop usando Tauri | — | G |
| 17 | `plugins` | Sistema de plugins para estender funcionalidades | — | G |

> Tamanho: **P** ≈ 2–3 fases · **M** ≈ 3–5 fases · **G** ≈ 5–8 fases (estimativa para o `/plan`).

---

## Grafo de dependências

```
Tier 1
  table-interactions ─────────────┐
                                   ├──► sessions
  rich-types-and-stats ──┬── filters ──► export
                         ├── visual-highlights
                         └── (base p/ data-quality, charts)
  cell-editing        (independente)
  file-comparison ─────────────────► merge-files

Tier 2
  charts ──► dashboards
  sql-duckdb ──┐
  filters ─────┴──► ai-assistant
  rich-types-and-stats ──► data-quality
  pwa-offline / desktop-tauri / plugins  (independentes)
```

## Ordem recomendada

**Fase A (base + uso diário):** `table-interactions` → `rich-types-and-stats`
**Fase B (vitrine):** `filters` → `export` → `visual-highlights`
**Fase C (produtividade):** `sessions` → `cell-editing` → `file-comparison`
**Fase D (evoluções):** `sql-duckdb` → `charts` → `dashboards` → `merge-files` → `data-quality` → `ai-assistant` → `pwa-offline` → `desktop-tauri` → `plugins`

Racional: o Tier 1 destrava o uso diário e cria a **base tipada** de que filtros, destaques,
data-quality e o assistente de IA dependem. Exportação rende mais depois de filtros (exportar o
resultado filtrado). Sessões só fazem sentido quando já há filtros/ordenação/colunas para persistir.

---

## Notas de decisão pendentes (resolver no `/plan` de cada feature)

- **`export` → Excel:** biblioteca client-side (ex.: `xlsx`/SheetJS) vs. gerar `.xlsx` puro — impacto no bundle.
- **`sql-duckdb`:** DuckDB WASM adiciona ~megabytes ao bundle; carregar sob demanda (lazy).
- **`ai-assistant`:** modelo local (WebLLM) vs. API externa — a última quebra o princípio "100% no navegador / nada sai do computador".
- **`cell-editing`:** salvar "nova versão" grava outro registro em `files` (respeitando o LRU de 10) ou exporta arquivo?
- **`file-comparison` / `merge-files`:** exigem 2+ datasets em memória ao mesmo tempo — revisar `useCurrentDataset` (hoje single-dataset).
