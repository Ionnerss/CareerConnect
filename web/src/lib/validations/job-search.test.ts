import { describe, expect, it } from "vitest";
import { MAX_JOB_SEARCH_LENGTH, normalizeJobSearchQuery } from "./job-search";

describe("normalizeJobSearchQuery", () => {
  it("trims surrounding spaces", () => {
    expect(normalizeJobSearchQuery("  developer  ")).toBe("developer");
  });

  it.each([undefined, null, 42, ["developer"]])(
    "treats a missing or non-text value (%s) as an empty search",
    (value) => {
      expect(normalizeJobSearchQuery(value)).toBe("");
    }
  );

  it("treats a blank search as empty", () => {
    expect(normalizeJobSearchQuery("    ")).toBe("");
  });

  it("removes characters that would break the database filter", () => {
    expect(normalizeJobSearchQuery("react,(node)%*\\")).toBe("react node");
  });

  it("collapses repeated spaces", () => {
    expect(normalizeJobSearchQuery("software    engineer")).toBe("software engineer");
  });

  it("limits the search to the maximum length", () => {
    const result = normalizeJobSearchQuery("a".repeat(MAX_JOB_SEARCH_LENGTH + 50));
    expect(result).toHaveLength(MAX_JOB_SEARCH_LENGTH);
  });
});
