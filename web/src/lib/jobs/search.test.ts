import { beforeEach, describe, expect, it, vi } from "vitest";
import { JOB_SEARCH_LIMIT, buildJobSearchFilter, searchJobs } from "./search";

const { mockGetUser, mockFrom, mockSelect, mockOr, mockOrder, mockLimit } = vi.hoisted(
  () => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockSelect: vi.fn(),
    mockOr: vi.fn(),
    mockOrder: vi.fn(),
    mockLimit: vi.fn(),
  })
);

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

const sampleJob = {
  id: "job-1",
  title: "Junior Software Developer",
  firm_name: "Acme",
  location: "Montreal",
  description: "Build web apps with React.",
  required_skills: "React, TypeScript",
  salary: 60000,
  status: "open",
  created_at: "2026-10-12T00:00:00Z",
};

function signedIn() {
  mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });
}

describe("searchJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Every query-builder step returns the same chainable object.
    const builder = { or: mockOr, order: mockOrder, limit: mockLimit };
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue(builder);
    mockOr.mockReturnValue(builder);
    mockOrder.mockReturnValue(builder);
    mockLimit.mockResolvedValue({ data: [sampleJob], error: null });
  });

  it("asks the user to sign in when there is no session", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const result = await searchJobs("developer");

    expect(result).toEqual({
      success: false,
      query: "developer",
      error: "Unable to authenticate. Please sign in again.",
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("searches title, company, description, skills and location", async () => {
    signedIn();

    const result = await searchJobs("  react ");

    expect(mockFrom).toHaveBeenCalledWith("job");
    expect(mockOr).toHaveBeenCalledWith(buildJobSearchFilter("react"));
    expect(buildJobSearchFilter("react")).toBe(
      "title.ilike.%react%,firm_name.ilike.%react%,description.ilike.%react%,required_skills.ilike.%react%,location.ilike.%react%"
    );
    expect(result).toEqual({ success: true, query: "react", jobs: [sampleJob] });
  });

  it("returns the newest jobs without a filter when the search is empty", async () => {
    signedIn();

    const result = await searchJobs("   ");

    expect(mockOr).not.toHaveBeenCalled();
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(mockLimit).toHaveBeenCalledWith(JOB_SEARCH_LIMIT);
    expect(result).toEqual({ success: true, query: "", jobs: [sampleJob] });
  });

  it("returns an empty list when nothing matches", async () => {
    signedIn();
    mockLimit.mockResolvedValueOnce({ data: [], error: null });

    const result = await searchJobs("astronaut");

    expect(result).toEqual({ success: true, query: "astronaut", jobs: [] });
  });

  it("returns a friendly error when the database fails", async () => {
    signedIn();
    mockLimit.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const result = await searchJobs("developer");

    expect(result).toEqual({
      success: false,
      query: "developer",
      error: "Unable to load jobs. Please try again.",
    });
  });
});
