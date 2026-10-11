import { FormEvent, KeyboardEvent, useState } from 'react';
import { IconSend } from '@tabler/icons-react';
import styles from './QuestionForm.module.css';

const SUGGESTIONS = [
  'למה האחים מכרו את יוסף?',
  'כמה שנים עבד יעקב בשביל רחל?',
  'מה קרה בעקדת יצחק?',
  'מי היה מלכי צדק?',
];

interface QuestionFormProps {
  isLoading: boolean;
  onSubmit: (question: string) => void;
}

const QuestionForm = ({ isLoading, onSubmit }: QuestionFormProps) => {
  const [question, setQuestion] = useState('');

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(question);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit(question);
    }
  };

  const handleSuggestion = (suggestion: string) => {
    setQuestion(suggestion);
    submit(suggestion);
  };

  return (
    <div className={styles.wrapper}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <textarea
          className={styles.input}
          rows={2}
          placeholder='לדוגמה: מה חלם יעקב בבית אל?'
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label='השאלה שלכם'
          autoFocus
        />
        <button
          type='submit'
          className={styles.sendButton}
          disabled={!question.trim() || isLoading}
          aria-label='שליחה'
        >
          <IconSend size={20} className={styles.sendIcon} />
        </button>
      </form>

      <div className={styles.suggestions}>
        <span className={styles.suggestionsLabel}>נסו לשאול:</span>
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type='button'
            className={styles.chip}
            onClick={() => handleSuggestion(suggestion)}
            disabled={isLoading}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuestionForm;
