import Link from "next/link";
import { ArrowRight, Check, FileText, Search, UserRound } from "lucide-react";
import type { NextStep } from "@/lib/dashboard/summary";
import styles from "./dashboard.module.css";

type ProfileCardProps = {
  displayName: string;
  email: string;
  initials: string;
  resumeCount: number;
};

export function DashboardProfileCard({ displayName, email, initials, resumeCount }: ProfileCardProps) {
  return (
    <section aria-labelledby="dashboard-profile-heading" className={styles.profile}>
      <h2 id="dashboard-profile-heading">Your profile</h2>
      <div className={styles.profileIdentity}>
        <span aria-hidden="true" className={styles.avatar}>{initials}</span>
        <div>
          <p className={styles.profileName}>{displayName}</p>
          <p className={styles.secondary}>{email}</p>
        </div>
      </div>
      <dl className={styles.resumeCount}>
        <div><dt>Resumes uploaded</dt><dd>{resumeCount}</dd></div>
      </dl>
      <div className={styles.profileLinks}>
        <Link href="/profile" className={styles.secondaryButton}>
          <UserRound aria-hidden="true" size={16} /> Edit profile
        </Link>
        <Link href="/upload-resume" className={styles.secondaryButton}>
          <FileText aria-hidden="true" size={16} />
          {resumeCount > 0 ? "Manage resume" : "Upload resume"}
        </Link>
      </div>
    </section>
  );
}

type NextStepsProps = { steps: NextStep[] };

/** Highlight the first unfinished step; completed work remains visible as text. */
export function DashboardNextSteps({ steps }: NextStepsProps) {
  const nextStep = steps.find((step) => !step.done);
  if (!nextStep) return null;

  return (
    <section aria-labelledby="next-steps-heading" className={styles.nextSteps}>
      <div className={styles.nextStepLead}>
        <div>
          <h2 id="next-steps-heading">Your next step</h2>
          <p>Build the foundations for your job search.</p>
        </div>
        <Link href={nextStep.href} className={styles.primaryButton}>
          {nextStep.label} <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>
      <ul className={styles.checklist}>
        {steps.map((step) => (
          <li key={step.id}>
            {step.done ? (
              <span className={styles.completedStep}>
                <Check aria-hidden="true" size={16} />
                {step.label}<span className="sr-only"> (done)</span>
              </span>
            ) : step.id === nextStep.id ? (
              <span className={styles.currentStep}>
                <span aria-hidden="true" className={styles.stepCircle} />
                {step.label}<span className="sr-only"> (next step)</span>
              </span>
            ) : (
              <Link href={step.href} className={styles.stepLink}>
                <span aria-hidden="true" className={styles.stepCircle} />{step.label}
                <ArrowRight aria-hidden="true" size={14} />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Right column: shortcuts to pages that exist today. */
export function DashboardShortcuts() {
  const links = [
    { href: "/jobs", label: "Browse all jobs", icon: Search },
    { href: "/application-status", label: "Track applications", icon: ArrowRight },
    { href: "/upload-resume", label: "Upload a resume", icon: FileText },
  ];

  return (
    <section
      aria-labelledby="shortcuts-heading"
      className="flex flex-col gap-2 rounded-2xl bg-[#0E1726] p-5 text-white"
    >
      <h2
        id="shortcuts-heading"
        className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#A9C1FF]"
      >
        Shortcuts
      </h2>
      <ul className="flex flex-col">
        {links.map(({ href, label, icon: Icon }) => (
          <li key={href} className="border-t border-[#22314A] first:border-t-0">
            <Link
              href={href}
              className="flex min-h-11 items-center justify-between gap-2 text-sm font-semibold text-white hover:text-[#A9C1FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B93FF]"
            >
              {label}
              <Icon aria-hidden="true" className="size-4" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
