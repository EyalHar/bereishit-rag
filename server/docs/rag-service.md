# `ragService.ts`

## Purpose

The orchestrator: calls the loader, chunker and embedder in order, and is the only file that
talks to `torah_knowledge_base` and to the Gemini generation model (`gemini-2.5-flash`, thinking
disabled).

## Why raw SQL for `embeddings_768`

The column is pgvector `vector(768)`, which Sequelize has no type for (the model declares it as
`ARRAY(REAL)`). Inserts and similarity search go through `sequelize.query` with a
`[1,2,3]` vector literal and an explicit `::vector` cast. The `TorahKnowledgeBase` model is used
only for reading plain columns (`ref`).

## `loadAllData()`

1. Fetch verses (`fetchGenesisVerses`) and chunk them (`chunkVerses`).
2. Load every existing `ref` and skip chunks already stored — re-running costs no Gemini quota.
3. Embed the remaining chunks, then insert them.
4. Log `chunks / embedded / skipped`.

## `ask(userQuestion)`

1. Embed the question.
2. Take the 7 nearest chunks by cosine distance (`<=>`).
3. **Distance gate:** keep only chunks with distance ≤ `MAX_RELEVANT_DISTANCE` (0.40). If none
   remain, return the fixed answer `האירוע הזה אינו מופיע בספר בראשית.` without calling the LLM.
4. Build a Hebrew prompt with the kept chunks (labelled with `ref` and parasha) that requires
   answering only from them, returning the fixed answer verbatim if the event isn't there, plain
   text without Markdown, and no internal `[n]` passage numbers.
5. Return the model's text.

## Calibrating `MAX_RELEVANT_DISTANCE`

Measured top-1 distance for 22 in-scope and 16 out-of-scope questions:

| Group | Range |
|---|---|
| In Bereishit | 0.199 – 0.344 |
| Other Torah books | 0.350 – 0.402 |
| Unrelated (pizza, World Cup…) | 0.438 – 0.468 |

The gap between the groups is narrow, so the gate is set leniently at 0.40: a wrongly rejected
in-scope question can't be recovered, while an out-of-scope Torah question that passes is still
refused by the prompt (verified for Moshe's death, the spies, the golden calf and Bilaam).
Recalibrate if the corpus or embedding settings change.
