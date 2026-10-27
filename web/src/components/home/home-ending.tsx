import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./home-ending.module.css";
import { Reveal } from "./home-motion";

export function HomeEnding() {
  return (
    <section className={styles.closing} aria-labelledby="closing-heading">
      <div className={styles.closingInner}>
        <Reveal>
          <h2 id="closing-heading" className={styles.heading}>
            Your next chapter
            <br />
            <span>starts here.</span>
          </h2>

          <p className={styles.description}>
            Whether you&rsquo;re exploring opportunities or looking for your
            next hire, make your next move with CareerConnect.
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
        </Reveal>
      </div>
    </section>
  );
}

export function HomeFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <Link href="/" className={styles.brand} aria-label="CareerConnect home">
          <span className={styles.brandMark} aria-hidden="true">
            C
          </span>
          CareerConnect
        </Link>

        <nav aria-label="Footer navigation" className={styles.links}>
          <a href="#job-seekers">For job seekers</a>
          <a href="#recruiters">For recruiters</a>
          <a href="#how-it-works">How it works</a>
          <Link href="/auth/login">Log in</Link>
          <Link href="/auth/signup">Sign up</Link>
        </nav>
      </div>
    </footer>
  );
}
