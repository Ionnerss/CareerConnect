import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./auth.module.css";

/**
 * Shared frame for the login and sign-up pages. Pages only supply the card
 * contents, so form logic stays in the page files and the look lives here.
 * Side-panel copy lists only features that exist today.
 */
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.auth}>
      <aside className={styles.aside}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            C
          </span>
          CareerConnect
        </Link>

        <div className={styles.asideCopy}>
          <h2>Your talent. New possibilities.</h2>
          <p>One profile for your skills, experience and projects.</p>
          <ul className={styles.asideList}>
            <li>Build a profile recruiters can read</li>
            <li>Search jobs by what they ask for</li>
            <li>Follow every application</li>
          </ul>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.card}>{children}</div>
      </main>
    </div>
  );
}
