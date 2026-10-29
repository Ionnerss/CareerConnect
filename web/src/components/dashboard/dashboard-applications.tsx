import Link from "next/link";
import { ArrowRight, Briefcase, CircleAlert } from "lucide-react";
import type { ApplicationCardData } from "@/lib/application_status/application_status_logic";
import { formatAppliedDate, getStatusLabel, getStatusTone } from "@/lib/dashboard/summary";
import styles from "./dashboard.module.css";

type DashboardApplicationsProps = {
  applications: ApplicationCardData[];
  loadError: boolean;
  now: Date;
};

const RECENT_LIMIT = 5;

export default function DashboardApplications({ applications, loadError, now }: DashboardApplicationsProps) {
  const recent = applications.slice(0, RECENT_LIMIT);

  return (
    <section aria-labelledby="recent-applications-heading" className={styles.card}>
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="recent-applications-heading">Recent applications</h2>
          {!loadError && recent.length > 0 && (
            <p className={styles.secondary}>Latest {recent.length} of {applications.length}</p>
          )}
        </div>
        {!loadError && applications.length > 0 && (
          <Link href="/application-status" className={styles.textLink}>
            View all <span className="sr-only">applications</span><ArrowRight aria-hidden="true" size={16} />
          </Link>
        )}
      </div>
      {loadError ? (
        <div className={styles.emptyState}>
          <CircleAlert aria-hidden="true" size={28} className={styles.errorIcon} />
          <div role="alert">
            <h3>We couldn&apos;t load your applications.</h3>
            <p>Your application information is unavailable right now. Try loading the dashboard again.</p>
          </div>
          {/* A full reload retries server fetching without changing the data contract. */}
          <a href="/dashboard" className={styles.secondaryButton}>Try again</a>
        </div>
      ) : recent.length === 0 ? (
        <div className={styles.emptyState}>
          <Briefcase aria-hidden="true" size={28} className={styles.emptyIcon} />
          <div>
            <h3>You haven&apos;t applied to any jobs yet.</h3>
            <p>When you apply, each application shows up here with its latest status.</p>
          </div>
          <Link href="/jobs" className={styles.primaryButton}>Browse jobs <ArrowRight aria-hidden="true" size={16} /></Link>
        </div>
      ) : (
        <ul className={styles.applications}>
          {recent.map((application) => {
            const company = application.job?.firm_name?.trim() || "Company not specified";
            const title = application.job?.title?.trim() || "Position not specified";
            const location = application.job?.location?.trim() || "Location not specified";
            return (
              <li key={application.id} className={styles.applicationRow}>
                <span aria-hidden="true" className={styles.companyTile}>{company[0].toUpperCase()}</span>
                <div className={styles.jobInfo}>
                  <h3>{title}</h3>
                  <p>{company} · {location}</p>
                </div>
                <div className={styles.applicationMeta}>
                  <span className={styles.status} data-tone={getStatusTone(application.status)}>
                    <span aria-hidden="true" className={styles.badgeDot} />{getStatusLabel(application.status)}
                  </span>
                  <span className={styles.appliedDate}>
                    <span className="sr-only">Applied: </span>{formatAppliedDate(application.created_at, now)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
