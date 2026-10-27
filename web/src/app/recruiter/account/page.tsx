import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardProfileSummary } from "@/lib/dashboard/data";
import { getInitials } from "@/lib/dashboard/summary";
import { PageBody, PageHero } from "@/components/app/page-hero";

export const metadata: Metadata = {
  title: "Your account",
  description: "Your recruiter account details.",
};

/** Recruiter account page: who you are signed in as. Recruiters have no resume, skills or experience. */
export default async function RecruiterAccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?as=recruiter");
  }

  const summary = await getDashboardProfileSummary(user.id);
  const email = user.email ?? "";
  const name = summary.fullName?.trim() || email;
  const initials = getInitials(summary.fullName?.trim() || null, email);

  return (
    <main>
      <PageHero
        label="Recruiter"
        title="Your account"
        description="The details you are signed in with."
      />

      <PageBody>
        <section
          aria-label="Account details"
          className="overflow-hidden rounded-2xl border border-[#E3E6EB] bg-white"
        >
          <div
            aria-hidden="true"
            className="h-16 bg-[#1D4ED8] [background-image:linear-gradient(135deg,#1D4ED8,#0E1726)]"
          />
          <div className="flex flex-wrap items-start gap-5 px-5 pb-6 sm:px-8">
            <span
              aria-hidden="true"
              className="-mt-9 flex size-[72px] shrink-0 items-center justify-center rounded-full border-4 border-white bg-[#0E1726] text-xl font-extrabold text-white"
            >
              {initials}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1 pt-3">
              <h2 className="truncate text-xl font-extrabold tracking-tight text-[#0E1726]">
                {name}
              </h2>
              <p className="truncate text-sm text-[#4B5563]">{email}</p>
              <p className="mt-1">
                <span className="inline-flex items-center rounded-full bg-[#E8EEFD] px-2.5 py-1 text-xs font-bold text-[#1D4ED8]">
                  Recruiter
                </span>
              </p>
            </div>
          </div>

          <div className="border-t border-[#EEF0F3]">
            <Link
              href="/recruiter/jobs"
              className="flex min-h-12 items-center justify-between gap-2 px-5 text-sm font-semibold text-[#1F2937] hover:bg-[#F5F6F8] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1D4ED8] sm:px-8"
            >
              My job postings
              <ArrowRight
                aria-hidden="true"
                className="size-4 text-[#4B5563]"
              />
            </Link>
          </div>
        </section>

        <p className="mt-4 text-sm text-[#4B5563]">
          Recruiter accounts use a Concordia email address. Applicants&apos;
          profiles are visible to you only for the postings you own.
        </p>
      </PageBody>
    </main>
  );
}
