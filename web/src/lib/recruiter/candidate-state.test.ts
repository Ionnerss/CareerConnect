import { describe, expect, it } from "vitest";
import { buildCandidateState, totalYearsOfExperience, type ExperienceRow } from "./candidate-state";

const NOW = new Date("2026-10-18T00:00:00Z");

function role(start: string, end: string | null): ExperienceRow {
  return { job_role: "Developer", start_date: start, end_date: end };
}

describe("totalYearsOfExperience", () => {
  it("returns 0 with no roles", () => {
    expect(totalYearsOfExperience([], NOW)).toBe(0);
  });

  it("measures a single role in years, rounded to one decimal", () => {
    expect(totalYearsOfExperience([role("2022-01-01", "2024-01-01")], NOW)).toBe(2);
    expect(totalYearsOfExperience([role("2023-01-01", "2023-07-01")], NOW)).toBe(0.5);
  });

  it("runs an open-ended role until now", () => {
    expect(totalYearsOfExperience([role("2024-10-18", null)], NOW)).toBe(2);
  });

  it("adds separate roles", () => {
    expect(
      totalYearsOfExperience([role("2018-01-01", "2019-01-01"), role("2020-01-01", "2022-01-01")], NOW),
    ).toBe(3);
  });

  it("counts overlapping roles only once", () => {
    // 2020-2022 and 2021-2023 overlap in 2021-2022: together 2020-2023 = 3 years, not 4.
    expect(
      totalYearsOfExperience([role("2020-01-01", "2022-01-01"), role("2021-01-01", "2023-01-01")], NOW),
    ).toBe(3);
  });

  it("does not double count a role fully inside another", () => {
    expect(
      totalYearsOfExperience([role("2020-01-01", "2024-01-01"), role("2021-01-01", "2022-01-01")], NOW),
    ).toBe(4);
  });

  it("skips roles with an unreadable start date", () => {
    expect(totalYearsOfExperience([role("not a date", "2024-01-01")], NOW)).toBe(0);
  });

  it("treats an unreadable end date as still running", () => {
    expect(totalYearsOfExperience([role("2024-10-18", "garbage")], NOW)).toBe(2);
  });
});

describe("buildCandidateState", () => {
  const input = {
    skills: [{ name: "React", proficiency: "Advanced" }],
    education: [
      {
        school: "Secret University",
        degree: "BEng",
        field_of_study: "Software Engineering",
        start_date: "2021-09-01",
        end_date: null,
        description: "Focus on web systems",
      },
    ],
    experience: [
      {
        company_name: "Secret Corp",
        job_role: "Frontend Developer",
        start_date: "2024-10-18",
        end_date: null,
        description: "Built dashboards in React",
      },
    ],
  };

  it("keeps skills, school, degree, company, role, dates and descriptions by default", () => {
    const state = buildCandidateState(input, { now: NOW });

    expect(state.skills).toEqual([{ name: "React", proficiency: "Advanced" }]);
    expect(state.education[0]).toEqual({
      school: "Secret University",
      degree: "BEng",
      field_of_study: "Software Engineering",
      start: "2021-09",
      end: null,
      description: "Focus on web systems",
    });
    expect(state.experience[0]).toEqual({
      company: "Secret Corp",
      role: "Frontend Developer",
      start: "2024-10",
      end: null,
      years: 2,
      description: "Built dashboards in React",
    });
    expect(state.total_years_of_experience).toBe(2);
  });

  it("leaves out company and school names when includeOrganizations is false", () => {
    const state = buildCandidateState(input, { now: NOW, includeOrganizations: false });
    const serialized = JSON.stringify(state);

    expect(serialized).not.toContain("Secret Corp");
    expect(serialized).not.toContain("Secret University");
    expect(state.education[0]).not.toHaveProperty("school");
    expect(state.experience[0]).not.toHaveProperty("company");
    // Everything else is still there.
    expect(state.education[0].degree).toBe("BEng");
    expect(state.experience[0].role).toBe("Frontend Developer");
  });

  it.each([true, false])(
    "never includes the applicant's name or contact details (includeOrganizations: %s)",
    (includeOrganizations) => {
      const serialized = JSON.stringify(
        buildCandidateState(
          {
            ...input,
            // Extra fields that must never reach the model, even if a caller passes whole rows.
            experience: [{ ...input.experience[0], contact_email: "a@b.com", full_name: "Jane Doe" } as never],
          },
          { now: NOW, includeOrganizations },
        ),
      );

      expect(serialized).not.toContain("a@b.com");
      expect(serialized).not.toContain("Jane Doe");
    },
  );

  it("handles a candidate with no data", () => {
    expect(buildCandidateState({ skills: [], education: [], experience: [] }, { now: NOW })).toEqual({
      skills: [],
      education: [],
      experience: [],
      total_years_of_experience: 0,
    });
  });

  it("uses null for missing optional fields", () => {
    const state = buildCandidateState(
      {
        skills: [],
        education: [{ degree: "Diploma", start_date: "2020-01-01" }],
        experience: [{ job_role: "Intern", start_date: "2020-01-01", end_date: "2020-04-01" }],
      },
      { now: NOW },
    );

    expect(state.education[0]).toMatchObject({ school: null, field_of_study: null, end: null, description: null });
    expect(state.experience[0]).toMatchObject({ company: null, description: null, end: "2020-04" });
  });
});
