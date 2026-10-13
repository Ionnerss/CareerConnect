import { createClient } from "@/lib/supabase/server";
import { normalizeJobSearchQuery } from "@/lib/validations/job-search";

export const JOB_SEARCH_LIMIT = 50;

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
  | { success: true; query: string; jobs: JobSearchResult[] }
  | { success: false; query: string; error: string };

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
export async function searchJobs(rawQuery: unknown): Promise<SearchJobsResponse> {
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

  let request = supabase
    .from("job")
    .select(
      "id, title, firm_name, location, description, required_skills, salary, status, created_at"
    );

  if (query !== "") {
    request = request.or(buildJobSearchFilter(query));
  }

  const { data, error } = await request
    .order("created_at", { ascending: false })
    .limit(JOB_SEARCH_LIMIT);

  if (error) {
    return {
      success: false,
      query,
      error: "Unable to load jobs. Please try again.",
    };
  }

  return { success: true, query, jobs: (data ?? []) as JobSearchResult[] };
}
