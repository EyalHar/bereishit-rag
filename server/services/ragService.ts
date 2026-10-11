import { QueryTypes } from 'sequelize';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { sequelize, TorahKnowledgeBase } from '../models/index';
import { chunkVerses } from './chunking';
import { embedText, embedTexts } from './embeddings';
import { fetchGenesisVerses, getParashaFor } from './loaders/sefariaLoader';
import { TorahChunk } from './loaders/types';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const ai = new GoogleGenAI({ apiKey });
const GENERATION_MODEL = 'gemini-2.5-flash';
const SIMILARITY_SEARCH_LIMIT = 7;

// Cosine distance cutoff (0 = identical, 2 = opposite). Calibrated on 38
// sample questions: in-scope Bereishit questions scored <= 0.344 to their
// best chunk, other-books/off-topic >= 0.350. 0.40 keeps margin for in-scope
// phrasing; other Torah books that slip under it are refused by the prompt.
const MAX_RELEVANT_DISTANCE = 0.4;

const NOT_IN_BEREISHIT_ANSWER = 'האירוע הזה אינו מופיע בספר בראשית.';

interface SimilarChunk {
  ref: string;
  parasha: string | null;
  chunk_content: string;
  distance: number;
}

const toVectorLiteral = (embedding: number[]): string =>
  `[${embedding.join(',')}]`;

const fetchExistingRefs = async (): Promise<Set<string>> => {
  const rows = (await TorahKnowledgeBase.findAll({
    attributes: ['ref'],
    raw: true,
  })) as unknown as { ref: string }[];

  return new Set(rows.map((row) => row.ref));
};

const insertChunk = async (
  chunk: TorahChunk,
  embedding: number[]
): Promise<void> => {
  await sequelize.query(
    `INSERT INTO torah_knowledge_base
       (book, parasha, perek_start, pasuk_start, perek_end, pasuk_end, ref, chunk_content, embeddings_768)
     VALUES
       (:book, :parasha, :perekStart, :pasukStart, :perekEnd, :pasukEnd, :ref, :content, :embedding::vector)`,
    {
      replacements: {
        book: chunk.book,
        parasha: chunk.parasha,
        perekStart: chunk.perekStart,
        pasukStart: chunk.pasukStart,
        perekEnd: chunk.perekEnd,
        pasukEnd: chunk.pasukEnd,
        ref: chunk.ref,
        content: chunk.content,
        embedding: toVectorLiteral(embedding),
      },
      type: QueryTypes.INSERT,
    }
  );
};

export const loadAllData = async (): Promise<void> => {
  const verses = await fetchGenesisVerses();
  const chunks = chunkVerses(verses, 'Genesis', getParashaFor);

  const existingRefs = await fetchExistingRefs();
  const newChunks = chunks.filter((chunk) => !existingRefs.has(chunk.ref));

  if (newChunks.length === 0) {
    console.log(`loadAllData: chunks=${chunks.length} all already embedded`);
    return;
  }

  const embeddings = await embedTexts(newChunks.map((c) => c.content));

  for (let i = 0; i < newChunks.length; i++) {
    await insertChunk(newChunks[i], embeddings[i]);
  }

  console.log(
    `loadAllData: chunks=${chunks.length} embedded=${newChunks.length} skipped=${chunks.length - newChunks.length}`
  );
};

const findSimilarChunks = async (
  questionEmbedding: number[]
): Promise<SimilarChunk[]> => {
  return sequelize.query<SimilarChunk>(
    `SELECT ref, parasha, chunk_content,
            embeddings_768 <=> :queryEmbedding::vector AS distance
     FROM torah_knowledge_base
     WHERE embeddings_768 IS NOT NULL
     ORDER BY distance ASC
     LIMIT :limit`,
    {
      replacements: {
        queryEmbedding: toVectorLiteral(questionEmbedding),
        limit: SIMILARITY_SEARCH_LIMIT,
      },
      type: QueryTypes.SELECT,
    }
  );
};

const buildPrompt = (userQuestion: string, chunks: SimilarChunk[]): string => {
  const context = chunks
    .map(
      (chunk, i) =>
        `[${i + 1}] (${chunk.ref}, פרשת ${chunk.parasha ?? 'לא ידוע'})\n${chunk.chunk_content}`
    )
    .join('\n\n');

  return `אתה עוזר המשיב על שאלות לגבי ספר בראשית בתורה, בהתבסס אך ורק על הקטעים שסופקו למטה.

קטעים:
${context}

שאלה: ${userQuestion}

הנחיות:
- ענה רק על סמך המידע בקטעים שסופקו.
- אם האירוע שנשאל עליו אינו מופיע בקטעים שסופקו, ענה בדיוק: "${NOT_IN_BEREISHIT_ANSWER}" - אל תנחש ואל תשלים מידע מספרים אחרים בתורה.
- היה תמציתי וממוקד.
- ענה בעברית, בטקסט רגיל ללא עיצוב Markdown (ללא כוכביות, תבליטים או כותרות).
- אל תציין את מספרי הקטעים בסוגריים (כמו [1]) - הם פנימיים ואינם מוכרים לשואל.`;
};

export const ask = async (userQuestion: string): Promise<string> => {
  const questionEmbedding = await embedText(userQuestion);
  const similarChunks = await findSimilarChunks(questionEmbedding);
  const relevantChunks = similarChunks.filter(
    (chunk) => chunk.distance <= MAX_RELEVANT_DISTANCE
  );

  if (relevantChunks.length === 0) {
    return NOT_IN_BEREISHIT_ANSWER;
  }

  const prompt = buildPrompt(userQuestion, relevantChunks);

  const response = await ai.models.generateContent({
    model: GENERATION_MODEL,
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  return response.text ?? NOT_IN_BEREISHIT_ANSWER;
};
