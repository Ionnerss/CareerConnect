// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApplicantFilters from "./applicant-filters";

const applicants = [
  {
    application_id: "late-nov-10",
    full_name: "Alex",
    status: "Interview",
    // Nov 11 in UTC, but Nov 10 in Toronto.
    applied_at: "2026-11-11T00:30:00Z",
    skill_match: null,
  },
  {
    application_id: "early-nov-11",
    full_name: "Sam",
    status: "Interview",
    // Nov 11 in both UTC and Toronto.
    applied_at: "2026-11-11T05:30:00Z",
    skill_match: null,
  },
];

function visibleIds(): string[] {
  const list = screen.getByRole("list", { name: "Filtered applicant IDs" });

  return within(list)
    .queryAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

describe("ApplicantFilters date filtering", () => {
  beforeEach(() => {
    vi.stubEnv("TZ", "America/Toronto");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("filters by the applicant's local calendar date near UTC midnight", async () => {
    const user = userEvent.setup();

    render(
      <ApplicantFilters applicants={applicants}>
        {(filtered) => (
          <ul aria-label="Filtered applicant IDs">
            {filtered.map((applicant) => (
              <li key={applicant.application_id}>
                {applicant.application_id}
              </li>
            ))}
          </ul>
        )}
      </ApplicantFilters>,
    );

    await user.click(screen.getByRole("button", { name: /Advanced filters/i }));

    const dateFrom = screen.getByLabelText("Applied from");

    fireEvent.change(dateFrom, { target: { value: "2026-11-10" } });
    expect(visibleIds()).toEqual(["early-nov-11", "late-nov-10"]);

    const dateTo = screen.getByLabelText("Applied until");
    fireEvent.change(dateTo, { target: { value: "2026-11-10" } });
    expect(visibleIds()).toEqual(["late-nov-10"]);

    fireEvent.change(dateTo, { target: { value: "" } });
    fireEvent.change(dateFrom, { target: { value: "2026-11-11" } });
    fireEvent.change(dateTo, { target: { value: "2026-11-11" } });
    expect(visibleIds()).toEqual(["early-nov-11"]);

    fireEvent.change(dateFrom, { target: { value: "2026-11-11" } });
    fireEvent.change(dateTo, { target: { value: "2026-11-11" } });
    expect(visibleIds()).toEqual(["early-nov-11"]);
  });
});