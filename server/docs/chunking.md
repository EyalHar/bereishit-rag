# `chunking.ts`

## Purpose

Split a single block of raw text into an ordered list of chunks around ~400 **words** each, using
paragraph structure as the primary unit — so a chunk tends to correspond to one coherent paragraph
(or a few short ones merged together) rather than an arbitrary fixed-size cut. Sentences are always
kept whole: a chunk boundary never lands in the middle of a sentence.

## Process

1. **Strip page-break artifacts.** PDF extraction (`pdf-parse`) inserts page markers like
   `-- 2 of 4 --` into the text, sometimes splitting a phrase across the marker. These are removed
   (along with their surrounding newlines) and replaced with a single space, reconnecting the text.

2. **Split into paragraphs.** Split on blank lines (`\n\s*\n+`), trim each paragraph, and drop any
   empty ones.

3. **Merge consecutive paragraphs.** Walk the paragraphs in order and greedily accumulate them into
   a chunk: as long as adding the next paragraph keeps the combined word count at or under 400,
   merge it in (joined by `\n\n`). As soon as adding the next paragraph would exceed 400 words,
   close the current chunk and start a new one with that paragraph.

4. **Split an oversized paragraph — into relatively even, sentence-safe pieces.** If a single
   paragraph is itself longer than 400 words, it can't stay whole. It's split into sentences, and
   those sentences are distributed into a *balanced* number of pieces rather than greedily filled
   to 400 each: the number of pieces needed is estimated as `ceil(totalWords / 400)`, and sentences
   are grouped toward an even target size per piece (e.g. 500 words across 5 equal sentences comes
   out as 200 + 300, not 400 + 100). 400 words is still a hard cap that's never crossed, and a chunk
   boundary is never placed inside a sentence. In the rare case a single sentence alone is longer
   than 400 words (no punctuation to break on), it falls back to a word-boundary cut (never
   mid-word) as a last resort.

5. **Output:** an ordered array of chunk strings. The array index of each chunk becomes its
   `chunk_index` when stored in `knowledge_base`.

## Notes / edge cases

- No overlap between chunks is used.
- No heading/section detection, no minimum chunk size, no hard section boundaries — this is a
  deliberately simpler reset of an earlier, more complex section-aware implementation.
- This function is source-agnostic: it doesn't know or care whether the text came from a PDF or an
  article — that context (`source`, `source_id`) is attached by the caller (a loader, via
  `ragService`), not by `chunking.ts` itself.

## Used by

- `ragService.loadAllData` — chunks every document from every loader before embedding.
