# RAG Implementation Plan — Lev-Boots

Embedding provider: **Gemini** (`gemini-embedding-001`, requested at 768 dimensions → `embeddings_768` column).
LLM for answers: **Gemini** (`gemini-2.5-flash`, thinking disabled, per README).

## 1. Dependencies

Install in `server/`:

- `pdf-parse` — read local PDF files
- `@google/genai` — Gemini embeddings + generation

```
npm install pdf-parse @google/genai -w server
```

## 2. New files

| File | Responsibility |
|---|---|
| `server/services/chunking.ts` | Split raw text into ~400-**word** chunks: split into paragraphs, greedily merge consecutive paragraphs while under 400 words, and split an oversized paragraph into relatively even, sentence-safe pieces (never mid-sentence, never over 400 words) |
| `server/services/embeddings.ts` | Wrap Gemini embedding calls (single + batch, with retry/backoff for rate limits) |
| `server/services/loaders/pdfLoader.ts` | Read the 3 PDFs from `knowledge_pdfs/`, return `{ source_id, text }[]` |
| `server/services/loaders/articleLoader.ts` | Fetch the 5 markdown articles from the gist URLs |
| `server/services/loaders/slackLoader.ts` | Paginate the 3 Slack channels until a page returns no more messages |
| `server/services/ragService.ts` | Orchestrates `loadAllData` (loaders → chunk → embed → store) and `ask` (embed question → similarity search → prompt → generate) |

## 3. `loadAllData` steps

1. For each loader (pdf, article, slack), fetch raw documents as `{ source: 'pdf'|'article'|'slack', source_id: string, text: string }`.
2. Chunk each document's text via `chunking.ts` (paragraph-based, targeting ~400 words per chunk).
3. **Skip already-loaded chunks**: before embedding, check `knowledge_base` for existing `(source, source_id, chunk_index)` rows and skip them — avoids re-spending Gemini quota on repeat runs.
4. Embed remaining chunks via Gemini (batch where possible; otherwise sequential with small delay to respect free-tier rate limits).
5. Bulk-insert rows into `knowledge_base`: `source`, `source_id`, `chunk_index`, `chunk_content`, `embeddings_768`.
6. Log a summary (documents fetched, chunks created, chunks skipped, chunks embedded).

## 4. `ask(userQuestion)` steps

1. Embed `userQuestion` with the same Gemini embedding model.
2. Run a pgvector similarity search (cosine distance, `<=>` operator) against `embeddings_768`, `ORDER BY distance LIMIT ~5`.
3. Build a prompt that includes the retrieved chunks as context and instructs the model to answer **only** from that context (and say it doesn't know if the answer isn't present).
4. Call Gemini to generate the answer (thinking disabled).
5. Return the answer string to the controller.

## 5. Data sources reference

- **PDFs** (local, `server/knowledge_pdfs/`):
  - `OpEd - A Revolution at Our Feet.pdf`
  - `Research Paper - Gravitational Reversal Physics.pdf`
  - `White Paper - The Development of Localized Gravity Reversal Technology.pdf`
- **Articles** (fetch, 5x):
  `https://gist.githubusercontent.com/JonaCodes/394d01021d1be03c9fe98cd9696f5cf3/raw/article-X_ARTICLE_ID.md`
  where `X` = 1–5 and `ARTICLE_ID` in order = `military-deployment-report`, `urban-commuting`, `hover-polo`, `warehousing`, `consumer-safety`
- **Slack** (paginate per channel until empty):
  `https://lev-boots-slack-api.jona-581.workers.dev/?channel=<channel>&page=<n>`
  channels: `lab-notes`, `engineering`, `offtopic`

## 6. Testing plan

1. `POST /load_data` — confirm `{ ok: true }`, then check row counts in `knowledge_base` (expect rows from all 3 sources).
2. Re-run `POST /load_data` — confirm it skips already-embedded chunks (no duplicate rows, minimal Gemini calls).
3. `POST /ask` with a question clearly answerable from one PDF — verify correct, grounded answer.
4. `POST /ask` with a question spanning multiple sources (e.g. PDF + Slack) — verify retrieval pulls from both.
5. `POST /ask` with an unrelated/unanswerable question — verify the model says it doesn't know rather than hallucinating.

## 7. Open items / assumptions

