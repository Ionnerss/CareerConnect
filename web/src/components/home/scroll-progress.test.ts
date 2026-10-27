import { describe, expect, it } from "vitest";
import {
  clamp01,
  countRevealedWords,
  getScrollProgress,
} from "./scroll-progress";

describe("clamp01", () => {
  it("keeps values inside 0 to 1", () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(9)).toBe(1);
  });

  it("treats NaN as 0", () => {
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

describe("getScrollProgress", () => {
  const viewport = 1000;

  it("is 0 when the top edge is at the start line", () => {
    expect(getScrollProgress({ top: 850, height: 200 }, viewport)).toBe(0);
  });

  it("is 0 while the element is still below the start line", () => {
    expect(getScrollProgress({ top: 1400, height: 200 }, viewport)).toBe(0);
  });

  it("is 1 when the bottom edge reaches the end line", () => {
    // bottom = top + height = 350
    expect(getScrollProgress({ top: 150, height: 200 }, viewport)).toBe(1);
  });

  it("stays at 1 once the element has scrolled past", () => {
    expect(getScrollProgress({ top: -500, height: 200 }, viewport)).toBe(1);
  });

  it("increases steadily in between", () => {
    const early = getScrollProgress({ top: 700, height: 200 }, viewport);
    const late = getScrollProgress({ top: 400, height: 200 }, viewport);

    expect(early).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(early);
    expect(late).toBeLessThan(1);
  });

  it("does not divide by zero for an empty viewport", () => {
    expect(getScrollProgress({ top: 0, height: 0 }, 0)).toBe(1);
  });
});

describe("countRevealedWords", () => {
  it("reveals none at 0 and all at 1", () => {
    expect(countRevealedWords(0, 40)).toBe(0);
    expect(countRevealedWords(1, 40)).toBe(40);
  });

  it("rounds to a whole number of words", () => {
    expect(countRevealedWords(0.5, 41)).toBe(21);
  });

  it("never goes outside the word count", () => {
    expect(countRevealedWords(-1, 10)).toBe(0);
    expect(countRevealedWords(4, 10)).toBe(10);
  });
});
