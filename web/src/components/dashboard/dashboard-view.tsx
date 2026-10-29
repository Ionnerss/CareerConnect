import type { ApplicationCardData } from "@/lib/application_status/application_status_logic";
import type { DashboardStatusCounts, NextStep } from "@/lib/dashboard/summary";
import DashboardHeader from "./dashboard-header";
import DashboardHero from "./dashboard-hero";
import DashboardStats from "./dashboard-stats";
import DashboardApplications from "./dashboard-applications";
import { DashboardNextSteps, DashboardProfileCard } from "./dashboard-sidebar";
import styles from "./dashboard.module.css";

type DashboardViewProps = {
  className?: string;
  firstName: string;
  displayName: string;
  email: string;
  initials: string;
  resumeCount: number;
  todayLabel: string;
  counts: DashboardStatusCounts;
  steps: NextStep[];
  applications: ApplicationCardData[];
  applicationsLoadError: boolean;
  now: Date;
};

/** Presentation only. The route continues to own authentication and data fetching. */
export default function DashboardView(props: DashboardViewProps) {
  // A failed request cannot tell us whether the user has applied before.
  const visibleSteps = props.steps.filter(
    (step) => !props.applicationsLoadError || step.id !== "apply",
  );

  return (
    <div className={`${styles.dashboard} ${props.className ?? ""}`}>
      <a href="#dashboard-main" className={styles.skipLink}>Skip to dashboard</a>
      <DashboardHeader initials={props.initials} />
      <main id="dashboard-main" tabIndex={-1} className={styles.main}>
        <DashboardHero firstName={props.firstName} todayLabel={props.todayLabel} />
        <div className={styles.layout}>
          <div className={styles.primaryColumn}>
            <DashboardNextSteps steps={visibleSteps} />
            <DashboardStats counts={props.counts} loadError={props.applicationsLoadError} />
            <DashboardApplications
              applications={props.applications}
              loadError={props.applicationsLoadError}
              now={props.now}
            />
          </div>
          <aside className={styles.sidebar} aria-label="Profile and resume">
            <DashboardProfileCard
              displayName={props.displayName}
              email={props.email}
              initials={props.initials}
              resumeCount={props.resumeCount}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
