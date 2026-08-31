# RAG Pipeline — File Docs

Index of design docs for the 6 files that make up the RAG pipeline (see
[../RAG_IMPLEMENTATION_PLAN.md](../RAG_IMPLEMENTATION_PLAN.md) for the overall plan).

| # | File | Doc |
|---|---|---|
| 1 | `server/services/chunking.ts` | [chunking.md](chunking.md) |
| 2 | `server/services/embeddings.ts` | [embeddings.md](embeddings.md) |
| 3 | `server/services/loaders/pdfLoader.ts` | [pdf-loader.md](pdf-loader.md) |
| 4 | `server/services/loaders/articleLoader.ts` | [article-loader.md](article-loader.md) |
| 5 | `server/services/loaders/slackLoader.ts` | [slack-loader.md](slack-loader.md) |
| 6 | `server/services/ragService.ts` | [rag-service.md](rag-service.md) |
| — | `server/services/loaders/types.ts` (shared `RawDocument`/`DocumentSource` types) | [types.md](types.md) |

## Data flow (high level)

```
pdfLoader ─┐
articleLoader ─┼─▶ ragService.loadAllData ─▶ chunking ─▶ embeddings ─▶ knowledge_base table
slackLoader ─┘

userQuestion ─▶ ragService.ask ─▶ embeddings (embed question)
                                 ─▶ pgvector similarity search (knowledge_base)
                                 ─▶ prompt build ─▶ Gemini generate ─▶ answer
```

`chunking.ts` and `embeddings.ts` are generic utilities with no knowledge of PDFs/articles/Slack —
they're reused by every loader and by `ask`. The three loaders each know how to fetch *one* raw
source and nothing else. `ragService.ts` is the only file that orchestrates all of them together.
