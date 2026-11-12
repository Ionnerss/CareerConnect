import { describe, expect, it, vi } from "vitest";
import { JevError, type JevScoreAnswer } from "@/lib/ai/jev";
import {
  FIT_QUESTIONS,
  FIT_QUESTION_KEYS,
  MAX_JOB_DESCRIPTION_LENGTH,
  buildJobState,
  computeFit,
  rateJob,
  rateJobs,
  type AskJev,
} from "./job-fit";
import type { JobForMatching, ShortlistedJob } from "./job-shortlist";
import type { SeekerState } from "./seeker-state";

const seeker: SeekerState = {
  skills: [{ name: "React", proficiency: "advanced" }],
  education: [],
  experience: [],
  total_years_of_experience: 1.5,
  location: "Montreal",
  preferences: { desired_role: "Frontend Developer", desired_position: null, desired_salary: null, work_mode: "remote" },
};

function job(overrides: Partial<JobForMatching> = {}): JobForMatching {
  return {
    id: "job-1",
    title: "Frontend Developer",
    firm_name: "Globex Corporation",
    location: "Montreal",
    work_mode: "Remote",
    employment_type: "Full-time",
    required_skills: "React, TypeScript",
    salary: 90000,
    experience: 2,
    description: "Build UIs.",
    status: "open",
    created_at: "2026-11-01T00:00:00Z",
    ...overrides,
  };
}

function shortlisted(id: string, overrides: Partial<JobForMatching> = {}): ShortlistedJob {
  return { job: job({ id, ...overrides }), score: 70, skill_match: null, reasons: ["reason"] };
}

const answer = (score: number, confidence = 0.9): JevScoreAnswer => ({ score, confidence });

describe("computeFit", () => {
  it("scores 100 when every question gets the top level", () => {
    const fit = computeFit({ skills: answer(3), level: answer(3), interest: answer(3) });

    expect(fit.score).toBe(100);
    expect(fit.lowConfidence).toBe(false);
  });

  it("scores 0 when every question gets the bottom level", () => {
    expect(computeFit({ skills: answer(0), level: answer(0), interest: answer(0) }).score).toBe(0);
  });

  it("counts skills 3, interest 2 and level 1", () => {
    expect(computeFit({ skills: answer(3), level: answer(0), interest: answer(0) }).score).toBe(50);
    expect(computeFit({ skills: answer(0), level: answer(0), interest: answer(3) }).score).toBe(33);
    expect(computeFit({ skills: answer(0), level: answer(3), interest: answer(0) }).score).toBe(17);
  });

  it("keeps out-of-range answers inside the valid range", () => {
    const fit = computeFit({ skills: answer(9, 5), level: answer(-2, -1), interest: answer(3) });

    expect(fit.levels).toEqual({ skills: 3, level: 0, interest: 3 });
    expect(fit.minConfidence).toBe(0);
  });

  it("flags low confidence below 0.5 but not at 0.5", () => {
    expect(computeFit({ skills: answer(2, 0.49), level: answer(2), interest: answer(2) }).lowConfidence).toBe(true);
    expect(computeFit({ skills: answer(2, 0.5), level: answer(2), interest: answer(2) }).lowConfidence).toBe(false);
  });

  it("treats a missing answer as level 0 with no confidence, so it is flagged", () => {
    const fit = computeFit({ skills: answer(3), interest: answer(3) });

    expect(fit.levels.level).toBe(0);
    expect(fit.minConfidence).toBe(0);
    expect(fit.lowConfidence).toBe(true);
    expect(fit.score).toBeLessThan(100);
  });
});

