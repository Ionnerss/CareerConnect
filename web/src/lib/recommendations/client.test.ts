import { describe, expect, it } from "vitest";
import { matchLabel } from "./client";

describe("matchLabel", () => {
  it.each([
    [100, "Strong match"],
    [80, "Strong match"],
    [79, "Good match"],
    [60, "Good match"],
    [59, "Possible match"],
    [0, "Possible match"],
  ])("labels %i as %s", (score, label) => {
    expect(matchLabel(score)).toBe(label);
  });
});