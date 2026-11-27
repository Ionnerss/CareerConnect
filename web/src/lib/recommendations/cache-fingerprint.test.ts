import { describe, expect, it } from "vitest";
import { createRecommendationFingerprint } from "./cache-fingerprint";
import {
  getRecommendationVersions,
  type RecommendationVersions,
} from "./persistence-metadata";
import type { RecommendationInputsResponse } from "./recommendation-inputs";
import { buildSeekerState } from "./seeker-state";
import { shortlistJobs } from "./job-shortlist";

type ValidInputs = Extract<
  RecommendationInputsResponse,
  { success: true }
>;

function makeInputs(): ValidInputs {
  const snapshot = {
    skills: [{ name: "Java", proficiency: "Advanced" }],
    education: [],
    experience: [],
    preferences: null,
    location: "Montreal",
  };

  const jobs = [
    {
      id: "f5100000-0000-4000-8000-000000000001",
      title: "Java Developer",
      firm_name: "Test Company A",
      location: "Montreal",
      work_mode: "Remote",
      employment_type: "Full-time",
      required_skills: "Java",
      salary: 60000,
      experience: null,
      description: "Build Java services.",
      status: "open",
      created_at: "2026-11-01T00:00:00Z",
    },
    {
      id: "f5100000-0000-4000-8000-000000000002",
      title: "Backend Developer",
      firm_name: "Test Company B",
      location: "Montreal",
      work_mode: "Hybrid",
      employment_type: "Full-time",
      required_skills: "Java, SQL",
      salary: 65000,
      experience: 1,
      description: "Build backend applications.",
      status: "open",
      created_at: "2026-11-02T00:00:00Z",
    },
  ];

  const now = new Date("2026-11-01T12:00:00Z");

  return {
    success: true,
    user_id: "f5200000-0000-4000-8000-000000000001",
    empty_profile: false,
    considered_jobs: jobs.length,
    seeker_state: buildSeekerState(snapshot, { now }),
    shortlist: shortlistJobs(snapshot, jobs, { now }),
  };
}

describe("createRecommendationFingerprint", () => {
  it("produces the same SHA-256 fingerprint for identical inputs", () => {
    const versions = getRecommendationVersions();

    const first = createRecommendationFingerprint(
      makeInputs(),
      {},
      versions,
    );

    const second = createRecommendationFingerprint(
      makeInputs(),
      {},
      versions,
    );

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toBe(first);
  });

  it("scopes fingerprints to the owner", () => {
    const first = makeInputs();
    const second = makeInputs();

    second.user_id = "f5200000-0000-4000-8000-000000000002";

    expect(createRecommendationFingerprint(second)).not.toBe(
      createRecommendationFingerprint(first),
    );
  });

  it("changes when normalized seeker inputs change", () => {
    const first = makeInputs();
    const second = makeInputs();

    second.seeker_state.location = "Toronto";

    expect(createRecommendationFingerprint(second)).not.toBe(
      createRecommendationFingerprint(first),
    );
  });

  it("changes when posting contents change", () => {
    const first = makeInputs();
    const second = makeInputs();

    second.shortlist[0].job.description =
      "Updated responsibilities and requirements.";

    expect(createRecommendationFingerprint(second)).not.toBe(
      createRecommendationFingerprint(first),
    );
  });

  it("changes when the candidate set changes", () => {
    const first = makeInputs();
    const second = makeInputs();

    second.shortlist = second.shortlist.slice(0, 1);

    expect(createRecommendationFingerprint(second)).not.toBe(
      createRecommendationFingerprint(first),
    );
  });

  it("changes when shortlist order changes", () => {
    const first = makeInputs();
    const second = makeInputs();

    second.shortlist.reverse();

    expect(createRecommendationFingerprint(second)).not.toBe(
      createRecommendationFingerprint(first),
    );
  });

  it("changes when code scores or reasons change", () => {
    const first = makeInputs();
    const changedScore = makeInputs();
    const changedReasons = makeInputs();

    changedScore.shortlist[0].score += 1;
    changedReasons.shortlist[0].reasons.push(
      "An additional confirmed match.",
    );

    const baseline = createRecommendationFingerprint(first);

    expect(createRecommendationFingerprint(changedScore)).not.toBe(
      baseline,
    );

    expect(createRecommendationFingerprint(changedReasons)).not.toBe(
      baseline,
    );
  });

  it.each([
    "scoring_version",
    "jev_model_version",
    "jev_prompt_version",
    "summary_model_version",
    "summary_prompt_version",
  ] as const)(
    "changes when %s changes",
    (field: keyof RecommendationVersions) => {
      const inputs = makeInputs();
      const versions = getRecommendationVersions();
      const changed = {
        ...versions,
        [field]: `${versions[field]}-changed`,
      };

      expect(
        createRecommendationFingerprint(inputs, {}, changed),
      ).not.toBe(
        createRecommendationFingerprint(inputs, {}, versions),
      );
    },
  );

  it("changes when the effective summary count changes", () => {
    const inputs = makeInputs();

    expect(
      createRecommendationFingerprint(inputs, {
        summaryCount: 0,
      }),
    ).not.toBe(
      createRecommendationFingerprint(inputs, {
        summaryCount: 1,
      }),
    );
  });

  it("treats counts above the shortlist size as equivalent", () => {
    const inputs = makeInputs();

    expect(
      createRecommendationFingerprint(inputs, {
        summaryCount: 10,
      }),
    ).toBe(
      createRecommendationFingerprint(inputs, {
        summaryCount: 20,
      }),
    );
  });

  it("handles a successful empty profile deterministically", () => {
    const inputs = makeInputs();

    inputs.empty_profile = true;
    inputs.considered_jobs = 0;
    inputs.shortlist = [];

    const first = createRecommendationFingerprint(inputs, {
      summaryCount: 0,
    });

    const second = createRecommendationFingerprint(inputs, {
      summaryCount: 5,
    });

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toBe(first);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid summary count %s",
    (summaryCount) => {
      expect(() =>
        createRecommendationFingerprint(makeInputs(), {
          summaryCount,
        }),
      ).toThrow("Summary count must be a nonnegative safe integer");
    },
  );
});