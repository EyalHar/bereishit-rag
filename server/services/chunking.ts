const TARGET_CHUNK_WORDS = 400;

const PAGE_MARKER_REGEX = /\n*--\s*\d+\s*of\s*\d+\s*--\n*/g;
const BLANK_LINE_REGEX = /\n\s*\n+/;
const SENTENCE_REGEX = /[^.!?]+[.!?]+(\s+|$)/g;

const stripPageMarkers = (text: string): string =>
  text.replace(PAGE_MARKER_REGEX, ' ');

const splitIntoParagraphs = (text: string): string[] =>
  text
    .split(BLANK_LINE_REGEX)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

const splitIntoSentences = (text: string): string[] => {
  const matches = text.match(SENTENCE_REGEX);
  if (!matches) {
    return [text];
  }

  return matches.map((sentence) => sentence.trim()).filter(Boolean);
};

const countWords = (text: string): number =>
  text.split(/\s+/).filter(Boolean).length;

// Greedily accumulates units into ~maxWords pieces joined by `separator`,
// filling each piece to the max before moving to the next one.
const pack = (units: string[], maxWords: number, separator: string): string[] => {
  const pieces: string[] = [];
  let current = '';
  let currentWords = 0;

  for (const unit of units) {
    const unitWords = countWords(unit);
    if (currentWords + unitWords > maxWords && current) {
      pieces.push(current);
      current = unit;
      currentWords = unitWords;
    } else {
      current = current ? `${current}${separator}${unit}` : unit;
      currentWords += unitWords;
    }
  }
  if (current) {
    pieces.push(current);
  }

  return pieces;
};

// Distributes units into relatively even-sized pieces (target = total /
// number-of-parts-needed) instead of greedily filling each piece to
// maxWords before moving on — avoids a lopsided "one full piece + one small
// leftover" split. maxWords is still a hard cap that's never crossed.
const packBalanced = (units: string[], maxWords: number, separator: string): string[] => {
  const wordCounts = units.map(countWords);
  const totalWords = wordCounts.reduce((sum, count) => sum + count, 0);
  const numParts = Math.max(1, Math.ceil(totalWords / maxWords));
  const targetWords = Math.ceil(totalWords / numParts);

  const pieces: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  units.forEach((unit, i) => {
    const unitWords = wordCounts[i];
    const exceedsHardCap = currentWords + unitWords > maxWords;
    // Only the last part is allowed to absorb the remainder past the
    // target — earlier parts close as soon as they'd overshoot it.
    const isFillingEarlierPart = pieces.length < numParts - 1;
    const exceedsTarget = isFillingEarlierPart && currentWords + unitWords > targetWords;

    if (current.length > 0 && (exceedsHardCap || exceedsTarget)) {
      pieces.push(current.join(separator));
      current = [];
      currentWords = 0;
    }

    current.push(unit);
    currentWords += unitWords;
  });

  if (current.length > 0) {
    pieces.push(current.join(separator));
  }

  return pieces;
};

// Splits one oversized paragraph into relatively even pieces, each capped
// at maxWords, without ever cutting a sentence in half. Last-resort
// fallback for a single sentence longer than maxWords on its own (no
// punctuation to break on): cut at word boundaries, never mid-word.
const splitOversizedParagraph = (paragraph: string, maxWords: number): string[] => {
  const sentences = splitIntoSentences(paragraph).flatMap((sentence) =>
    countWords(sentence) > maxWords
      ? pack(sentence.split(/\s+/).filter(Boolean), maxWords, ' ')
      : [sentence]
  );

  return packBalanced(sentences, maxWords, ' ');
};

export const chunkText = (text: string): string[] => {
  const paragraphs = splitIntoParagraphs(stripPageMarkers(text));

  const units = paragraphs.flatMap((paragraph) =>
    countWords(paragraph) > TARGET_CHUNK_WORDS
      ? splitOversizedParagraph(paragraph, TARGET_CHUNK_WORDS)
      : [paragraph]
  );

  return pack(units, TARGET_CHUNK_WORDS, '\n\n');
};
