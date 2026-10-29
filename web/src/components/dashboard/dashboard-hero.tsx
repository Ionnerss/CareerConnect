import { Search } from "lucide-react";
import { MAX_JOB_SEARCH_LENGTH } from "@/lib/validations/job-search";
import styles from "./dashboard.module.css";

type DashboardHeroProps = {
  firstName: string;
  todayLabel: string;
};

/** Submits to /jobs?q=... using the existing search contract. */
export default function DashboardHero({ firstName, todayLabel }: DashboardHeroProps) {
  return (
    <section className={styles.hero} aria-labelledby="dashboard-heading">
      <div>
        <p className={styles.date}>Dashboard · {todayLabel}</p>
        <h1 id="dashboard-heading">Welcome back, {firstName}.</h1>
        <p className={styles.intro}>Find your next role and keep every application on track.</p>
      </div>
      <form action="/jobs" method="get" role="search" className={styles.search}>
        <label htmlFor="dashboard-job-search" className={styles.searchLabel}>Search jobs</label>
        <div className={styles.searchControls}>
          <div className={styles.searchField}>
            <Search aria-hidden="true" size={20} />
            <input
              id="dashboard-job-search"
              name="q"
              type="search"
              maxLength={MAX_JOB_SEARCH_LENGTH}
              placeholder="Job title, company, or keyword"
            />
          </div>
          <button type="submit" className={styles.primaryButton}>Search jobs</button>
        </div>
      </form>
    </section>
  );
}
