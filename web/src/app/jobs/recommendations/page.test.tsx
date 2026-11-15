// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import RecommendedJobsPage, { metadata } from "./page";

vi.mock("@/components/recommendations/recommendations-panel", () => ({
  default: () => <div data-testid="panel" />,
}));

afterEach(cleanup);

describe("/jobs/recommendations page", () => {
  it("renders the heading and the recommendations panel", () => {
    render(<RecommendedJobsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Recommended for you" })).toBeTruthy();
    expect(screen.getByTestId("panel")).toBeTruthy();
    expect(screen.getByRole("region", { name: /job recommendations/i })).toBeTruthy();
  });

  it("sets a page title", () => {
    expect(metadata.title).toBe("Recommended jobs");
  });
});
