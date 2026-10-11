# `loaders/types.ts`

Shared shapes for the loader → chunking → `ragService` handoff.

```ts
export interface TorahVerse {
  perek: number;
  pasuk: number;
  text: string;          // cleaned, unpointed
  isSectionEnd: boolean; // verse closes a petucha/setuma
}

export interface TorahChunk {
  book: string;          // 'Genesis'
  parasha: string | null;
  perekStart: number;
  pasukStart: number;
  perekEnd: number;
  pasukEnd: number;
  ref: string;           // 'Genesis 1:1-1:5' — unique key in torah_knowledge_base
  content: string;
}
```

- `sefariaLoader` produces `TorahVerse[]`.
- `chunking.chunkVerses` turns them into `TorahChunk[]`.
- `ragService` stores each `TorahChunk` as one row.