describe("buildJobState", () => {
  it("sends the posting details but never the company, salary, id or recruiter", () => {
    const state = buildJobState(job());
    const json = JSON.stringify(state);

    expect(state).toEqual({
      title: "Frontend Developer",
      location: "Montreal",
      work_mode: "Remote",
      employment_type: "Full-time",
      years_of_experience_asked: 2,
      required_skills: ["React", "TypeScript"],
      description: "Build UIs.",
    });
    expect(json).not.toContain("Globex");
    expect(json).not.toContain("90000");
    expect(json).not.toContain("job-1");
  });

  it("shortens long descriptions and turns blank ones into null", () => {
    const long = buildJobState(job({ description: "x".repeat(MAX_JOB_DESCRIPTION_LENGTH + 50) }));

    expect(long.description).toHaveLength(MAX_JOB_DESCRIPTION_LENGTH + 1);
    expect(buildJobState(job({ description: "   " })).description).toBeNull();
    expect(buildJobState(job({ description: null })).description).toBeNull();
  });
});

describe("rateJob", () => {
  it("asks Jev the three fit questions about the seeker and one posting", async () => {
    const ask = vi.fn<AskJev>().mockResolvedValue({
      skills: answer(3),
      level: answer(2),
      interest: answer(3),
    });

    const fit = await rateJob(seeker, job(), ask);

    expect(ask).toHaveBeenCalledTimes(1);
    const [state, questions] = ask.mock.calls[0];
    expect(Object.keys(questions)).toEqual([...FIT_QUESTION_KEYS]);
    expect(questions).toBe(FIT_QUESTIONS);
    expect(state).toEqual({ seeker, job: buildJobState(job()) });
    expect(fit.levels).toEqual({ skills: 3, level: 2, interest: 3 });
  });

  it("gives each question four ordered levels", () => {
    for (const key of FIT_QUESTION_KEYS) {
      expect(FIT_QUESTIONS[key].type).toBe("score");
      expect(FIT_QUESTIONS[key].criteria).toHaveLength(4);
    }
  });
});

describe("rateJobs", () => {
  const good: Record<string, JevScoreAnswer> = { skills: answer(3), level: answer(3), interest: answer(3) };

  it("rates every posting and keeps the shortlist order", async () => {
    const ask = vi.fn<AskJev>().mockResolvedValue(good);
    const list = [shortlisted("a"), shortlisted("b"), shortlisted("c")];

    const rated = await rateJobs(seeker, list, { ask });

    expect(rated.map((item) => item.job.id)).toEqual(["a", "b", "c"]);
    expect(rated.every((item) => item.fit?.score === 100 && item.fit_error === null)).toBe(true);
    expect(ask).toHaveBeenCalledTimes(3);
  });

  it("keeps a posting with no AI rating when its call fails, and rates the others", async () => {
    const ask = vi
      .fn<AskJev>()
      .mockResolvedValueOnce(good)
      .mockRejectedValueOnce(new JevError("http_error", "Jev returned HTTP 500.", 500))
      .mockRejectedValueOnce(new Error("boom"));

    const rated = await rateJobs(seeker, [shortlisted("a"), shortlisted("b"), shortlisted("c")], {
      ask,
      concurrency: 1,
    });

    expect(rated[0].fit?.score).toBe(100);
    expect(rated[1]).toMatchObject({ fit: null, fit_error: "http_error", score: 70 });
    expect(rated[2]).toMatchObject({ fit: null, fit_error: "unexpected", score: 70 });
  });

  it("throws when the server has no Jev key, instead of hiding it posting by posting", async () => {
    const ask = vi.fn<AskJev>().mockRejectedValue(new JevError("missing_key", "AI_GATEWAY_API_KEY is not set on the server."));

    await expect(rateJobs(seeker, [shortlisted("a")], { ask })).rejects.toMatchObject({ code: "missing_key" });
  });

  it("does not exceed the concurrency limit", async () => {
    let running = 0;
    let peak = 0;
    const ask = vi.fn<AskJev>().mockImplementation(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return good;
    });

    await rateJobs(seeker, Array.from({ length: 8 }, (_, i) => shortlisted(`job-${i}`)), {
      ask,
      concurrency: 2,
    });

    expect(peak).toBeLessThanOrEqual(2);
    expect(ask).toHaveBeenCalledTimes(8);
  });

  it("returns an empty list for an empty shortlist", async () => {
    const ask = vi.fn<AskJev>();

    expect(await rateJobs(seeker, [], { ask })).toEqual([]);
    expect(ask).not.toHaveBeenCalled();
  });
});
