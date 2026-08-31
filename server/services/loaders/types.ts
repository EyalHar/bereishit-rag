export type DocumentSource = 'pdf' | 'article' | 'slack';

export interface RawDocument {
  source: DocumentSource;
  source_id: string;
  text: string;
}
