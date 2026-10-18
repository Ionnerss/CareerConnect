import { describe, expect, it } from "vitest";
import { computeSkillMatch, parseRequiredSkills } from "./skill-match";

describe("parseRequiredSkills", () => {
  it("splits on commas, semicolons and line breaks", () => {
    expect(parseRequiredSkills("Typescript, React; SQL\nGit")).toEqual([
      "Typescript",
      "React",
      "SQL",
      "Git",
    ]);
  });

  it("trims, collapses spaces and drops blanks", () => {
    expect(parseRequiredSkills("  Node   JS ,, , React  ")).toEqual(["Node JS", "React"]);
  });

  it("drops repeats ignoring case but keeps the first spelling", () => {
    expect(parseRequiredSkills("React, react, REACT, SQL")).toEqual(["React", "SQL"]);
  });

  it.each([[null], [undefined], [""], ["   "], [" , ; "]])("returns an empty list for %j", (text) => {
    expect(parseRequiredSkills(text)).toEqual([]);
  });
});

describe("computeSkillMatch", () => {
  it("returns null when the posting requires no skills", () => {
    expect(computeSkillMatch([], ["React"])).toBeNull();
  });

  it("scores a full match as 100", () => {
    expect(computeSkillMatch(["React", "SQL"], ["SQL", "React", "Docker"])).toEqual({
      percent: 100,
      matched: ["React", "SQL"],
      missing: [],
    });
  });

  it("reports matched and missing skills and rounds the percentage", () => {
    expect(computeSkillMatch(["Typescript", "React", "SQL"], ["React"])).toEqual({
      percent: 33,
      matched: ["React"],
      missing: ["Typescript", "SQL"],
    });
  });

  it("ignores case and extra spaces when comparing", () => {
    expect(computeSkillMatch(["TypeScript", "Node JS"], ["  typescript ", "node   js"])).toEqual({
      percent: 100,
      matched: ["TypeScript", "Node JS"],
      missing: [],
    });
  });

  it("scores 0 when the applicant lists no skills", () => {
    expect(computeSkillMatch(["React"], [])).toEqual({
      percent: 0,
      matched: [],
      missing: ["React"],
    });
  });

  it("does not treat a different skill with a similar name as a match", () => {
    expect(computeSkillMatch(["React"], ["React Native"])?.percent).toBe(0);
  });
});
