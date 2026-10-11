import styles from './About.module.css';

const PIPELINE_STEPS = [
  {
    title: 'טעינת הטקסט',
    body: 'כל 50 פרקי ספר בראשית נטענים מספריא, ומנוקים מניקוד, טעמים, הערות נוסח וכתיב (נשאר הקרי).',
  },
  {
    title: 'חלוקה לפי הפרשיות',
    body: 'הטקסט מחולק לפי הפרשיות הפתוחות והסתומות של המסורה, יחידות התוכן הטבעיות של המקרא. פרשייה ארוכה במיוחד מפוצלת לחלקים שווים בלי לחתוך פסוק.',
  },
  {
    title: 'חיפוש סמנטי',
    body: 'כל שאלה מושווית לקטעים לפי משמעות ולא לפי מילים זהות, ונבחרים הקטעים הקרובים ביותר.',
  },
  {
    title: 'ניסוח תשובה',
    body: 'מודל שפה מנסח תשובה רק מתוך הקטעים שנמצאו. אם האירוע אינו בספר בראשית, תתקבל תשובה שהוא אינו מופיע בו.',
  },
];

const About = () => (
  <div className={styles.page}>
    <header className={styles.header}>
      <h1 className={styles.title}>אודות ומקורות</h1>
      <p className={styles.lead}>
        שואלים בבראשית עונה על שאלות על ספר בראשית מתוך הפסוקים עצמם, ולא מתוך ידע כללי.
      </p>
    </header>

    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>איך זה עובד</h2>
      <ol className={styles.steps}>
        {PIPELINE_STEPS.map(({ title, body }) => (
          <li key={title} className={styles.step}>
            <h3 className={styles.stepTitle}>{title}</h3>
            <p className={styles.stepBody}>{body}</p>
          </li>
        ))}
      </ol>
    </section>

    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>מקור הטקסט ורישיון</h2>
      <div className={styles.card}>
        <p>
          נוסח המקרא הוא <strong>"מקרא על פי המסורה"</strong>, כפי שהוא מוגש ב-
          <a href='https://www.sefaria.org.il/Genesis.1' target='_blank' rel='noreferrer'>
            ספריא
          </a>
          , ומופץ ברישיון{' '}
          <a
            href='https://he.wikisource.org/wiki/%D7%9E%D7%A9%D7%AA%D7%9E%D7%A9:Dovi/%D7%9E%D7%A7%D7%A8%D7%90_%D7%A2%D7%9C_%D7%A4%D7%99_%D7%94%D7%9E%D7%A1%D7%95%D7%A8%D7%94'
            target='_blank'
            rel='noreferrer'
          >
            CC BY-SA
          </a>
          .
        </p>
        <p>
          לצורך החיפוש הוסרו מהטקסט הניקוד, הטעמים, סימני הפרשיות והערות הנוסח, והכתיב
          הוחלף בקרי.
        </p>
      </div>
    </section>
  </div>
);

export default About;
