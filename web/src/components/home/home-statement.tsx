import styles from "./home.module.css";
import { ScrollTextReveal } from "./home-motion";

const STATEMENT =
  "A résumé is only part of the story. CareerConnect brings your skills, experience and projects into one profile, so you can search for jobs, follow every application, and let recruiters see the person behind it.";

/** A single large statement that darkens word by word as it scrolls past. */
export default function HomeStatement() {
  return (
    <section className={styles.statement} aria-labelledby="statement-label">
      <div className={styles.statementInner}>
        <p id="statement-label" className={styles.sectionLabel}>
          Why CareerConnect
        </p>
        <ScrollTextReveal text={STATEMENT} className={styles.statementText} />
      </div>
    </section>
  );
}
