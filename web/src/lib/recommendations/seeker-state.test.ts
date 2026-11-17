import { describe, expect, it } from "vitest";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_EDUCATION,
  MAX_EXPERIENCE,
  MAX_SKILLS,
  buildSeekerState,
  isProfileEmpty,
  type SeekerSnapshot,
} from "./seeker-state";

const NOW = new Date("2026-11-11T12:00:00Z");

function snapshot(overrides: Partial<SeekerSnapshot> = {}): SeekerSnapshot {
  return {
    skills: [{ name: "React", proficiency: "advanced" }],
    education: [
      {
        school: "Concordia University",
        degree: "BEng",
        field_of_study: "Software Engineering",
        start_date: "2023-09-01",
        end_date: null,
        description: null,
      },
    ],
    experience: [
      {
        company_name: "Acme Inc.",
        job_role: "Frontend Intern",
        start_date: "2025-05-01",
        end_date: "2025-08-31",
        description: "Built UI",
      },
    ],
    preferences: {
      desired_role: "Frontend Developer",
      desired_position: "internship",
      desired_salary: 25,
      work_mode: "hybrid",
    },
    location: "Montreal",
    ...overrides,
  };
}

describe("buildSeekerState", () => {
  it("never includes company or school names", () => {
    const json = JSON.stringify(buildSeekerState(snapshot(), { now: NOW }));

    expect(json).not.toContain("Concordia University");
    expect(json).not.toContain("Acme Inc.");
    expect(json).not.toContain("school");
    expect(json).not.toContain("company");
  });

  it("only carries the fields we meant to send (no name, email or ids)", () => {
    const state = buildSeekerState(snapshot(), { now: NOW });

    expect(Object.keys(state).sort()).toEqual(
      ["education", "experience", "location", "preferences", "skills", "total_years_of_experience"].sort(),
    );
  });

  it("includes skills, work history, education and preferences", () => {
    const state = buildSeekerState(snapshot(), { now: NOW });

    expect(state.skills).toEqual([{ name: "React", proficiency: "advanced" }]);
    expect(state.experience[0]).toMatchObject({ role: "Frontend Intern", description: "Built UI" });
    expect(state.education[0]).toMatchObject({ degree: "BEng", field_of_study: "Software Engineering" });
    expect(state.preferences).toEqual({
      desired_role: "Frontend Developer",
      desired_position: "internship",
      desired_salary: 25,
      work_mode: "hybrid",
    });
    expect(state.location).toBe("Montreal");
  });

  it("calculates years of experience in code", () => {
    const state = buildSeekerState(snapshot(), { now: NOW });

    expect(state.total_years_of_experience).toBe(0.3);
  });

  it("limits how much is sent, keeping the newest history", () => {
    const manySkills = Array.from({ length: MAX_SKILLS + 10 }, (_, i) => ({
      name: `Skill ${i}`,
      proficiency: "beginner",
    }));
    const manyRoles = Array.from({ length: MAX_EXPERIENCE + 3 }, (_, i) => ({
      company_name: "Co",
      job_role: `Role ${i}`,
      start_date: `20${10 + i}-01-01`,
      end_date: `20${10 + i}-06-01`,
      description: null,
    }));
    const manySchools = Array.from({ length: MAX_EDUCATION + 2 }, (_, i) => ({
      school: "S",
      degree: `Degree ${i}`,
      field_of_study: null,
      start_date: `20${10 + i}-09-01`,
      end_date: null,
      description: null,
    }));

    const state = buildSeekerState(
      snapshot({ skills: manySkills, experience: manyRoles, education: manySchools }),
      { now: NOW },
    );

    expect(state.skills).toHaveLength(MAX_SKILLS);
    expect(state.experience).toHaveLength(MAX_EXPERIENCE);
    expect(state.education).toHaveLength(MAX_EDUCATION);
    expect(state.experience[0].role).toBe(`Role ${MAX_EXPERIENCE + 2}`);
  });

  it("counts the whole work history in the total, even when only the newest roles are sent", () => {
    const roles = Array.from({ length: MAX_EXPERIENCE + 2 }, (_, i) => ({
      company_name: "Co",
      job_role: `Role ${i}`,
      start_date: `${2000 + i * 2}-01-01`,
      end_date: `${2000 + i * 2 + 1}-01-01`,
      description: null,
    }));

    const state = buildSeekerState(snapshot({ experience: roles }), { now: NOW });

    expect(state.experience).toHaveLength(MAX_EXPERIENCE);
    expect(state.total_years_of_experience).toBe(MAX_EXPERIENCE + 2);
  });

  it("shortens very long descriptions", () => {
    const long = "x".repeat(MAX_DESCRIPTION_LENGTH + 100);
    const state = buildSeekerState(
      snapshot({
        experience: [
          {
            company_name: "Co",
            job_role: "Dev",
            start_date: "2025-01-01",
            end_date: "2025-02-01",
            description: long,
          },
        ],
      }),
      { now: NOW },
    );

    expect(state.experience[0].description).toHaveLength(MAX_DESCRIPTION_LENGTH + 1);
    expect(state.experience[0].description?.endsWith("…")).toBe(true);
  });

  it("handles a seeker with no preferences or location", () => {
    const state = buildSeekerState(snapshot({ preferences: null, location: "  " }), { now: NOW });

    expect(state.location).toBeNull();
    expect(state.preferences).toEqual({
      desired_role: null,
      desired_position: null,
      desired_salary: null,
      work_mode: null,
    });
  });
});

describe("isProfileEmpty", () => {
  it("is true when there is nothing to match on", () => {
    expect(
      isProfileEmpty(snapshot({ skills: [], education: [], experience: [], preferences: null })),
    ).toBe(true);
  });

  it("is true when the desired role is only blanks", () => {
    expect(
      isProfileEmpty(
        snapshot({
          skills: [],
          education: [],
          experience: [],
          preferences: { desired_role: "   ", desired_position: null, desired_salary: null, work_mode: null },
        }),
      ),
    ).toBe(true);
  });

  it("is false with any skill, history, education or desired role", () => {
    expect(isProfileEmpty(snapshot({ education: [], experience: [], preferences: null }))).toBe(false);
    expect(isProfileEmpty(snapshot({ skills: [], education: [], preferences: null }))).toBe(false);
    expect(isProfileEmpty(snapshot({ skills: [], experience: [], preferences: null }))).toBe(false);
    expect(isProfileEmpty(snapshot({ skills: [], education: [], experience: [] }))).toBe(false);
  });
});
