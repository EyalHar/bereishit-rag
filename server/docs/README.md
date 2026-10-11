# RAG Pipeline — File Docs

| File | Doc |
|---|---|
| `server/services/loaders/sefariaLoader.ts` | [sefaria-loader.md](sefaria-loader.md) |
| `server/services/chunking.ts` | [chunking.md](chunking.md) |
| `server/services/embeddings.ts` | [embeddings.md](embeddings.md) |
| `server/services/ragService.ts` | [rag-service.md](rag-service.md) |
| `server/services/loaders/types.ts` | [types.md](types.md) |

## Data flow

```
Sefaria API ─▶ sefariaLoader (clean verses, mark פ/ס section ends)
            ─▶ chunking (one chunk per petucha/setuma, split if > 400 words)
            ─▶ embeddings (RETRIEVAL_DOCUMENT) ─▶ torah_knowledge_base

userQuestion ─▶ embeddings (RETRIEVAL_QUERY)
             ─▶ pgvector cosine search (top 7, HNSW index)
             ─▶ distance gate (<= 0.40, else fixed "not in Bereishit" answer)
             ─▶ prompt ─▶ gemini-2.5-flash ─▶ answer
```

## Database

Table `torah_knowledge_base` — one row per chunk: `book`, `parasha`, `perek_start`,
`pasuk_start`, `perek_end`, `pasuk_end`, `ref` (unique, e.g. `Genesis 1:1-1:5`),
`chunk_content`, `embeddings_768 vector(768)`. Indexed with HNSW (`vector_cosine_ops`).

The older `knowledge_base` table (from the Lev-Boots exercise this project started from) is
still created by its original migration but is no longer used by any code.
