import styles from './AnswerCard.module.css';

interface AnswerCardProps {
  question: string;
  answer: string;
}

const AnswerCard = ({ question, answer }: AnswerCardProps) => (
  <article className={styles.card}>
    <div className={styles.question}>{question}</div>
    <p className={styles.answer}>{answer}</p>
    <footer className={styles.disclaimer}>
      התשובה נוצרה בבינה מלאכותית על סמך פסוקי ספר בראשית, וייתכנו בה טעויות.
    </footer>
  </article>
);

export default AnswerCard;
