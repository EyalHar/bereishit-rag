import { TorahChunk, TorahVerse } from './loaders/types';

const MAX_CHUNK_WORDS = 400;

const countWords = (text: string): number =>
  text.split(/\s+/).filter(Boolean).length;

const toChunk = (
  verses: TorahVerse[],
  book: string,
  parasha: string | null
): TorahChunk => {
  const first = verses[0];
  const last = verses[verses.length - 1];

  return {
    book,
    parasha,
    perekStart: first.perek,
    pasukStart: first.pasuk,
    perekEnd: last.perek,
    pasukEnd: last.pasuk,
    ref: `${book} ${first.perek}:${first.pasuk}-${last.perek}:${last.pasuk}`,
    content: verses.map((v) => v.text).join(' '),
  };
};

// Splits one oversized petucha/setuma section into relatively even pieces
// capped at MAX_CHUNK_WORDS, distributed by target size rather than greedily
// filled, and never breaking inside a verse.
const splitOversizedSection = (verses: TorahVerse[]): TorahVerse[][] => {
  const wordCounts = verses.map((v) => countWords(v.text));
  const totalWords = wordCounts.reduce((sum, w) => sum + w, 0);
  const numParts = Math.max(1, Math.ceil(totalWords / MAX_CHUNK_WORDS));
  const targetWords = Math.ceil(totalWords / numParts);

  const parts: TorahVerse[][] = [];
  let current: TorahVerse[] = [];
  let currentWords = 0;

  verses.forEach((verse, i) => {
    const isFillingEarlierPart = parts.length < numParts - 1;
    const exceedsTarget =
      isFillingEarlierPart && currentWords + wordCounts[i] > targetWords;

    if (current.length > 0 && exceedsTarget) {
      parts.push(current);
      current = [];
      currentWords = 0;
    }

    current.push(verse);
    currentWords += wordCounts[i];
  });

  if (current.length > 0) {
    parts.push(current);
  }

  return parts;
};

export const chunkVerses = (
  verses: TorahVerse[],
  book: string,
  parashaFor: (perek: number, pasuk: number) => string | null
): TorahChunk[] => {
  const sections: TorahVerse[][] = [];
  let current: TorahVerse[] = [];

  for (const verse of verses) {
    current.push(verse);
    if (verse.isSectionEnd) {
      sections.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    sections.push(current);
  }

  return sections
    .flatMap((section) =>
      countWords(section.map((v) => v.text).join(' ')) > MAX_CHUNK_WORDS
        ? splitOversizedSection(section)
        : [section]
    )
    .map((section) =>
      toChunk(section, book, parashaFor(section[0].perek, section[0].pasuk))
    );
};
