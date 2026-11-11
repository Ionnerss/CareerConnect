import { describe, expect, it } from "vitest";
import { DEFAULT_SHORTLIST_SIZE, scoreJob, shortlistJobs, type JobForMatching } from "./job-shortlist";
import type { SeekerSnapshot } from "./seeker-state";

const NOW = new Date("2026-11-11T12:00:00Z");

const seeker: SeekerSnapshot = {
  skills: [
    { name: "React", proficiency: "advanced" },
    { name: "TypeScript", proficiency: "intermediate" },
    { name: "HTML", proficiency: "advanced" },
  ],
  education: [],
  experience: [
    {
      company_name: "Acme",
      job_role: "Frontend Intern",
      start_date: "2025-01-01",
      end_date: "2026-01-01",
      description: null,
    },
  ],
  preferences: {
    desired_role: "Frontend Developer",
    desired_position: "full_time",
    desired_salary: null,
    work_mode: "remote",
  },
  location: "Montreal",
};

function job(overrides: Partial<JobForMatching> = {}): JobForMatching {
  return {
    id: "job-1",
    title: "Frontend Developer",
    firm_name: "Globex",
    location: "Montreal, QC",
    work_mode: "Remote",
    employment_type: "Full-time",
    required_skills: "React, TypeScript, HTML",
    salary: null,
    experience: 1,
    description: null,
    status: "open",
    created_at: "2026-11-01T00:00:00Z",
    ...overrides,
  };
}

describe("scoreJob", () => {
  it("gives a perfect match 100", () => {
    const result = scoreJob(seeker, job(), NOW);

    expect(result.score).toBe(100);
    expect(result.skill_match?.percent).toBe(100);
    expect(result.reasons).toContain("You list 3 of 3 required skills");
    expect(result.reasons).toContain("The title fits the role you are looking for");
    expect(result.reasons).toContain("It is remote, as you prefer");
    expect(result.reasons).toContain("It is full-time, as you prefer");
  });

  it("scores skills by how many required skills the seeker lists, ignoring case", () => {
    const half = scoreJob(seeker, job({ required_skills: "react, Java" }), NOW);
    const none = scoreJob(seeker, job({ required_skills: "Java, C++" }), NOW);

    expect(half.skill_match).toEqual({ percent: 50, matched: ["react"], missing: ["Java"] });
    expect(none.skill_match?.percent).toBe(0);
    expect(none.reasons).toContain("None of the required skills are on your profile yet");
    expect(half.score).toBeGreaterThan(none.score);
  });

  it("does not punish a posting that lists no required skills", () => {
    const result = scoreJob(seeker, job({ required_skills: null }), NOW);

    expect(result.skill_match).toBeNull();
    expect(result.score).toBeGreaterThan(50);
  });

  it("rewards a title that fits the desired role, or the most recent role", () => {
    const fits = scoreJob(seeker, job({ title: "Junior Frontend Developer" }), NOW);
    const nurse = scoreJob(seeker, job({ title: "Registered Nurse" }), NOW);
    const recent = scoreJob(
      { ...seeker, preferences: null },
      job({ title: "Frontend Intern" }),
      NOW,
    );

    expect(fits.score).toBeGreaterThan(nurse.score);
    expect(recent.reasons).toContain("The title fits the role you are looking for");
  });

  it("prefers the work mode the seeker asked for", () => {
    const remote = scoreJob(seeker, job({ work_mode: "Remote" }), NOW);
    const onSite = scoreJob(seeker, job({ work_mode: "On-site", location: "Toronto" }), NOW);

    expect(remote.score).toBeGreaterThan(onSite.score);
  });

  it("treats no preference as neutral for any work mode", () => {
    const noPref = { ...seeker, preferences: { ...seeker.preferences!, work_mode: "no_preference" as const } };

    expect(scoreJob(noPref, job({ work_mode: "Remote" }), NOW).score).toBe(
      scoreJob(noPref, job({ work_mode: "Hybrid", location: "Montreal" }), NOW).score,
    );
  });

  it("compares experience required with the seeker's years", () => {
    const enough = scoreJob(seeker, job({ experience: 1 }), NOW);
    const tooMuch = scoreJob(seeker, job({ experience: 10 }), NOW);
    const none = scoreJob(seeker, job({ experience: null }), NOW);

    expect(enough.reasons).toContain("You have the 1+ years of experience it asks for");
    expect(tooMuch.reasons).toContain("It asks for 10+ years; you have 1");
    expect(tooMuch.score).toBeLessThan(enough.score);
    expect(none.score).toBe(enough.score);
  });

  it("matches location in either direction, and lets remote jobs fit anywhere", () => {
    const local = scoreJob(seeker, job({ work_mode: "Hybrid", location: "Montreal, QC" }), NOW);
    const far = scoreJob(seeker, job({ work_mode: "Hybrid", location: "Vancouver" }), NOW);
    const remoteFar = scoreJob(seeker, job({ work_mode: "Remote", location: "Vancouver" }), NOW);

    expect(local.reasons).toContain("It is in your area");
    expect(local.score).toBeGreaterThan(far.score);
    expect(remoteFar.score).toBeGreaterThanOrEqual(far.score);
  });

  it("always stays between 0 and 100", () => {
    const worst = scoreJob(
      { ...seeker, skills: [], preferences: { desired_role: "Chef", desired_position: "internship", desired_salary: null, work_mode: "on_site" } },
      job({ title: "Welder", required_skills: "Welding", work_mode: "Remote", experience: 20, employment_type: "Contract", location: "Far away" }),
      NOW,
    );

    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
  });
});

