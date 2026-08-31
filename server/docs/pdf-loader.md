# `loaders/pdfLoader.ts`

## Purpose

Read the local PDF files in `server/knowledge_pdfs/` and return their raw extracted text, typed
as `RawDocument` (see [types.md](types.md)).

## Process

1. **List files:** read the `knowledge_pdfs/` directory dynamically (`fs.readdirSync`, filtered to
   `.pdf` files) rather than hardcoding the 3 known filenames — adding/removing a PDF from that
   folder just works, no code change needed.
2. **Read each file:** load each PDF as a binary buffer from disk (`fs.readFileSync`).
3. **Extract text:** run each buffer through `pdf-parse` v2's `PDFParse` class —
   `new PDFParse({ data: buffer })`, then `await parser.getText()` to get the plain-text content
   (stripped of layout/formatting). `parser.destroy()` is called in a `finally` block so resources
   are released even if extraction throws.
4. **Output:** an array of `RawDocument` — `{ source: 'pdf', source_id: <filename>, text:
   <extracted text> }`, one entry per PDF. `source_id` (the filename, e.g.
   `"OpEd - A Revolution at Our Feet.pdf"`) is what later identifies which document a stored chunk
   came from.

## Notes

- This loader does **not** chunk or embed anything — it only returns raw text per document. The
  caller (`ragService.loadAllData`) is responsible for passing that text through `chunking.ts`
  and `embeddings.ts`.
- `pdf-parse`'s text extraction hard-wraps every visual PDF line onto its own line with a single
  `\n` and inserts page-break markers (`-- N of M --`) into the output — `chunking.ts` is the
  piece that knows how to clean/reconstruct paragraphs from this, not this loader.
- Since these are local files (no network calls, no pagination), this is the simplest of the
  three loaders.

## Used by

- `ragService.loadAllData` — one of the three sources combined before chunking/embedding.
