import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';
import { RawDocument } from './types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_DIR = path.join(__dirname, '..', '..', 'knowledge_pdfs');

const extractPdfText = async (filePath: string): Promise<string> => {
  const data = fs.readFileSync(filePath);
  const parser = new PDFParse({ data });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
};

export const loadPdfs = async (): Promise<RawDocument[]> => {
  const filenames = fs
    .readdirSync(PDF_DIR)
    .filter((filename) => filename.toLowerCase().endsWith('.pdf'));

  const documents: RawDocument[] = [];
  for (const filename of filenames) {
    const text = await extractPdfText(path.join(PDF_DIR, filename));
    documents.push({ source: 'pdf', source_id: filename, text });
  }

  return documents;
};
