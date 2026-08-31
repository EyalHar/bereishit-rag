import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIMENSIONS = 768;

const DELAY_BETWEEN_CALLS_MS = 1500;
const MAX_ATTEMPTS = 5;

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const ai = new GoogleGenAI({ apiKey });

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const embedWithRetry = async (
  text: string,
  attempt: number = 1
): Promise<number[]> => {
  try {
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    });

    const values = response.embeddings?.[0]?.values;
    if (!values) {
      throw new Error('Gemini returned no embedding values');
    }

    return values;
  } catch (error) {
    if (attempt >= MAX_ATTEMPTS) {
      throw error;
    }

    const backoffMs = DELAY_BETWEEN_CALLS_MS * attempt;
    console.warn(
      `Embedding attempt ${attempt} failed, retrying in ${backoffMs}ms: ${(error as Error).message}`
    );
    await sleep(backoffMs);

    return embedWithRetry(text, attempt + 1);
  }
};

export const embedText = (text: string): Promise<number[]> =>
  embedWithRetry(text);

export const embedTexts = async (texts: string[]): Promise<number[][]> => {
  const embeddings: number[][] = [];

  for (const text of texts) {
    embeddings.push(await embedWithRetry(text));
    await sleep(DELAY_BETWEEN_CALLS_MS);
  }

  return embeddings;
};
