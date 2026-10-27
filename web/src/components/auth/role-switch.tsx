"use client";

import type { LoginRole } from "@/lib/auth/roles";
import styles from "@/components/auth/auth.module.css";

const OPTIONS: { value: LoginRole; label: string }[] = [
  { value: "job_seeker", label: "Job seeker" },
  { value: "recruiter", label: "Recruiter" },
];

/** Job seeker / Recruiter switch shared by the log-in and sign-up pages. */
export default function RoleSwitch({
  label,
  value,
  onChange,
}: {
  /** Accessible name for the group, for example "Log in as". */
  label: string;
  value: LoginRole;
  onChange: (role: LoginRole) => void;
}) {
  return (
    <div role="group" aria-label={label} className={styles.roleSwitch}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={styles.roleOption}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
