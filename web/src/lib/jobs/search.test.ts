import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildJobSearchFilter, searchJobs } from "./search";

const {
  mockGetUser,
  mockFrom,
  mockSelect,
  mockEq,
  mockOr,
  mockOrder,
  mockRange,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockOr: vi.fn(),
  mockOrder: vi.fn(),
  mockRange: vi.fn(),
}));

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

    const builder = {
      eq: mockEq,
      or: mockOr,
      order: mockOrder,
      range: mockRange,
    };

    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue(builder);
    mockEq.mockReturnValue(builder);
    mockOr.mockReturnValue(builder);
    mockOrder.mockReturnValue(builder);

    mockRange.mockResolvedValue({
      data: [sampleJob],
      count: 8,
      error: null,
    });
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

    // In "searches title, company, description, skills and location"
    expect(result).toEqual({
      success: true,
      query: "react",
      page: 1,
      totalCount: 8,
      jobs: [sampleJob],
    });
  });

  it("returns the first page of open jobs with the total count", async () => {
    signedIn();

    const result = await searchJobs("   ");

    expect(mockFrom).toHaveBeenCalledWith("job");
    expect(mockEq).toHaveBeenCalledWith("status", "open");
    expect(mockOr).not.toHaveBeenCalled();
    expect(mockOrder).toHaveBeenNthCalledWith(
      1,
      "created_at",
      { ascending: false }
    );
    expect(mockOrder).toHaveBeenNthCalledWith(
      2,
      "id",
      { ascending: false }
    );
    expect(mockRange).toHaveBeenCalledWith(0, 5);

    expect(result).toEqual({
      success: true,
      query: "",
      page: 1,
      totalCount: 8,
      jobs: [sampleJob],
    });
  });

  it("requests the next six rows for page two", async () => {
    signedIn();

    const result = await searchJobs("react", "2");

    expect(mockOr).toHaveBeenCalledWith(buildJobSearchFilter("react"));
    expect(mockRange).toHaveBeenCalledWith(6, 11);
    expect(result).toEqual({
      success: true,
      query: "react",
      page: 2,
      totalCount: 8,
      jobs: [sampleJob],
    });
  });

  it("returns an empty list when nothing matches", async () => {
    signedIn();
    mockRange.mockResolvedValueOnce({
      data: [],
      count: 0,
      error: null,
    });

    const result = await searchJobs("astronaut");

    expect(result).toEqual({
      success: true,
      query: "astronaut",
      page: 1,
      totalCount: 0,
      jobs: [],
    });
  });

  it("returns a friendly error when the database fails", async () => {
    signedIn();
    mockRange.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const result = await searchJobs("developer");

    expect(result).toEqual({
      success: false,
      query: "developer",
      error: "Unable to load jobs. Please try again.",
    });
  });
});