- Embedding dimension: **768** (Gemini default) — `embeddings_1536` column stays unused.
- `GEMINI_API_KEY` already set in `server/.env`.
- Rate limiting: sequential embedding calls with light delay/backoff to stay under free-tier limits; safe to re-run `loadAllData` incrementally.
- **Slack loader re-enabled** in `ragService.ts` — `fetchAllDocuments` now fetches PDFs, articles, and Slack (3 channels: `lab-notes`, `engineering`, `offtopic`) together.

## 8. End-to-end verification (done)

- `POST /load_data` → `{ ok: true }`, 28 rows stored (13 PDF chunks + 15 article chunks), all with non-null `embeddings_768`.
- Re-running `POST /load_data` completed in ~2s and left the row count at 28 (skip-existing logic confirmed working).
- `POST /ask` with a grounded question returned a correct, source-backed answer.
- `POST /ask` with an unrelated question returned `"I don't know."` instead of hallucinating.

## 9. Retrieval bug found & fixed (chunking + similarity limit) — [superseded, see §10]

> Historical record only: this describes a bug in the section-aware chunking approach that has
> since been replaced by a simpler paragraph/sentence-based, character-count algorithm (§10).
> `chunking.ts` no longer has section/heading detection, so this specific fix no longer applies.

While exercising `ask`, the question *"How much time did the 12-hour training reduce from?"*
incorrectly returned `"I don't know."` even though the answer was in the database. Diagnosis:
the right chunk (White Paper, section 2.1) ranked #6 in similarity — one place outside the
`LIMIT 5` cutoff — because it had been merged with two unrelated subsections (2.2, 2.3) into one
diluted 400-word chunk. Full root-cause writeup: [docs/chunking.md](docs/chunking.md#why-section-aware-not-just-paragraph-based),
[docs/rag-service.md](docs/rag-service.md#retrieval-bug-found-and-fixed-similarity_search_limit-5--7).

Fix (both applied):
1. `chunking.ts` — numbered section headings (`2.1`, `1.5`, `1.1.`, `2.`) are now **hard chunk
   boundaries**; merging across them is never allowed, even into an undersized chunk. Root-cause
   fix for the dilution.
2. `ragService.ts` — `SIMILARITY_SEARCH_LIMIT` raised **5 → 7** as a cheap safety margin.

Re-verification after both fixes:
- `knowledge_base` truncated and reloaded from scratch (chunk boundaries/indexes changed, so the
  old rows were stale) — **52 chunks** now (37 PDF + 15 article, Slack still disabled).
- The training-time question now returns the correct answer.
- The 3 previously-passing questions (LV-1 hover time, Hover Polo, unrelated France question) were
  re-run and still pass — no regressions.
- Along the way, also caught and fixed a **regex false-positive** in the new hard-boundary logic
  itself: a mid-sentence fragment like `"3 stability rating)..."` (where PDF line-wrapping happened
  to start a line with a bare digit) was matching the numbered-heading pattern and wrongly forcing
  a permanent split mid-paragraph. Fixed by requiring either a dotted subsection or a mandatory
  trailing period after a bare integer, and by restricting the hard-boundary flag to *only* that
  strict numbered pattern (not the weaker generic short-line heading heuristic used for titles like
  `"Abstract"`).

## 10. Chunking reset — simpler, character-based algorithm

The section-aware `chunking.ts` (§9) was replaced with a simpler approach, still targeting ~400
words per chunk:

1. Split raw text into paragraphs (blank-line split).
2. Greedily merge consecutive paragraphs into a chunk as long as the combined word count stays at
   or under 400.
3. If a single paragraph is itself longer than 400 words, split it — but **only on sentence
   boundaries**, never mid-sentence. Rather than greedily filling each piece to 400 words (which
   tends to produce one full piece plus a small leftover), sentences are distributed into a
   *balanced* number of pieces: pieces-needed is estimated as `ceil(totalWords / 400)`, and
   sentences are grouped toward an even target size per piece (e.g. 500 words → 200 + 300, not
   400 + 100). 400 words remains a hard cap. (Last-resort fallback: a single sentence longer than
   400 words on its own is cut at a word boundary, never mid-word.)

No heading/section detection, no minimum chunk size, no hard section boundaries — that entire
mechanism from §9 is gone. See [docs/chunking.md](docs/chunking.md) for the current authoritative
description.
