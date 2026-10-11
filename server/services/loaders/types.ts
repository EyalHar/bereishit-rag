export interface TorahVerse {
  perek: number;
  pasuk: number;
  text: string;
  isSectionEnd: boolean;
}

export interface TorahChunk {
  book: string;
  parasha: string | null;
  perekStart: number;
  pasukStart: number;
  perekEnd: number;
  pasukEnd: number;
  ref: string;
  content: string;
}
