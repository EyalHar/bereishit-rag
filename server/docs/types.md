# `loaders/types.ts`

## Purpose

Shared type definitions for the loader → `ragService` handoff, so all three loaders
(`pdfLoader`, `articleLoader`, `slackLoader`) return the exact same shape and `ragService` doesn't
need to special-case any of them.

## Contents

```ts
export type DocumentSource = 'pdf' | 'article' | 'slack';

export interface RawDocument {
  source: DocumentSource;
  source_id: string;
  text: string;
}
```

- `DocumentSource` — a closed set of the 3 valid `source` values, matching what's stored in the
  `knowledge_base.source` column.
- `RawDocument` — one fetched-but-not-yet-chunked document: which source it came from
  (`source`), what identifies it within that source (`source_id` — e.g. a PDF filename, an
  article slug, a Slack channel name), and its raw extracted text (`text`).

## Used by

- Every loader (`pdfLoader.ts`, `articleLoader.ts`, `slackLoader.ts`) — each returns
  `Promise<RawDocument[]>`.
- `ragService.loadAllData` — combines the arrays from all three loaders into one list before
  chunking.
