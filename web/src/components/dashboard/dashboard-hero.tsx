import { Search } from "lucide-react";
import { MAX_JOB_SEARCH_LENGTH } from "@/lib/validations/job-search";

type DashboardHeroProps = {
  firstName: string;
  todayLabel: string;
};

/** Navy welcome band with the main job search. Submits to /jobs?q=... like JobSearchBar. */
export default function DashboardHero({ firstName, todayLabel }: DashboardHeroProps) {
  return (
    <section className="relative overflow-hidden bg-[#0E1726] text-white">
      {/* Decorative dot grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:22px_22px]"
      />
      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-6 px-4 pb-14 pt-10 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#A9C1FF]">
          Dashboard · {todayLabel}
        </p>

        <div className="flex max-w-2xl flex-col gap-2">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Welcome back, {firstName}.
          </h1>
          <p className="text-base text-[#C7D0DD] sm:text-lg">
            Find your next role and keep every application on track.
          </p>
        </div>

        <form
          action="/jobs"
          method="get"
          role="search"
          className="flex w-full max-w-3xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)] sm:flex-row"
        >
          <label htmlFor="dashboard-job-search" className="sr-only">
            Search jobs
          </label>
          <div className="flex flex-1 items-center gap-3 rounded-xl bg-[#F5F6F8] px-4">
            <Search aria-hidden="true" className="size-5 shrink-0 text-[#4B5563]" />
            <input
              id="dashboard-job-search"
              name="q"
              type="search"
              maxLength={MAX_JOB_SEARCH_LENGTH}
              placeholder="Job title, company, or keyword"
              className="h-12 w-full bg-transparent text-base text-[#0E1726] placeholder:text-[#6B7280] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="h-12 rounded-xl bg-[#1D4ED8] px-7 text-base font-bold text-white transition-colors hover:bg-[#1E40AF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
          >
            Search jobs
          </button>
        </form>
      </div>
    </section>
  );
}
