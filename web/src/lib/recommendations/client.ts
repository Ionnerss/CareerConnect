/**
 * Shared display labels for recommendation scores.
 *
 * Saved reads and refresh requests are handled by refresh-client.ts.
 */
export function matchLabel(score: number): string {
  if (score >= 80) return "Strong match";
  if (score >= 60) return "Good match";
  return "Possible match";
}