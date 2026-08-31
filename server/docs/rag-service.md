# `ragService.ts`

## Purpose

The orchestrator. Contains no source-fetching or chunking logic itself — it calls the loaders and
`chunking.ts`/`embeddings.ts` in the right order, and is the only file that talks to the database
directly (both through the `KnowledgeBase` Sequelize model and raw SQL for the vector column, see
below). Implements the two functions the README requires: `loadAllData` and `ask`. It also owns
its own Gemini client for **generation** (`gemini-2.5-flash`) — separate from `embeddings.ts`'s
client, which is dedicated to embeddings only.

## Why raw SQL for the `embeddings_768` column

The actual Postgres column type is `vector(768)` (pgvector), not a plain array — but the
Sequelize model declares it as `DataTypes.ARRAY(DataTypes.REAL)` (see `models/KnowledgeBase.ts`),
since Sequelize has no native pgvector type. Relying on Sequelize's own array serialization to
write/compare a `vector` column is fragile (Postgres array literal syntax `{1,2,3}` doesn't match
pgvector's expected `[1,2,3]` text format). To avoid that mismatch entirely, `ragService.ts`:

- Converts a JS `number[]` embedding to a pgvector text literal itself: `toVectorLiteral(embedding)`
  → `"[0.1,0.2,...]"`.
- Uses `sequelize.query(...)` with named replacements and an explicit `::vector` cast for both the
  `INSERT` in `loadAllData` and the similarity-search `SELECT` in `ask`, instead of going through
  `KnowledgeBase.create`/`findAll` for anything touching `embeddings_768`.
- Still uses the plain `KnowledgeBase` model (`findAll`) for reading `source`/`source_id`/
  `chunk_index` in the skip-check, since those are ordinary columns with no type mismatch.

Verified against the live Supabase database: inserts and the `<=>` cosine-distance similarity
search both work correctly with this approach.

## `loadAllData()` process

1. **Fetch all sources:** call `pdfLoader` and `articleLoader` (in parallel via `Promise.all`) to
   get a combined list of `RawDocument`s. **`slackLoader` is temporarily commented out** — both
   the import and the call — per explicit request, to avoid hitting the Slack API while the rest
   of the pipeline is being built/tested. Re-enable by uncommenting `fetchAllDocuments`.
2. **Chunk each document:** run each document's `text` through `chunking.ts` to get an ordered
   list of ~400-word chunks.
3. **Skip already-loaded chunks:** load every existing `(source, source_id, chunk_index)` from
   `knowledge_base` into a `Set` up front, and filter each document's chunks against it before
   embedding anything. This makes `loadAllData` safe to re-run without re-spending Gemini quota or
   creating duplicate rows — verified: a second run completed in ~2s (vs. the full run) and left
   the row count unchanged.
4. **Embed remaining chunks:** for each document, batch its new (not-yet-stored) chunks through
   `embeddings.ts`'s `embedTexts`, then insert them (via the raw-SQL path above) right after that
   document's batch finishes — so progress is saved per-document rather than only at the very end.
5. **Log a summary:** documents fetched, total chunks, chunks skipped, chunks newly embedded.

Verified end-to-end against the live PDFs/articles (after the chunking fix below, and a full
`TRUNCATE` + reload since changing the chunker changes chunk boundaries/indexes): **52 chunks**
stored (37 from the 3 PDFs, 15 from the 5 articles), all with non-null `embeddings_768`.

## `ask(userQuestion)` process

1. **Embed the question:** `embedText` from `embeddings.ts` (same model as used for storage, so
   the vectors are comparable).
2. **Similarity search:** raw SQL query ordering `knowledge_base` by `embeddings_768 <=>
   :queryEmbedding::vector` (pgvector cosine distance), `LIMIT 7`.
3. **Build the prompt:** the top matches are labeled with their `source`/`source_id` and joined
   into a context block; the prompt explicitly instructs the model to answer *only* from that
   context and say it doesn't know otherwise.
4. **Generate the answer:** `ai.models.generateContent` with `model: 'gemini-2.5-flash'` and
   `thinkingConfig: { thinkingBudget: 0 }` (thinking disabled, per README, to save tokens/rate
   limit).
5. **Return** `response.text` (falls back to `"I don't know."` if the model returns no text).

Verified live: a grounded question ("How long could the LV-1 Daedalus prototype hover, and what
limited it?") returned a correct, source-backed answer; an unrelated question ("What is the
capital of France?") correctly returned `"I don't know."` instead of hallucinating.

## Retrieval bug found and fixed: `SIMILARITY_SEARCH_LIMIT` (5 → 7)

A real question — *"How much time did the 12-hour training reduce from?"* — returned `"I don't
know."` even though the answer existed in the database. Diagnosis (ran the full similarity ranking
with no `LIMIT`, not just the top-5): the correct chunk ranked **#6**, one place outside the
`LIMIT 5` cutoff. Root cause: that chunk mixed 3 unrelated White Paper subsections together (see
["Why section-aware, not just paragraph-based"](chunking.md#why-section-aware-not-just-paragraph-based)
in `chunking.md`) — diluting its embedding just enough to fall short of the top 5. Fixed in two
complementary ways:

1. **`chunking.ts`** now treats numbered-section headings as hard chunk boundaries (root-cause fix
   — see `chunking.md`), so this kind of topic-dilution shouldn't recur.
2. **`SIMILARITY_SEARCH_LIMIT` raised from 5 to 7** here, as a cheap safety margin on top of that —
   costs a bit more prompt size per question, not per-embedding-call, so negligible for this
   project's scale.

Re-verified after both fixes (and a full table reload): the training-time question now returns the
correct answer, and the three previously-passing questions (LV-1 hover time, Hover Polo, the
unrelated France question) still pass — no regressions.

## Used by

- `controllers/ragController.ts` — `loadData` calls `loadAllData()`, `askQuestion` calls `ask()`.
