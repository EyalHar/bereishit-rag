# `chunking.ts`

## Purpose

Turn the ordered list of verses into retrieval chunks that follow the text's own structure: one
chunk per petucha/setuma (פרשה פתוחה/סתומה), the Masoretic paragraph divisions.

## Process (`chunkVerses`)

1. **Group into sections.** Walk the verses in order and close a section after every verse with
   `isSectionEnd`. Any trailing verses form a final section.
2. **Split oversized sections.** A section over 400 words is split into
   `ceil(totalWords / 400)` pieces of roughly even size (e.g. 500 words → ~250 + ~250, not
   400 + 100). A chunk boundary never falls inside a verse.
3. **Build chunks.** Each chunk gets its verse range (`perekStart`…`pasukEnd`), a `ref` like
   `Genesis 29:10-29:34`, the parasha of its first verse, and the verses' text joined by spaces.

## Result for Genesis

1,533 verses → 91 sections → 117 chunks.
