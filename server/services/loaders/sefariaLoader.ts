import { TorahVerse } from './types';

const SEFARIA_API_BASE = 'https://www.sefaria.org/api/texts';
const BOOK = 'Genesis';
const CHAPTER_COUNT = 50;
const CHAPTER_FETCH_DELAY_MS = 150;

const SECTION_MARKER_REGEX = /mam-spi-(pe|samekh)/;
const SECTION_MARKER_SPAN_REGEX = /<span class="mam-spi-(pe|samekh)">[^<]*<\/span>/g;
// Manuscript-variant notes (e.g. "בספרי תימן..."), not part of the verse.
const FOOTNOTE_REGEX = /<sup class="footnote-marker">.*?<\/sup>\s*<i class="footnote">.*?<\/i>/g;
// Ketiv/qere pairs: keep only the qere (what is read), drop the ketiv.
const KETIV_REGEX = /<span class="mam-kq-k">[^<]*<\/span>/g;
const HTML_TAG_REGEX = /<[^>]+>/g;
const HTML_ENTITY_REGEX = /&nbsp;|&thinsp;/g;
const QERE_BRACKETS_REGEX = /[[\]]/g;
const MAQAF_REGEX = /\u05BE/g;
const PASEQ_REGEX = /\u05C0/g;
// Taamim (U+0591-U+05AF), niqqud/dots (U+05B0-U+05C7, except maqaf, paseq
// and sof pasuq) and the invisible CGJ (U+034F). Questions are typed
// unpointed, so pointed text would embed far from them.
const NIQQUD_AND_TAAMIM_REGEX =
  /[\u034F\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g;

// Verse ranges are fixed points on the Jewish liturgical calendar, not
// something Sefaria's data can shift - safe to hardcode rather than parse
// from the index API's alt-structure response.
const PARASHA_BOUNDARIES: {
  name: string;
  from: [number, number];
  to: [number, number];
}[] = [
  { name: 'בראשית', from: [1, 1], to: [6, 8] },
  { name: 'נח', from: [6, 9], to: [11, 32] },
  { name: 'לך לך', from: [12, 1], to: [17, 27] },
  { name: 'וירא', from: [18, 1], to: [22, 24] },
  { name: 'חיי שרה', from: [23, 1], to: [25, 18] },
  { name: 'תולדות', from: [25, 19], to: [28, 9] },
  { name: 'ויצא', from: [28, 10], to: [32, 3] },
  { name: 'וישלח', from: [32, 4], to: [36, 43] },
  { name: 'וישב', from: [37, 1], to: [40, 23] },
  { name: 'מקץ', from: [41, 1], to: [44, 17] },
  { name: 'ויגש', from: [44, 18], to: [47, 27] },
  { name: 'ויחי', from: [47, 28], to: [50, 26] },
];

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const cleanVerseText = (rawHtml: string): string =>
  rawHtml
    .replace(FOOTNOTE_REGEX, '')
    .replace(KETIV_REGEX, '')
    .replace(SECTION_MARKER_SPAN_REGEX, '')
    .replace(HTML_TAG_REGEX, '')
    .replace(HTML_ENTITY_REGEX, ' ')
    .replace(QERE_BRACKETS_REGEX, '')
    .replace(PASEQ_REGEX, '')
    .replace(MAQAF_REGEX, ' ')
    .replace(NIQQUD_AND_TAAMIM_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();

const fetchChapter = async (chapter: number): Promise<TorahVerse[]> => {
  const url = `${SEFARIA_API_BASE}/${BOOK}.${chapter}?context=0&pad=0`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${BOOK} ${chapter}: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as { he: string[] };

  return data.he.map((verseHtml, i) => ({
    perek: chapter,
    pasuk: i + 1,
    text: cleanVerseText(verseHtml),
    isSectionEnd: SECTION_MARKER_REGEX.test(verseHtml),
  }));
};

export const fetchGenesisVerses = async (): Promise<TorahVerse[]> => {
  const allVerses: TorahVerse[] = [];

  for (let chapter = 1; chapter <= CHAPTER_COUNT; chapter++) {
    allVerses.push(...(await fetchChapter(chapter)));
    await sleep(CHAPTER_FETCH_DELAY_MS);
  }

  return allVerses;
};

export const getParashaFor = (perek: number, pasuk: number): string | null => {
  const boundary = PARASHA_BOUNDARIES.find(({ from, to }) => {
    const afterStart = perek > from[0] || (perek === from[0] && pasuk >= from[1]);
    const beforeEnd = perek < to[0] || (perek === to[0] && pasuk <= to[1]);
    return afterStart && beforeEnd;
  });

  return boundary?.name ?? null;
};
