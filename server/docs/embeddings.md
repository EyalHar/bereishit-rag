# `embeddings.ts`

## Purpose

The single wrapper around the Gemini embedding API (`gemini-embedding-001`, 768 dimensions via
`outputDimensionality`). Every vector in the system comes from here, so stored and query vectors
share one embedding space.

## Task types

Gemini supports asymmetric embeddings for retrieval:

- `embedTexts` (chunks being stored) uses `RETRIEVAL_DOCUMENT`
- `embedText` (the user's question) uses `RETRIEVAL_QUERY`

This places a short question closer to the passage that answers it than the default symmetric
mode does. Changing either task type requires re-embedding the whole table.

## Rate limits

Calls are sequential with a 1.5s pause, and each call retries up to 5 times with linear backoff,
so a full `loadAllData` run survives the free tier's per-minute quota.

## Used by

- `ragService.loadAllData` — embeds every new chunk.
- `ragService.ask` — embeds the incoming question.
