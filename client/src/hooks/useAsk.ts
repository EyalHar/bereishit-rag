import { useState } from 'react';

const ERROR_MESSAGES: Record<number, string> = {
  429: 'נשאלו יותר מדי שאלות בזמן קצר. נסו שוב בעוד דקה.',
};
const GENERIC_ERROR = 'לא הצלחנו לקבל תשובה כרגע. נסו שוב בעוד רגע.';

interface AskResult {
  question: string;
  answer: string;
}

export const useAsk = () => {
  const [result, setResult] = useState<AskResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const ask = async (question: string) => {
    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userQuestion: question }),
      });

      if (!response.ok) {
        setError(ERROR_MESSAGES[response.status] ?? GENERIC_ERROR);
        return;
      }

      const data = (await response.json()) as { answer: string };
      setResult({ question, answer: data.answer });
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  return { ask, result, isLoading, error };
};
