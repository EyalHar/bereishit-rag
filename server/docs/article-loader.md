# `loaders/articleLoader.ts`

## Purpose

Fetch the 5 markdown articles from their gist URLs and return their raw text, typed as
`RawDocument` (see [types.md](types.md)).

## Process

1. **Build the 5 URLs** from the fixed pattern:
   `https://gist.githubusercontent.com/JonaCodes/394d01021d1be03c9fe98cd9696f5cf3/raw/article-X_ARTICLE_ID.md`
   where `X` = 1–5 and `ARTICLE_ID` (in order) = `military-deployment-report`, `urban-commuting`,
   `hover-polo`, `warehousing`, `consumer-safety`.
2. **Fetch all 5 in parallel** (`Promise.all`) with a plain HTTP GET (`fetch`) each, reading the
   response body as text (the gist serves raw markdown, no parsing needed beyond reading the
   text). Unlike the Slack loader, there's no pagination or rate limiting to worry about here, so
   parallel fetching is safe and faster than fetching sequentially.
3. **Output:** an array of `RawDocument` — `{ source: 'article', source_id: <article slug>, text:
   <markdown content> }`, one entry per article. `source_id` is the human-readable article id
   (e.g. `"hover-polo"`), used later to trace stored chunks back to their article.

## Notes

- The markdown is stored/chunked as-is — no need to strip markdown syntax, since the LLM can read
  markdown fine and it costs nothing to leave it.
- If a fetch fails (network hiccup, gist temporarily unavailable), that surfaces as a thrown
  error (via `response.ok` check) rather than silently skipping the article, so a partial
  `loadAllData` run is obvious rather than silently incomplete.
- Verified against the real gists: these articles use markdown with real blank lines between
  paragraphs, so `chunking.ts` takes its blank-line-split path directly (no need for the
  PDF-style line-length heuristic). Each article currently chunks into ~3 chunks, mostly in the
  300–390 word range.

## Used by

- `ragService.loadAllData` — one of the three sources combined before chunking/embedding.
