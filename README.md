# שואלים בבראשית — Sefer Bereishit RAG

Ask questions about Sefer Bereishit (Genesis) in Hebrew and get answers grounded **only** in the
biblical text. Questions about events outside Bereishit get a fixed "not in Bereishit" answer —
the system never guesses which other book an event belongs to.

The project is a Retrieval-Augmented Generation (RAG) pipeline: the full Hebrew text of Bereishit
is split into meaningful passages, embedded into vectors and stored in Postgres (pgvector). Every
question is embedded the same way, the closest passages are retrieved, and only those passages are
handed to the LLM as context for the answer.

---

## Table of contents

- [Stack](#stack)
- [Project structure](#project-structure)
- [Running the project](#running-the-project)
- [API](#api)
- [The RAG pipeline in depth](#the-rag-pipeline-in-depth)
  - [Overview](#overview)
  - [1. Loading the text — Sefaria](#1-loading-the-text--sefaria)
  - [2. Cleaning the text](#2-cleaning-the-text)
  - [3. Chunking by petucha / setuma](#3-chunking-by-petucha--setuma)
  - [4. Embeddings](#4-embeddings)
  - [5. Storage — Postgres + pgvector](#5-storage--postgres--pgvector)
  - [6. Retrieval](#6-retrieval)
  - [7. The relevance gate — staying inside Bereishit](#7-the-relevance-gate--staying-inside-bereishit)
  - [8. Prompt and generation](#8-prompt-and-generation)
  - [Tunable parameters](#tunable-parameters)
- [Text source and license](#text-source-and-license)
- [Limits](#limits)

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite, TypeScript, plain CSS modules, Hebrew RTL UI with a right-side sidebar |
| Backend | Node.js + Express, TypeScript |
| Database | Postgres + [pgvector](https://github.com/pgvector/pgvector) via Sequelize (local or Supabase) |
| Embeddings | Google Gemini `gemini-embedding-001` (768 dimensions) |
| Generation | Google Gemini `gemini-2.5-flash` |
| Text source | [Sefaria API](https://www.sefaria.org/) |

## Project structure

```
.
├── client/                      React frontend
│   └── src/
│       ├── components/          Layout, Sidebar, QuestionForm, AnswerCard
│       ├── hooks/useAsk.ts      calls POST /api/ask
│       └── pages/               Home (ask a question), About (sources & attribution)
└── server/                      Express backend
    ├── controllers/             HTTP handlers (load_data, ask)
    ├── migrations/              torah_knowledge_base table + HNSW index
    ├── models/                  Sequelize models
    ├── services/
    │   ├── loaders/
    │   │   ├── sefariaLoader.ts fetch + clean the Hebrew text, parasha boundaries
    │   │   └── types.ts         TorahVerse / TorahChunk
    │   ├── chunking.ts          verses → chunks
    │   ├── embeddings.ts        Gemini embeddings with retry
    │   └── ragService.ts        ingestion + retrieval + generation
    └── docs/                    per-file documentation of the pipeline
```

## Running the project

1. `npm i` in the root directory (npm workspaces install both `client` and `server`).
2. Create `server/.env` with:
   - `DATABASE_URL` — Postgres with the pgvector extension (local or Supabase)
   - `GEMINI_API_KEY`
3. `npm run dev` in the root — runs client and server together. Migrations run automatically on
   server start.
4. Fill the knowledge base once: `POST /api/load_data` (safe to re-run; already-embedded chunks
   are skipped). Takes ~3 minutes on the Gemini free tier.
   ```bash
   curl -X POST http://localhost:3000/api/load_data
   ```
5. Open the UI at the URL Vite prints (default [http://localhost:5173/](http://localhost:5173/)).

## API

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/load_data` | — | `{ ok: true }` |
| `POST` | `/api/ask` | `{ userQuestion }` | `{ answer }`; `400` when `userQuestion` is missing; `429` when the Gemini quota is exhausted |

Example:

```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"userQuestion": "כמה שנים עבד יעקב אצל לבן?"}'
```

---

## The RAG pipeline in depth

### Overview

The pipeline has two phases: **ingestion** (run once, via `POST /api/load_data`) and **query**
(run on every `POST /api/ask`).

```
INGESTION
Sefaria API ─▶ sefariaLoader   fetch 50 chapters, clean verses, mark פ/ס section ends
            ─▶ chunking        one chunk per petucha/setuma, split evenly if > 400 words
            ─▶ embeddings      gemini-embedding-001, task type RETRIEVAL_DOCUMENT, 768 dims
            ─▶ Postgres        torah_knowledge_base (pgvector, HNSW cosine index)

QUERY
userQuestion ─▶ embeddings     gemini-embedding-001, task type RETRIEVAL_QUERY, 768 dims
             ─▶ pgvector       cosine distance, top 7 chunks
             ─▶ relevance gate keep chunks with distance <= 0.40
                               none left? ─▶ fixed answer "האירוע הזה אינו מופיע בספר בראשית."
             ─▶ prompt         chunks + question + strict grounding rules (Hebrew)
             ─▶ gemini-2.5-flash ─▶ answer
```

All of the orchestration lives in
[server/services/ragService.ts](server/services/ragService.ts); each stage has its own module and
its own doc under [server/docs/](server/docs/README.md).

### 1. Loading the text — Sefaria

[server/services/loaders/sefariaLoader.ts](server/services/loaders/sefariaLoader.ts)

- Fetches each of the 50 chapters of Genesis from `https://www.sefaria.org/api/texts/Genesis.<n>`,
  sequentially with a 150 ms pause between requests to stay polite to the public API.
- The Hebrew version used is *Miqra according to the Masorah*, which marks the traditional
  paragraph breaks — **petucha (פ)** and **setuma (ס)** — as
  `<span class="mam-spi-pe|samekh">` elements. The loader records each verse that ends such a
  section (`isSectionEnd`), which drives the chunking step.
- Each verse is tagged with its **parasha** (weekly Torah portion) using a hardcoded table of the
  12 parashot of Bereishit. These boundaries are fixed by tradition, so hardcoding them is safer
  and simpler than parsing Sefaria's alt-structure index.

### 2. Cleaning the text

The raw Sefaria HTML is far from what a user types, and anything that makes the stored text look
different from a question pushes their embeddings apart. `cleanVerseText` therefore:

| Removes / changes | Why |
|---|---|
| Footnotes (manuscript-variant notes like "בספרי תימן…") | Not part of the verse |
| Ketiv in ketiv/qere pairs — keeps only the qere | Users write what is read, not what is written |
| Section-marker spans (פ / ס) | Structural, already captured as `isSectionEnd` |
| HTML tags and entities (`&nbsp;`, `&thinsp;`) | Markup noise |
| Qere brackets, paseq (׀) | Punctuation noise |
| Maqaf (־) → space | Joined words would otherwise be tokenized as one |
| **Niqqud and taamim** (vowels and cantillation marks) | Questions are typed unpointed — pointed text embeds far from unpointed text |

### 3. Chunking by petucha / setuma

[server/services/chunking.ts](server/services/chunking.ts)

Instead of fixed-size windows, chunks follow the **text's own paragraph structure**: every
petucha/setuma section becomes one chunk. These sections are the Torah's native units of meaning
(a single story, a genealogy, a dialogue), so a retrieved chunk is usually a complete,
self-contained episode rather than a fragment cut mid-story.

- Sections longer than **400 words** are split into *evenly sized* parts — the number of parts is
  `ceil(words / 400)` and verses are distributed by a target size, not greedily filled, so there is
  no tiny leftover chunk at the end.
- A split never breaks inside a verse.
- Every chunk carries metadata: `book`, `parasha`, `perek_start`, `pasuk_start`, `perek_end`,
  `pasuk_end`, and a human-readable unique `ref` such as `Genesis 29:15-29:30`.

### 4. Embeddings

[server/services/embeddings.ts](server/services/embeddings.ts)

- Model: `gemini-embedding-001`, with `outputDimensionality: 768`.
- **Asymmetric task types:** chunks are embedded with `RETRIEVAL_DOCUMENT` and questions with
  `RETRIEVAL_QUERY`. Gemini places a short question closer to the passage that answers it than
  when both sides use the default symmetric embedding.
- Ingestion embeds chunks one at a time with a 1.5 s delay between calls (Gemini free-tier rate
  limits) and retries failed calls up to 5 times with linear backoff.
- Ingestion is **idempotent**: before embedding, the service loads all existing `ref`s from the
  table and only embeds new chunks, so a re-run after a partial failure resumes where it stopped
  and costs nothing when everything is already loaded.

### 5. Storage — Postgres + pgvector

Table `torah_knowledge_base` (created by
[the migration](server/migrations/20260907120000-create-torah-knowledge-base-table.cjs)), one row
per chunk:

| Column | Description |
|---|---|
| `book`, `parasha` | Source metadata |
| `perek_start`, `pasuk_start`, `perek_end`, `pasuk_end` | Verse range |
| `ref` | Unique reference, e.g. `Genesis 1:1-1:5` |
| `chunk_content` | Cleaned Hebrew text |
| `embeddings_768` | `vector(768)` |

The vector column is indexed with **HNSW** (`vector_cosine_ops`). An earlier IVFFlat index was
[replaced](server/migrations/20261004120000-replace-torah-ivfflat-with-hnsw.cjs): IVFFlat built on
an empty table gets meaningless centroids, and with `lists = 100` over ~100 rows the default
`probes = 1` scans a single list and can miss most relevant chunks. HNSW needs no training data and
keeps near-exact recall at this size.

### 6. Retrieval

The question embedding is compared against all chunks with pgvector's cosine distance operator:

```sql
SELECT ref, parasha, chunk_content,
       embeddings_768 <=> :queryEmbedding::vector AS distance
FROM torah_knowledge_base
WHERE embeddings_768 IS NOT NULL
ORDER BY distance ASC
LIMIT 7;
```

Cosine distance ranges from 0 (identical) to 2 (opposite). The top **7** chunks are retrieved —
enough to cover a story that spans several sections without flooding the prompt.

### 7. The relevance gate — staying inside Bereishit

The core requirement is that the system must **not** answer about events outside Bereishit, and
must never guess another book. This is enforced in two layers:

1. **Distance threshold (deterministic).** Retrieved chunks with distance above **0.40** are
   dropped. If none remain, the fixed answer `האירוע הזה אינו מופיע בספר בראשית.` is returned
   *without calling the LLM at all*. The threshold was calibrated on 38 sample questions:
   in-scope Bereishit questions scored ≤ 0.344 to their best chunk, while questions about other
   books or off-topic questions scored ≥ 0.350. 0.40 leaves margin for unusual in-scope phrasing.
2. **Prompt rule (semantic).** Questions about other Torah books that are similar enough to slip
   under the threshold (e.g. a question about Moshe that resembles a Bereishit passage) reach the
   LLM, which is instructed to reply with exactly the same fixed sentence when the event is not
   in the provided passages.

This gives a consistent, predictable "not in Bereishit" response instead of a hallucinated or
borrowed answer.

### 8. Prompt and generation

The prompt (in Hebrew) contains the relevant chunks — each labelled with its `ref` and parasha —
followed by the question and strict instructions:

- Answer **only** from the provided passages.
- If the event is not in the passages, reply with the exact fixed sentence — do not guess or fill
  in from other books.
- Be concise; answer in Hebrew, plain text, no Markdown.
- Do not mention the internal passage numbers (`[1]`, `[2]`, …).

Generation uses `gemini-2.5-flash` with `thinkingBudget: 0` — the task is extractive, so thinking
tokens add latency and cost without improving answers.

### Tunable parameters

| Constant | File | Value | Meaning |
|---|---|---|---|
| `MAX_CHUNK_WORDS` | `chunking.ts` | 400 | Split threshold for long sections |
| `EMBEDDING_DIMENSIONS` | `embeddings.ts` | 768 | Vector size |
| `DELAY_BETWEEN_CALLS_MS` | `embeddings.ts` | 1500 | Pause between ingestion embedding calls |
| `MAX_ATTEMPTS` | `embeddings.ts` | 5 | Embedding retries |
| `SIMILARITY_SEARCH_LIMIT` | `ragService.ts` | 7 | Chunks retrieved per question |
| `MAX_RELEVANT_DISTANCE` | `ragService.ts` | 0.40 | Relevance gate cutoff |
| `GENERATION_MODEL` | `ragService.ts` | `gemini-2.5-flash` | Answering model |

Changing `EMBEDDING_DIMENSIONS` requires a new migration for the vector column and a full
re-ingestion. Changing the chunking or cleaning rules requires clearing the table and re-running
`POST /api/load_data`, since existing `ref`s are skipped.

---

## Text source and license

The Hebrew text is *Miqra according to the Masorah* (מקרא על פי המסורה), fetched from the
[Sefaria API](https://www.sefaria.org/) and licensed **CC BY-SA**. The UI's "אודות ומקורות" page
carries the attribution.

## Limits

- Gemini free tier allows 5 generation requests per minute; extra requests get `429`.
- Ingestion takes ~3 minutes on the free tier because of embedding rate limits.
- Scope is Bereishit only, by design.
