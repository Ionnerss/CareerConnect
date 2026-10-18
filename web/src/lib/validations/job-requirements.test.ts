import { describe, expect, it } from "vitest";
import {
  MAX_REQUIREMENTS,
  MAX_REQUIREMENT_TEXT_LENGTH,
  requirementInputSchema,
  requirementsInputSchema,
} from "./job-requirements";

describe("requirementInputSchema", () => {
  it("accepts a complete requirement", () => {
    expect(
      requirementInputSchema.parse({ text: "2+ years of React", kind: "core", weight: 3 }),
    ).toEqual({ text: "2+ years of React", kind: "core", weight: 3 });
  });

  it("applies the table defaults: core and weight 1", () => {
    expect(requirementInputSchema.parse({ text: "SQL" })).toEqual({
      text: "SQL",
      kind: "core",
      weight: 1,
    });
  });

  it("trims and collapses spaces in the text", () => {
    expect(requirementInputSchema.parse({ text: "  Node   JS \n experience " }).text).toBe(
      "Node JS experience",
    );
  });

  it("accepts a weight sent as a string, as a form would", () => {
    expect(requirementInputSchema.parse({ text: "Git", weight: "4" }).weight).toBe(4);
  });

  it.each([[""], ["   "]])("rejects empty text %j", (text) => {
    expect(requirementInputSchema.safeParse({ text }).success).toBe(false);
  });

  it("rejects text over the length limit and accepts exactly the limit", () => {
    expect(
      requirementInputSchema.safeParse({ text: "a".repeat(MAX_REQUIREMENT_TEXT_LENGTH + 1) })
        .success,
    ).toBe(false);
    expect(
      requirementInputSchema.safeParse({ text: "a".repeat(MAX_REQUIREMENT_TEXT_LENGTH) }).success,
    ).toBe(true);
  });

  it("rejects an unknown kind", () => {
    expect(requirementInputSchema.safeParse({ text: "X", kind: "optional" }).success).toBe(false);
  });

  it.each([0, 11, 2.5, -1, "abc"])("rejects weight %j", (weight) => {
    expect(requirementInputSchema.safeParse({ text: "X", weight }).success).toBe(false);
  });

  it.each([1, 10])("accepts the boundary weight %i", (weight) => {
    expect(requirementInputSchema.safeParse({ text: "X", weight }).success).toBe(true);
  });
});

describe("requirementsInputSchema", () => {
  it("requires at least one requirement", () => {
    expect(requirementsInputSchema.safeParse([]).success).toBe(false);
  });

  it("allows up to the maximum number and rejects more", () => {
    const make = (count: number) => Array.from({ length: count }, (_, i) => ({ text: `Skill ${i}` }));
    expect(requirementsInputSchema.safeParse(make(MAX_REQUIREMENTS)).success).toBe(true);
    expect(requirementsInputSchema.safeParse(make(MAX_REQUIREMENTS + 1)).success).toBe(false);
  });
});
