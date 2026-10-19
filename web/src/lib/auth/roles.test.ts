import { describe, expect, it } from "vitest";
import {
  getAudienceRedirect,
  getHomePathForRole,
  normalizeRole,
  parseLoginRole,
} from "./roles";

describe("parseLoginRole", () => {
  it("reads the recruiter choice from the URL", () => {
    expect(parseLoginRole("recruiter")).toBe("recruiter");
    expect(parseLoginRole(["recruiter", "job_seeker"])).toBe("recruiter");
  });

  it("treats anything else as job seeker", () => {
    expect(parseLoginRole(undefined)).toBe("job_seeker");
    expect(parseLoginRole(null)).toBe("job_seeker");
    expect(parseLoginRole("admin")).toBe("job_seeker");
    expect(parseLoginRole("")).toBe("job_seeker");
  });
});

describe("normalizeRole and getHomePathForRole", () => {
  it("sends recruiters to their postings and everyone else to the dashboard", () => {
    expect(getHomePathForRole("recruiter")).toBe("/recruiter/jobs");
    expect(getHomePathForRole("job_seeker")).toBe("/dashboard");
    expect(getHomePathForRole(null)).toBe("/dashboard");
    expect(getHomePathForRole("something-new")).toBe("/dashboard");
  });

  it("normalizes unknown roles to job seeker", () => {
    expect(normalizeRole("recruiter")).toBe("recruiter");
    expect(normalizeRole(undefined)).toBe("job_seeker");
  });
});

describe("getAudienceRedirect", () => {
  it("lets people stay on pages made for their kind of account", () => {
    expect(getAudienceRedirect("job_seeker", "job_seeker")).toBeNull();
    expect(getAudienceRedirect("recruiter", "recruiter")).toBeNull();
  });

  it("sends recruiters away from job seeker pages, to their postings", () => {
    expect(getAudienceRedirect("recruiter", "job_seeker")).toBe(
      "/recruiter/jobs",
    );
  });

  it("sends job seekers away from recruiter pages, to their dashboard", () => {
    expect(getAudienceRedirect("job_seeker", "recruiter")).toBe("/dashboard");
  });
});
