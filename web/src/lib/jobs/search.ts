import { createClient } from "@/lib/supabase/server";
import { normalizeJobSearchQuery } from "@/lib/validations/job-search";

export type JobSearchResult = {
  id: string;
  title: string | null;
  firm_name: string | null;
  location: string | null;
  description: string | null;
  required_skills: string | null;
  salary: number | null;
  status: string | null;
  created_at: string;
};

export type SearchJobsResponse =
  | {
      success: true;
      query: string;
      page: number;
      totalCount: number;
      jobs: JobSearchResult[];
    }
  | {
      success: false;
      query: string;
      error: string;
    };

/** Columns a search term is matched against (case-insensitive, partial match). */
const SEARCHABLE_COLUMNS = [
  "title",
  "firm_name",
  "description",
  "required_skills",
  "location",
] as const;

export function buildJobSearchFilter(query: string): string {
  return SEARCHABLE_COLUMNS.map((column) => `${column}.ilike.%${query}%`).join(",");
}

/**
 * Returns job postings matching the search text.
 * An empty search returns the newest postings.
 */
export async function searchJobs(rawQuery: unknown, rawPage: unknown = undefined): Promise<SearchJobsResponse> {
  const query = normalizeJobSearchQuery(rawQuery);
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      query,
      error: "Unable to authenticate. Please sign in again.",
    };
  }

  const pageNum = normalizePage(rawPage);

  const JOBS_PER_PAGE = 6;

  const firstRow = (pageNum - 1) * JOBS_PER_PAGE;
  const lastRow = firstRow + JOBS_PER_PAGE - 1;

  let request = supabase
      .from("job")
      .select(
          "id, title, firm_name, location, description, required_skills, salary, status, created_at",
          { count: "exact" }
      )
      .eq("status", "open");

  if (query !== "") {
      request = request.or(buildJobSearchFilter(query));
  }

  const { data, count, error } = await request
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(firstRow, lastRow);

  if (error) {
    return {
      success: false,
      query,
      error: "Unable to load jobs. Please try again.",
    };
  }

  return {
    success: true,
    query,
    page: pageNum,
    totalCount: count ?? 0,
    jobs: (data ?? []) as JobSearchResult[],
  };
}

function normalizePage(rawPage: unknown): number {
    if (typeof rawPage === "number") {
        return Number.isSafeInteger(rawPage) && rawPage > 0
            ? rawPage
            : 1;
    }

    if (typeof rawPage !== "string") {
        return 1;
    }

    const content = rawPage.trim();

    if (!/^\d+$/.test(content)) {
        return 1;
    }

    const page = Number(content);

    return Number.isSafeInteger(page) && page > 0 ? page : 1;
}