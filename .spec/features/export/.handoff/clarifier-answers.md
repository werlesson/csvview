# Clarifier answers — export

Developer-confirmed resolutions for all 10 questions from the analyze pass. Apply in-place to SPEC.md and remove the corresponding `[NEEDS CLARIFICATION]` markers.

## Q-01 [Marker] ref RF-08 — Column order
**Decision:** Export column order follows `displayColumns` (pinned columns first, then user reordering) — same order the table currently displays, not the original header order (`visibleColumns`).

## Q-02 [Marker] ref RF-09–RF-13 — Empty-cell serialization
**Decision:** Export the raw empty value per format's native convention: empty string `""` for CSV/Markdown, `null` for JSON, `''`/`NULL` for SQL. The UI's `—` placeholder (`CsvCell.vue`) is rendering-only and must never appear in exported data.

## Q-03 [Marker] ref RNF-02 — XLSX generation approach
**Decision:** Use a third-party client-side library (e.g. SheetJS/`xlsx`). Mitigate bundle-size impact with a dynamic `import()` loaded only when the user selects the XLSX format (not eagerly bundled).

## Q-04 [Gap] ref RF-10 — XLSX row-limit handling
**Decision:** When the export scope exceeds Excel's per-sheet row limit (1,048,576), truncate to the limit and show a user-facing warning that the file was truncated. Do not block the export or split into multiple sheets.

## Q-05 [Gap] ref RF-12 — Markdown pipe/newline escaping
**Decision:** Escape literal `|` characters as `\|` and replace/strip embedded newlines with a space inside cell values, so the generated GFM table is always syntactically valid.

## Q-06 [Gap] ref RF-11 — JSON value typing
**Decision:** String passthrough — every value serializes as a JSON string exactly as stored in the internal `string[][]` model. Do not coerce numeric-typed columns to JSON `number`.

## Q-07 [Ambiguity] ref UI-01/RF-15 — Download button label
**Decision:** Dynamic label per selected format, matching the design mockup: "Baixar CSV", "Baixar JSON", "Baixar XLSX", "Baixar MD", "Baixar SQL".

## Q-08 [Gap] ref CT-02 — SQL export MIME type
**Decision:** Fix to `text/plain` (no registered IANA type for `.sql`; universally supported browser fallback).

## Q-09 [Gap] ref RF-16 — Modal dismiss interactions
**Decision:** Confirm as RIGID: both backdrop-click and Escape-key close the modal without exporting, consistent with the existing `FilterPanel` precedent.

## Q-10 [Gap] ref RNF-01 — Synchronous generation at scale
**Decision:** Synchronous main-thread generation is acceptable for this feature's scope (MVP), consistent with the existing `sortedRows` precedent. No new RNF for a max blocking-time budget or async/chunked generation — revisit only if a future performance complaint arises.
