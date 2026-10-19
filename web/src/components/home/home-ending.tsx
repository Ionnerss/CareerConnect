import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./home-ending.module.css";

export function HomeEnding() {
  return (
    <section
      className={styles.closing}
      aria-labelledby="closing-heading"
    >
      <div className={styles.closingInner}>
        <h2 id="closing-heading" className={styles.heading}>
          Your next chapter
          <br />
          starts here.
        </h2>

        <p className={styles.description}>
          Whether you’re exploring opportunities or looking for your next
          hire, make your next move with CareerConnect.
        </p>

        <Link
          href="/auth/signup"
          className={styles.cta}
          aria-describedby="closing-signup-note"
        >
          Get started
          <ArrowRight size={20} aria-hidden="true" />
        </Link>

        <p id="closing-signup-note" className={styles.note}>
          Create an account to get started.
        </p>
      </div>
    </section>
  );
}

export function HomeFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <Link href="/" className={styles.brand} aria-label="CareerConnect home">
          CareerConnect<span aria-hidden="true">.</span>
        </Link>

        <nav aria-label="Footer navigation" className={styles.links}>
          <a href="#job-seekers">For job seekers</a>
          <a href="#recruiters">For recruiters</a>
          <Link href="/auth/login">Log in</Link>
        </nav>
      </div>
    </footer>
  );
}