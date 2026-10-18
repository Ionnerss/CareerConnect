import Link from "next/link";
import { ArrowRight, Check, FileText, Search, UserRound } from "lucide-react";
import type { NextStep } from "@/lib/dashboard/summary";

type ProfileCardProps = {
  displayName: string;
  email: string;
  initials: string;
  resumeCount: number;
};

/** Left column: who is signed in, with links to profile and resume. */
export function DashboardProfileCard({ displayName, email, initials, resumeCount }: ProfileCardProps) {
  return (
    <section
      aria-label="Your profile"
      className="overflow-hidden rounded-2xl border border-[#E3E6EB] bg-white"
    >
      <div aria-hidden="true" className="h-16 bg-[#1D4ED8] [background-image:linear-gradient(135deg,#1D4ED8,#0E1726)]" />
      <div className="flex flex-col items-center gap-1 px-5 pb-5 text-center">
        <span
          aria-hidden="true"
          className="-mt-9 flex size-[72px] items-center justify-center rounded-full border-4 border-white bg-[#0E1726] text-xl font-extrabold text-white"
        >
          {initials}
        </span>
        <p className="mt-2 text-lg font-bold text-[#0E1726]">{displayName}</p>
        <p className="w-full truncate text-sm text-[#4B5563]">{email}</p>
      </div>
      <dl className="grid grid-cols-1 border-t border-[#EEF0F3] px-5 py-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-[#4B5563]">Resumes uploaded</dt>
          <dd className="font-mono font-bold text-[#0E1726]">{resumeCount}</dd>
        </div>
      </dl>
      <div className="flex flex-col border-t border-[#EEF0F3]">
        <Link
          href="/profile"
          className="flex min-h-11 items-center gap-2 px-5 text-sm font-semibold text-[#1F2937] hover:bg-[#F5F6F8] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1D4ED8]"
        >
          <UserRound aria-hidden="true" className="size-4 text-[#4B5563]" />
          Edit profile
        </Link>
        <Link
          href="/upload-resume"
          className="flex min-h-11 items-center gap-2 border-t border-[#EEF0F3] px-5 text-sm font-semibold text-[#1F2937] hover:bg-[#F5F6F8] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1D4ED8]"
        >
          <FileText aria-hidden="true" className="size-4 text-[#4B5563]" />
          {resumeCount > 0 ? "Manage resume" : "Upload resume"}
        </Link>
      </div>
    </section>
  );
}

type NextStepsProps = {
  steps: NextStep[];
};

/** Right column: a short checklist built from real profile data. */
export function DashboardNextSteps({ steps }: NextStepsProps) {
  const doneCount = steps.filter((step) => step.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);

  return (
    <section
      aria-labelledby="next-steps-heading"
      className="flex flex-col gap-4 rounded-2xl border border-[#E3E6EB] bg-white p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="next-steps-heading" className="text-base font-bold text-[#0E1726]">
          Get started
        </h2>
        <span className="font-mono text-xs font-semibold text-[#4B5563]">
          {doneCount}/{steps.length} done
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Getting started progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 overflow-hidden rounded-full bg-[#E8EEFD]"
      >
        <div className="h-full rounded-full bg-[#1D4ED8]" style={{ width: `${percent}%` }} />
      </div>
      <ul className="flex flex-col gap-1">
        {steps.map((step) => (
          <li key={step.id}>
            {step.done ? (
              <p className="flex min-h-11 items-center gap-3 text-sm text-[#4B5563]">
                <span className="flex size-6 items-center justify-center rounded-full bg-[#047857] text-white">
                  <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                </span>
                <span className="line-through decoration-[#9CA3AF]">{step.label}</span>
                <span className="sr-only">(done)</span>
              </p>
            ) : (
              <Link
                href={step.href}
                className="group flex min-h-11 items-center gap-3 rounded-lg text-sm font-semibold text-[#0E1726] hover:text-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
              >
                <span
                  aria-hidden="true"
                  className="size-6 rounded-full border-2 border-[#C7D5FA] group-hover:border-[#1D4ED8]"
                />
                <span className="flex-1">{step.label}</span>
                <ArrowRight aria-hidden="true" className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
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