describe("shortlistJobs", () => {
  it("ranks the best match first", () => {
    const result = shortlistJobs(
      seeker,
      [
        job({ id: "weak", title: "Welder", required_skills: "Welding", work_mode: "On-site", location: "Elsewhere" }),
        job({ id: "best" }),
        job({ id: "ok", required_skills: "React, Java" }),
      ],
      { now: NOW },
    );

    expect(result.map((item) => item.job.id)).toEqual(["best", "ok", "weak"]);
  });

  it("leaves out closed postings and postings the seeker already applied to", () => {
    const result = shortlistJobs(
      seeker,
      [
        job({ id: "closed", status: "closed" }),
        job({ id: "applied" }),
        job({ id: "fresh" }),
        job({ id: "no-status", status: null }),
      ],
      { appliedJobIds: ["applied"], now: NOW },
    );

    expect(result.map((item) => item.job.id)).toEqual(["fresh"]);
  });

  it("accepts a status written in any case", () => {
    const result = shortlistJobs(seeker, [job({ id: "a", status: "Open" })], { now: NOW });

    expect(result).toHaveLength(1);
  });

  it("keeps only the requested number, 10 by default", () => {
    const jobs = Array.from({ length: 15 }, (_, i) => job({ id: `job-${i}` }));

    expect(shortlistJobs(seeker, jobs, { now: NOW })).toHaveLength(DEFAULT_SHORTLIST_SIZE);
    expect(shortlistJobs(seeker, jobs, { limit: 3, now: NOW })).toHaveLength(3);
    expect(shortlistJobs(seeker, jobs, { limit: 0, now: NOW })).toEqual([]);
  });

  it("breaks ties by newest posting, then id, so the order never changes", () => {
    const jobs = [
      job({ id: "b", created_at: "2026-11-01T00:00:00Z" }),
      job({ id: "a", created_at: "2026-11-01T00:00:00Z" }),
      job({ id: "newest", created_at: "2026-11-05T00:00:00Z" }),
    ];

    const first = shortlistJobs(seeker, jobs, { now: NOW }).map((item) => item.job.id);
    const second = shortlistJobs(seeker, [...jobs].reverse(), { now: NOW }).map((item) => item.job.id);

    expect(first).toEqual(["newest", "a", "b"]);
    expect(second).toEqual(first);
  });

  it("ignores duplicate postings", () => {
    const result = shortlistJobs(seeker, [job({ id: "same" }), job({ id: "same" })], { now: NOW });

    expect(result).toHaveLength(1);
  });

  it("returns an empty list when there are no postings", () => {
    expect(shortlistJobs(seeker, [], { now: NOW })).toEqual([]);
  });
});
