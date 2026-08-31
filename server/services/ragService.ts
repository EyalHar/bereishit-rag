// Make sure you've reviewd the README.md file to understand the task and the RAG flow

import { QueryTypes } from 'sequelize';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { sequelize, KnowledgeBase } from '../models/index';
import { chunkText } from './chunking';
import { embedText, embedTexts } from './embeddings';
import { loadPdfs } from './loaders/pdfLoader';
import { loadArticles } from './loaders/articleLoader';
import { loadSlackMessages } from './loaders/slackLoader';
import { RawDocument } from './loaders/types';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const ai = new GoogleGenAI({ apiKey });
const GENERATION_MODEL = 'gemini-2.5-flash';
const SIMILARITY_SEARCH_LIMIT = 7;

interface ChunkRecord {
  source: string;
  source_id: string;
  chunk_index: number;
  chunk_content: string;
}

interface SimilarChunk {
  chunk_content: string;
  source: string;
  source_id: string;
}

const toVectorLiteral = (embedding: number[]): string =>
  `[${embedding.join(',')}]`;

const fetchAllDocuments = async (): Promise<RawDocument[]> => {
  const [pdfDocs, articleDocs, slackDocs] = await Promise.all([
    loadPdfs(),
    loadArticles(),
    loadSlackMessages(),
  ]);

  return [...pdfDocs, ...articleDocs, ...slackDocs];
};

const fetchExistingChunkKeys = async (): Promise<Set<string>> => {
  const rows = (await KnowledgeBase.findAll({
    attributes: ['source', 'source_id', 'chunk_index'],
    raw: true,
  })) as unknown as ChunkRecord[];

  return new Set(
    rows.map((row) => `${row.source}::${row.source_id}::${row.chunk_index}`)
  );
};

const insertChunk = async (
  chunk: ChunkRecord,
  embedding: number[]
): Promise<void> => {
  await sequelize.query(
    `INSERT INTO knowledge_base (source, source_id, chunk_index, chunk_content, embeddings_768)
     VALUES (:source, :source_id, :chunk_index, :chunk_content, :embedding::vector)`,
    {
      replacements: {
        source: chunk.source,
        source_id: chunk.source_id,
        chunk_index: chunk.chunk_index,
        chunk_content: chunk.chunk_content,
        embedding: toVectorLiteral(embedding),
      },
      type: QueryTypes.INSERT,
    }
  );
};

export const loadAllData = async (): Promise<void> => {
  const documents = await fetchAllDocuments();
  const existingKeys = await fetchExistingChunkKeys();

  let totalChunks = 0;
  let skippedChunks = 0;
  let embeddedChunks = 0;

  for (const document of documents) {
    const chunks = chunkText(document.text);
    totalChunks += chunks.length;

    const newChunks = chunks
      .map((content, chunkIndex) => ({ content, chunkIndex }))
      .filter(
        ({ chunkIndex }) =>
          !existingKeys.has(
            `${document.source}::${document.source_id}::${chunkIndex}`
          )
      );

    skippedChunks += chunks.length - newChunks.length;

    if (newChunks.length === 0) {
      continue;
    }

    const embeddings = await embedTexts(newChunks.map((c) => c.content));

    for (let i = 0; i < newChunks.length; i++) {
      await insertChunk(
        {
          source: document.source,
          source_id: document.source_id,
          chunk_index: newChunks[i].chunkIndex,
          chunk_content: newChunks[i].content,
        },
        embeddings[i]
      );
      embeddedChunks += 1;
    }
  }

  console.log(
    `loadAllData: documents=${documents.length} totalChunks=${totalChunks} skipped=${skippedChunks} embedded=${embeddedChunks}`
  );
};

const findSimilarChunks = async (
  questionEmbedding: number[]
): Promise<SimilarChunk[]> => {
  return sequelize.query<SimilarChunk>(
    `SELECT chunk_content, source, source_id
     FROM knowledge_base
     WHERE embeddings_768 IS NOT NULL
     ORDER BY embeddings_768 <=> :queryEmbedding::vector
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
        `[${i + 1}] (source: ${chunk.source}/${chunk.source_id})\n${chunk.chunk_content}`
    )
    .join('\n\n');

  return `You are a helpful assistant answering questions about Lev-Boots (levitation boots) technology, using ONLY the context below.

Context:
${context}

Question: ${userQuestion}

Instructions:
- Answer using only the information in the context above.
- If the answer is not present in the context, say you don't know rather than guessing.
- Be concise and direct.`;
};

export const ask = async (userQuestion: string): Promise<string> => {
  const questionEmbedding = await embedText(userQuestion);
  const similarChunks = await findSimilarChunks(questionEmbedding);
  const prompt = buildPrompt(userQuestion, similarChunks);

  const response = await ai.models.generateContent({
    model: GENERATION_MODEL,
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  return response.text ?? "I don't know.";
};
