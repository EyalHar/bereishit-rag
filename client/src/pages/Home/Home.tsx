import { IconAlertCircle } from '@tabler/icons-react';
import QuestionForm from '../../components/QuestionForm/QuestionForm';
import AnswerCard from '../../components/AnswerCard/AnswerCard';
import { useAsk } from '../../hooks/useAsk';
import styles from './Home.module.css';

const Home = () => {
  const { ask, result, isLoading, error } = useAsk();

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>ספר בראשית · 50 פרקים · 12 פרשות</span>
        <h1 className={styles.title}>שאלו כל שאלה על ספר בראשית</h1>
        <p className={styles.subtitle}>
          מבריאת העולם ועד מות יוסף. התשובות מבוססות על לשון המקרא בלבד, ושאלות על
          אירועים מחוץ לספר בראשית יקבלו תשובה שהם אינם מופיעים בו.
        </p>
      </header>

      <QuestionForm isLoading={isLoading} onSubmit={ask} />

      <section className={styles.results} aria-live='polite'>
        {isLoading && (
          <div className={styles.loading}>
            <span className={styles.spinner} />
            מחפשים בפסוקים…
          </div>
        )}

        {error && (
          <div className={styles.error} role='alert'>
            <IconAlertCircle size={20} />
            {error}
          </div>
        )}

        {result && <AnswerCard question={result.question} answer={result.answer} />}
      </section>
    </div>
  );
};

export default Home;
