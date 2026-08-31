import { RawDocument } from './types';

const API_BASE_URL = 'https://lev-boots-slack-api.jona-581.workers.dev/';
const CHANNELS = ['lab-notes', 'engineering', 'offtopic'] as const;

const PAGE_DELAY_MS = 300;
const MAX_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 1000;

interface SlackMessage {
  id: string;
  channel: string;
  user: string;
  role: string;
  ts: string;
  text: string;
  thread_ts: string;
}

interface SlackApiResponse {
  channel: string;
  page: number;
  limit: number;
  total: number;
  items: SlackMessage[];
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const fetchPageWithRetry = async (
  channel: string,
  page: number,
  attempt: number = 1
): Promise<SlackApiResponse> => {
  const url = `${API_BASE_URL}?channel=${channel}&page=${page}`;
  const response = await fetch(url);

  if (response.status === 429) {
    if (attempt >= MAX_ATTEMPTS) {
      throw new Error(
        `Rate limited fetching "${channel}" page ${page} after ${MAX_ATTEMPTS} attempts`
      );
    }

    await sleep(RETRY_BASE_DELAY_MS * attempt);
    return fetchPageWithRetry(channel, page, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch "${channel}" page ${page}: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
};

const fetchChannelMessages = async (channel: string): Promise<SlackMessage[]> => {
  const messages: SlackMessage[] = [];
  let page = 1;
  let data = await fetchPageWithRetry(channel, page);

  while (data.items.length > 0) {
    messages.push(...data.items);
    page += 1;
    await sleep(PAGE_DELAY_MS);
    data = await fetchPageWithRetry(channel, page);
  }

  return messages;
};

export const loadSlackMessages = async (): Promise<RawDocument[]> => {
  const documents: RawDocument[] = [];

  for (const channel of CHANNELS) {
    const messages = await fetchChannelMessages(channel);
    const text = messages.map((m) => `${m.user}: ${m.text}`).join('\n\n');
    documents.push({ source: 'slack', source_id: channel, text });
  }

  return documents;
};
