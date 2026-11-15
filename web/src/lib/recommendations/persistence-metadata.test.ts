import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobForMatching } from "./job-shortlist";
import type { SeekerState } from "./seeker-state";
import {
  getRecommendationVersions,
  hashJobRatingInput,
  hashRecommendationInput,
  hashSeekerInput,
} from "./persistence-metadata";
import { DEFAULT_SUMMARY_MODEL } from "./summaries";
import { JEV_MODEL } from "@/lib/ai/jev";

const seeker = {
  location: "Montréal",
  preferences: {
    desired_role: "Backend Developer",
    desired_position: "internship",
    desired_salary: null,
    work_mode: "hybrid",
  },
} as SeekerState;

const job: JobForMatching = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Backend Developer Intern",
  firm_name: "Example Company",
  location: "Montréal",
  work_mode: "Hybrid",
  employment_type: "Internship",
  required_skills: "Java, SQL",
  salary: 50000,
  experience: 1,
  description: "Build backend services.",
  status: "open",
  created_at: "2026-11-12T10:00:00Z",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("recommendation persistence metadata", () => {
  it("hashes the same data consistently regardless of object key order", () => {
    expect(hashRecommendationInput({ a: 1, b: { x: 2, y: 3 } })).toBe(
      hashRecommendationInput({ b: { y: 3, x: 2 }, a: 1 }),
    );
  });

  it("changes the seeker hash when matching information changes", () => {
    expect(hashSeekerInput(seeker)).toBe(hashSeekerInput({ ...seeker }));

    expect(
      hashSeekerInput({
        ...seeker,
        preferences: {
          ...seeker.preferences,
          desired_role: "Frontend Developer",
        },
      }),
    ).not.toBe(hashSeekerInput(seeker));
  });

  it("changes the job rating hash when Jev's job input changes", () => {
    expect(hashJobRatingInput(job)).toBe(hashJobRatingInput({ ...job }));

    expect(
      hashJobRatingInput({ ...job, required_skills: "Python, SQL" }),
    ).not.toBe(hashJobRatingInput(job));
  });

  it("ignores job fields that are not sent to Jev", () => {
    expect(
      hashJobRatingInput({
        ...job,
        created_at: "2026-11-13T10:00:00Z",
        salary: 90000,
        firm_name: "Renamed Company",
      }),
    ).toBe(hashJobRatingInput(job));
  });

  it("records the configured models and version identifiers", () => {
    vi.stubEnv("RECOMMENDATION_SUMMARY_MODEL", "");
    const defaults = getRecommendationVersions();

    expect(defaults.jev_model_version).toBe(JEV_MODEL);
    expect(defaults.summary_model_version).toBe(DEFAULT_SUMMARY_MODEL);
    expect(defaults.scoring_version).toBeTruthy();
    expect(defaults.jev_prompt_version).toMatch(/^[0-9a-f]{64}$/);
    expect(defaults.summary_prompt_version).toMatch(/^[0-9a-f]{64}$/);

    vi.stubEnv("RECOMMENDATION_SUMMARY_MODEL", "custom/model");
    expect(getRecommendationVersions().summary_model_version).toBe(
      "custom/model",
    );
  });
});