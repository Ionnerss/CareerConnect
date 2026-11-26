// @vitest-environment jsdom

/** Tests the recruiter's list of job postings: search, filters, sorting and actions. */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecruiterJobsList from "./recruiter-jobs-list";

// The close/reopen button has its own tests; here we only check each posting gets the right one.
vi.mock("@/components/recruiter/close-job-button", () => ({
  CloseJobButton: ({ jobId, status }: { jobId: string; status: string }) => (
    <span data-testid="archive-button">{`${status === "open" ? "Close" : "Reopen"} ${jobId}`}</span>
  ),
}));

const jobs = [
  { id: "job-a", title: "Backend Developer", location: "Toronto, ON", status: "open", applicant_count: 2 },
  { id: "job-b", title: "Data Analyst", location: "Montreal, QC", status: "closed", applicant_count: 5 },
  { id: "job-c", title: "Cloud Engineer", location: "Remote", status: "open", applicant_count: 0 },
];

afterEach(cleanup);

function titles() {
  return within(screen.getByRole("list"))
    .getAllByRole("listitem")
    .map((item) => within(item).getAllByRole("link")[0].textContent);
}

function renderList(list = jobs) {
  render(<RecruiterJobsList jobs={list} />);
  return userEvent.setup();
}

describe("RecruiterJobsList", () => {
  it("invites the recruiter to post a first job when there are none", () => {
    renderList([]);

    expect(screen.getByText("No job postings yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Post your first job" }).getAttribute("href")).toBe("/recruiter/jobs/new");
  });

  it("lists postings with the most applicants first", () => {
    renderList();

    expect(titles()).toEqual(["Data Analyst", "Backend Developer", "Cloud Engineer"]);
  });

  it("links each posting to its applicants and its edit form, with the right archive action", () => {
    renderList();

    const analyst = within(screen.getAllByRole("listitem")[0]);
    expect(analyst.getByRole("link", { name: /View applicants/ }).getAttribute("href")).toBe("/recruiter/jobs/job-b/applicants");
    expect(analyst.getByRole("link", { name: /Edit job/ }).getAttribute("href")).toBe("/recruiter/jobs/job-b/edit");
    expect(analyst.getByTestId("archive-button").textContent).toBe("Reopen job-b");
    expect(within(screen.getAllByRole("listitem")[1]).getByTestId("archive-button").textContent).toBe("Close job-a");
  });

  it.each([
    ["Open", ["Backend Developer", "Cloud Engineer"]],
    ["Closed", ["Data Analyst"]],
    ["All jobs", ["Data Analyst", "Backend Developer", "Cloud Engineer"]],
  ])("filters by %s", async (label, expected) => {
    const user = renderList();

    const group = within(screen.getByRole("group", { name: "Filter job postings by status" }));
    await user.click(group.getByRole("button", { name: label }));

    expect(titles()).toEqual(expected);
  });

  it("filters from the overview cards", async () => {
    const user = renderList();

    const overview = within(screen.getByRole("region", { name: "Job posting overview" }));
    await user.click(overview.getByRole("button", { name: /Closed postings/ }));

    expect(titles()).toEqual(["Data Analyst"]);
  });

  it("searches by title or location", async () => {
    const user = renderList();
    const search = screen.getByLabelText("Search job postings");

    await user.type(search, "montreal");
    expect(titles()).toEqual(["Data Analyst"]);

    await user.clear(search);
    await user.type(search, "ENGINEER");
    expect(titles()).toEqual(["Cloud Engineer"]);
  });

  it.each([
    ["fewest", ["Cloud Engineer", "Backend Developer", "Data Analyst"]],
    ["title", ["Backend Developer", "Cloud Engineer", "Data Analyst"]],
  ])("sorts by %s", async (option, expected) => {
    const user = renderList();

    await user.selectOptions(screen.getByLabelText("Sort job postings"), option);

    expect(titles()).toEqual(expected);
  });

  it("explains when nothing matches and clears the filters", async () => {
    const user = renderList();

    await user.type(screen.getByLabelText("Search job postings"), "nothing like this");
    expect(screen.getByText("No matching job postings")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(titles()).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /Reset filters/ })).toBeNull();
  });
});
