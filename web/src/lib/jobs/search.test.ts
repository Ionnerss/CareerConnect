import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildJobSearchFilter, searchJobs } from "./search";

const {
  mockGetUser,
  mockFrom,
  mockSelect,
  mockEq,
  mockOr,
  mockIlike,
  mockGte,
  mockLte,
  mockOrder,
  mockRange,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockOr: vi.fn(),
  mockIlike: vi.fn(),
  mockGte: vi.fn(),
  mockLte: vi.fn(),
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
  mockGetUser.mockResolvedValueOnce({
    data: { user: { id: "user-1" } },
    error: null,
  });
}

describe("searchJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const builder = {
      eq: mockEq,
      or: mockOr,
      ilike: mockIlike,
      gte: mockGte,
      lte: mockLte,
      order: mockOrder,
      range: mockRange,
    };

    mockFrom.mockReturnValue({ select: mockSelect });

    mockSelect.mockReturnValue(builder);
    mockEq.mockReturnValue(builder);
    mockOr.mockReturnValue(builder);
    mockIlike.mockReturnValue(builder);
    mockGte.mockReturnValue(builder);
    mockLte.mockReturnValue(builder);
    mockOrder.mockReturnValue(builder);

    mockRange.mockResolvedValue({
      data: [sampleJob],
      count: 8,
      error: null,
    });
  });

  it("rejects unauthenticated searches", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const result = await searchJobs("developer");

    expect(result).toEqual({
      success: false,
      query: "developer",
      error: "Unable to authenticate. Please sign in again.",
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("preserves existing keyword search", async () => {
    signedIn();

    await searchJobs("  react ");

    expect(mockFrom).toHaveBeenCalledWith("job");
    expect(mockOr).toHaveBeenCalledWith(
      buildJobSearchFilter("react")
    );

    expect(buildJobSearchFilter("react")).toBe(
      "title.ilike.%react%,firm_name.ilike.%react%,description.ilike.%react%,required_skills.ilike.%react%,location.ilike.%react%"
    );
  });

  it("returns open jobs with no optional filters", async () => {
    signedIn();

    const result = await searchJobs("   ");

    expect(mockEq).toHaveBeenCalledWith("status", "open");
    expect(mockOr).not.toHaveBeenCalled();
    expect(mockIlike).not.toHaveBeenCalled();
    expect(mockGte).not.toHaveBeenCalled();
    expect(mockLte).not.toHaveBeenCalled();

    expect(mockRange).toHaveBeenCalledWith(0, 5);

    expect(result).toEqual({
      success: true,
      query: "",
      page: 1,
      totalCount: 8,
      jobs: [sampleJob],
    });
  });

  it("filters by location", async () => {
    signedIn();

    await searchJobs("", undefined, {
      location: "Montreal",
    });

    expect(mockIlike).toHaveBeenCalledWith(
      "location",
      "%Montreal%"
    );
  });

  it("filters by minimum and maximum salary", async () => {
    signedIn();

    await searchJobs("", undefined, {
      minSalary: "50000",
      maxSalary: "100000",
    });

    expect(mockGte).toHaveBeenCalledWith("salary", 50000);
    expect(mockLte).toHaveBeenCalledWith("salary", 100000);
  });

  it.each([
    ["Entry Level", 0, 2],
    ["Mid Level", 3, 5],
  ] as const)(
    "maps %s to the correct experience range",
    async (level, minimum, maximum) => {
      signedIn();

      await searchJobs("", undefined, {
        experienceLevel: level,
      });

      expect(mockGte).toHaveBeenCalledWith(
        "experience",
        minimum
      );

      expect(mockLte).toHaveBeenCalledWith(
        "experience",
        maximum
      );
    }
  );

  it("filters senior experience", async () => {
    signedIn();

    await searchJobs("", undefined, {
      experienceLevel: "Senior Level",
    });

    expect(mockGte).toHaveBeenCalledWith("experience", 6);
    expect(mockLte).not.toHaveBeenCalled();
  });

  it("filters by employment type", async () => {
    signedIn();

    await searchJobs("", undefined, {
      jobType: "Internship",
    });

    expect(mockEq).toHaveBeenCalledWith(
      "employment_type",
      "Internship"
    );
  });

  it("combines all filters and preserves pagination", async () => {
    signedIn();

    const result = await searchJobs("developer", "2", {
      location: " Montreal ",
      minSalary: "50000",
      maxSalary: "100000",
      experienceLevel: "Mid Level",
      jobType: "Full-time",
    });

    expect(mockEq).toHaveBeenCalledWith("status", "open");

    expect(mockOr).toHaveBeenCalledWith(
      buildJobSearchFilter("developer")
    );

    expect(mockIlike).toHaveBeenCalledWith(
      "location",
      "%Montreal%"
    );

    expect(mockGte).toHaveBeenCalledWith("salary", 50000);
    expect(mockLte).toHaveBeenCalledWith("salary", 100000);

    expect(mockGte).toHaveBeenCalledWith("experience", 3);
    expect(mockLte).toHaveBeenCalledWith("experience", 5);

    expect(mockEq).toHaveBeenCalledWith(
      "employment_type",
      "Full-time"
    );

    expect(mockRange).toHaveBeenCalledWith(6, 11);

    expect(result.success).toBe(true);
  });

  it("rejects invalid filters before querying Supabase", async () => {
    const result = await searchJobs("", undefined, {
      minSalary: "100000",
      maxSalary: "50000",
    });

    expect(result).toEqual({
      success: false,
      query: "",
      error: "Invalid job filters. Please adjust your search.",
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns an empty list when nothing matches", async () => {
    signedIn();

    mockRange.mockResolvedValueOnce({
      data: [],
      count: 0,
      error: null,
    });

    const result = await searchJobs("", undefined, {
      location: "Nonexistent City",
    });

    expect(result).toEqual({
      success: true,
      query: "",
      page: 1,
      totalCount: 0,
      jobs: [],
    });
  });

  it("returns a friendly database error", async () => {
    signedIn();

    mockRange.mockResolvedValueOnce({
      data: null,
      count: null,
      error: { message: "Database unavailable" },
    });

    const result = await searchJobs("developer");

    expect(result).toEqual({
      success: false,
      query: "developer",
      error: "Unable to load jobs. Please try again.",
    });
  });
});
