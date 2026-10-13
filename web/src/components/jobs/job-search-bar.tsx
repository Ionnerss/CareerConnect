import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_JOB_SEARCH_LENGTH } from "@/lib/validations/job-search";

type JobSearchBarProps = {
  defaultQuery?: string;
};

/**
 * Search bar used on the dashboard and the jobs page.
 * It submits to /jobs?q=..., so searches can be bookmarked and shared.
 */
export default function JobSearchBar({ defaultQuery = "" }: JobSearchBarProps) {
  return (
    <form action="/jobs" method="get" role="search" className="flex w-full gap-2">
      <label htmlFor="job-search" className="sr-only">
        Search jobs
      </label>
      <Input
        id="job-search"
        name="q"
        type="search"
        defaultValue={defaultQuery}
        maxLength={MAX_JOB_SEARCH_LENGTH}
        placeholder="Job title, company, or keyword"
        className="h-9"
      />
      <Button type="submit" size="lg">
        Search
      </Button>
      {defaultQuery !== "" && (
        <Link href="/jobs" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Clear
        </Link>
      )}
    </form>
  );
}
