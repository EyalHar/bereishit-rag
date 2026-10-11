# `loaders/sefariaLoader.ts`

## Purpose

Fetch the Hebrew text of all 50 chapters of Genesis from the Sefaria API and return clean,
unpointed verses with their section-end markers and parasha lookup.

## Fetching

`GET https://www.sefaria.org/api/texts/Genesis.{chapter}?context=0&pad=0`, one chapter at a time
with a 150ms pause between calls. The default Hebrew version is *Miqra according to the Masorah*
(CC BY-SA).

## Cleaning (`cleanVerseText`)

The raw `he` field is HTML with several kinds of non-verse content. In order:

1. **Footnotes** — `<sup class="footnote-marker">…</sup><i class="footnote">…</i>` hold
   manuscript-variant notes (e.g. "בספרי תימן…"). Removed entirely.
2. **Ketiv** — ketiv/qere pairs appear as `mam-kq-k` (ketiv, in parentheses) and `mam-kq-q`
   (qere, in brackets). The ketiv span is removed and the qere's brackets stripped, leaving only
   what is read.
3. **Section markers** — the `{פ}` / `{ס}` spans are removed from the text (they are detected
   separately, see below).
4. **Remaining tags and entities** — `<big>`, `<small>`, `<b>`, `<br>` etc. are stripped;
   `&nbsp;`/`&thinsp;` become spaces.
5. **Paseq** (`׀`) removed; **maqaf** (`־`) becomes a space so joined words embed and count as
   separate words.
6. **Niqqud and taamim** (U+0591–U+05C7 except maqaf/paseq/sof pasuq) and the invisible CGJ
   (U+034F) are removed. Questions are typed unpointed; pointed text embeds far from them and
   costs several times more tokens.

Sof pasuq (`׃`) is kept as the verse terminator.

## Section ends

`isSectionEnd` is `true` when the raw verse contains a `mam-spi-pe` or `mam-spi-samekh` span —
the end of a petucha or setuma. Genesis has 91 of them.

## Parashot

`getParashaFor(perek, pasuk)` maps a verse to one of the 12 parashot using hardcoded verse
ranges (these are fixed by the liturgical calendar).
