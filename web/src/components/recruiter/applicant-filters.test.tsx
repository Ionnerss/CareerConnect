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

describe("ApplicantFilters status, search and sort", () => {
  const people = [
    { application_id: "ana", full_name: "Ana Diaz", status: "In Progress", applied_at: "2026-11-01T15:00:00Z", skill_match: { percent: 40 } },
    { application_id: "ben", full_name: "Ben Ross", status: "Interview", applied_at: "2026-11-03T15:00:00Z", skill_match: { percent: 90 } },
    { application_id: "cleo", full_name: "Cleo Park", status: "Accepted", applied_at: "2026-11-02T15:00:00Z", skill_match: null },
    { application_id: "dan", full_name: null, status: "Rejected", applied_at: "2026-11-04T15:00:00Z", skill_match: { percent: 70 } },
  ];

  function renderFilters() {
    render(
      <ApplicantFilters applicants={people}>
        {(filtered) => (
          <ul aria-label="Filtered applicant IDs">
            {filtered.map((applicant) => (
              <li key={applicant.application_id}>{applicant.application_id}</li>
            ))}
          </ul>
        )}
      </ApplicantFilters>,
    );
  }

  const statusGroup = () => within(screen.getByRole("group", { name: "Filter by applicant status" }));

  afterEach(cleanup);

  it("lists the newest applications first by default", () => {
    renderFilters();

    expect(visibleIds()).toEqual(["dan", "ben", "cleo", "ana"]);
  });

  it.each([
    ["In Progress", ["ana"]],
    ["Interview", ["ben"]],
    ["Accepted", ["cleo"]],
    ["Rejected", ["dan"]],
  ])("shows only %s applicants", async (status, expected) => {
    const user = userEvent.setup();
    renderFilters();

    await user.click(statusGroup().getByRole("button", { name: status }));

    expect(visibleIds()).toEqual(expected);
    expect(statusGroup().getByRole("button", { name: status }).getAttribute("aria-pressed")).toBe("true");
  });

  it("filters from the overview cards too", async () => {
    const user = userEvent.setup();
    renderFilters();

    const overview = within(screen.getByRole("region", { name: "Applicant overview" }));
    await user.click(overview.getByRole("button", { name: /Interviews/ }));

    expect(visibleIds()).toEqual(["ben"]);
  });

  it("searches by name, ignoring case", async () => {
    const user = userEvent.setup();
    renderFilters();

    await user.type(screen.getByLabelText("Search applicants by name"), "  ROSS ");

    expect(visibleIds()).toEqual(["ben"]);
  });

  it("sorts by best skill match, with no match last", async () => {
    const user = userEvent.setup();
    renderFilters();

    await user.selectOptions(screen.getByLabelText("Sort by"), "match");

    expect(visibleIds()).toEqual(["ben", "dan", "ana", "cleo"]);
  });

  it("sorts by oldest application first", async () => {
    const user = userEvent.setup();
    renderFilters();

    await user.selectOptions(screen.getByLabelText("Sort by"), "oldest");

    expect(visibleIds()).toEqual(["ana", "cleo", "ben", "dan"]);
  });

  it("resets every filter at once", async () => {
    const user = userEvent.setup();
    renderFilters();
    const reset = screen.getByRole("button", { name: /Reset filters/ }) as HTMLButtonElement;
    expect(reset.disabled).toBe(true);

    await user.click(statusGroup().getByRole("button", { name: "Accepted" }));
    await user.type(screen.getByLabelText("Search applicants by name"), "zzz");
    expect(visibleIds()).toEqual([]);

    await user.click(reset);

    expect(visibleIds()).toEqual(["dan", "ben", "cleo", "ana"]);
    expect((screen.getByLabelText("Search applicants by name") as HTMLInputElement).value).toBe("");
    expect(reset.disabled).toBe(true);
  });
});
