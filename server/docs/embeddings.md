# `embeddings.ts`

## Purpose

Single, shared wrapper around the Gemini embedding API (`gemini-embedding-001`, requested at 768
dimensions via `outputDimensionality`).
Every place in the codebase that needs a vector for a piece of text goes through this file — so
the exact same model/config is used everywhere, which is required for similarity search to make
sense (query vectors and stored vectors must live in the same embedding space).

## Process

1. **Input:** either a single string, or a batch of strings (chunk contents).
2. **Call Gemini:** send the text(s) to the Gemini embeddings endpoint requesting 768-dimension
   output.
3. **Rate-limit handling:** Gemini's free tier has strict per-minute quotas. Calls are made
   sequentially (not all at once) with a small delay between them, and a retry-with-backoff on
   `429`/rate-limit errors, so a large `loadAllData` run doesn't crash partway through.
4. **Output:** a `number[]` (768 floats) per input string, in the same order as the input.

## Notes

- This is the **only** file that talks to the Gemini embeddings endpoint. If the embedding model
  or dimension ever needs to change, this is the one place to update.
- Errors from Gemini (bad key, quota exhausted) should propagate clearly rather than being
  swallowed, so `loadAllData` can report a useful failure instead of silently storing `null`
  vectors.

## Used by

- `ragService.loadAllData` — embeds every chunk before inserting into `knowledge_base`.
- `ragService.ask` — embeds the incoming user question with the *same* model, so it can be
  compared against the stored chunk vectors.
