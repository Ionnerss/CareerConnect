/**
 * Small pure helpers for the homepage scroll effects, kept separate from the
 * components so they can be tested without a browser.
 */

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * How far an element has travelled through the viewport, from 0 to 1.
 *
 * - 0 when the element's top edge is at `start` (a fraction of the viewport
 *   height measured from the top, 0.85 by default).
 * - 1 when the element's bottom edge reaches `end` (0.35 by default).
 */
export function getScrollProgress(
  rect: { top: number; height: number },
  viewportHeight: number,
  start = 0.85,
  end = 0.35,
): number {
  const startY = viewportHeight * start;
  const endY = viewportHeight * end;
  const distance = startY - endY + rect.height;

  if (distance <= 0) return 1;

  return clamp01((startY - rect.top) / distance);
}

/** How many of `wordCount` words should be highlighted at this progress. */
export function countRevealedWords(progress: number, wordCount: number): number {
  return Math.round(clamp01(progress) * wordCount);
}
