import { describe, expect, it } from "vitest";
import { jobFiltersSchema } from "./job-filters";

describe("jobFiltersSchema", () => {
  it("accepts empty filters", () => {
    expect(jobFiltersSchema.safeParse({}).success).toBe(true);

    expect(
      jobFiltersSchema.safeParse({
        location: "",
        minSalary: "",
        maxSalary: "",
        experienceLevel: "",
        jobType: "",
      }).success
    ).toBe(true);
  });

  it("normalizes a valid combination of filters", () => {
    const result = jobFiltersSchema.parse({
      location: "  Montreal  ",
      minSalary: "50000",
      maxSalary: "100000",
      experienceLevel: "Entry Level",
      jobType: "Internship",
    });

    expect(result).toEqual({
      location: "Montreal",
      minSalary: 50000,
      maxSalary: 100000,
      experienceLevel: "Entry Level",
      jobType: "Internship",
    });
  });

  it("rejects a minimum salary greater than maximum", () => {
    const result = jobFiltersSchema.safeParse({
      minSalary: "100000",
      maxSalary: "50000",
    });

    expect(result.success).toBe(false);
  });

  it.each(["-100", "abc", "12.345", "Infinity"])(
    "rejects invalid salary %s",
    (salary) => {
      expect(
        jobFiltersSchema.safeParse({
          minSalary: salary,
        }).success
      ).toBe(false);
    }
  );

  it("rejects unsupported experience levels", () => {
    expect(
      jobFiltersSchema.safeParse({
        experienceLevel: "Expert",
      }).success
    ).toBe(false);
  });

  it("rejects unsupported job types", () => {
    expect(
      jobFiltersSchema.safeParse({
        jobType: "Freelance",
      }).success
    ).toBe(false);
  });

  it("rejects SQL LIKE wildcard characters in locations", () => {
    expect(
      jobFiltersSchema.safeParse({
        location: "%",
      }).success
    ).toBe(false);
  });

  it("rejects duplicated URL parameter arrays", () => {
    expect(
      jobFiltersSchema.safeParse({
        jobType: ["Internship", "Contract"],
      }).success
    ).toBe(false);
  });
});
