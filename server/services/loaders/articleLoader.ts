import { RawDocument } from './types';

const GIST_BASE_URL =
  'https://gist.githubusercontent.com/JonaCodes/394d01021d1be03c9fe98cd9696f5cf3/raw';

const ARTICLE_IDS = [
  'military-deployment-report',
  'urban-commuting',
  'hover-polo',
  'warehousing',
  'consumer-safety',
];

const fetchArticle = async (index: number, articleId: string): Promise<string> => {
  const url = `${GIST_BASE_URL}/article-${index}_${articleId}.md`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch article "${articleId}": ${response.status} ${response.statusText}`
    );
  }

  return response.text();
};

export const loadArticles = async (): Promise<RawDocument[]> => {
  return Promise.all(
    ARTICLE_IDS.map(async (articleId, i) => {
      const text = await fetchArticle(i + 1, articleId);
      return { source: 'article' as const, source_id: articleId, text };
    })
  );
};
