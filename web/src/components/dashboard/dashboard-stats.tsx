import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { DashboardStatusCounts } from "@/lib/dashboard/summary";
import styles from "./dashboard.module.css";

type DashboardStatsProps = {
  counts: DashboardStatusCounts;
  loadError: boolean;
};

export default function DashboardStats({ counts, loadError }: DashboardStatsProps) {
  const cells = [
    { label: "Total", value: counts.total, tone: "unknown" },
    { label: "In progress", value: counts.inProgress, tone: "progress" },
    { label: "Interviews", value: counts.interview, tone: "interview" },
    { label: "Offers", value: counts.offers, tone: "offer" },
    { label: "Rejected", value: counts.rejected, tone: "rejected" },
  ];

  return (
    <section aria-labelledby="dashboard-stats-heading" className={styles.card}>
      <div className={styles.sectionHeading}>
        <h2 id="dashboard-stats-heading">Your applications</h2>
        <Link href="/application-status" className={styles.textLink}>
          Track applications <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>
      {loadError && <p className={styles.unavailable}>Application totals are unavailable.</p>}
      <dl className={styles.stats}>
        {cells.map((cell) => (
          <div key={cell.label}>
            <dt>
              <span aria-hidden="true" className={styles.statusDot} data-tone={cell.tone} />
              {cell.label}
            </dt>
            <dd>{loadError ? <><span aria-hidden="true">—</span><span className="sr-only">Unavailable</span></> : cell.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
