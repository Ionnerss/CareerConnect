// @vitest-environment jsdom

/**
 * Tests the recruiter's "Post a job" form: fields, validation, the skills
 * preview, and what happens when posting succeeds or fails.
 * The server action and the router are mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobPostingForm } from "./job-posting-form";

const mocks = vi.hoisted(() => ({
  createJob: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/app/recruiter/jobs/actions", () => ({
  createJob: mocks.createJob,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

type User = ReturnType<typeof userEvent.setup>;

async function fillValidForm(user: User) {
  await user.type(screen.getByLabelText("Job title"), "Junior Frontend Developer");
  await user.type(screen.getByLabelText("Company name"), "Acme Inc.");
  await user.type(screen.getByLabelText("Location"), "Montreal, QC");
  await user.selectOptions(screen.getByLabelText("Work mode"), "Hybrid");
  await user.type(screen.getByLabelText("Salary (CAD / year, optional)"), "65000");
  await user.type(screen.getByLabelText("Required skills"), "React, TypeScript");
  await user.type(screen.getByLabelText("Description"), "Build the web app.");
}

describe("JobPostingForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows every field, with the three work modes the database allows", () => {
    render(<JobPostingForm />);

    for (const label of [
      "Job title",
      "Company name",
      "Location",
      "Salary (CAD / year, optional)",
      "Years of experience (optional)",
      "Required skills",
      "Description",
    ]) {
      expect(screen.getByLabelText(label)).toBeDefined();
    }

    const modes = within(screen.getByLabelText("Work mode")).getAllByRole("option");
    expect(modes.map((option) => option.textContent)).toEqual([
      "Select a work mode",
      "On-site",
      "Remote",
      "Hybrid",
    ]);

    const status = screen.getByLabelText<HTMLSelectElement>("Status");
    expect(status.value).toBe("open");
    expect(within(status).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Published",
      "Closed",
    ]);
  });

  it("shows what is missing and does not post an empty form", async () => {
    const user = userEvent.setup();
    render(<JobPostingForm />);

    await user.click(screen.getByRole("button", { name: "Post job" }));

    expect(screen.getByText("Job title is required.")).toBeDefined();
    expect(screen.getByText("Company name is required.")).toBeDefined();
    expect(screen.getByText("Location is required.")).toBeDefined();
    expect(screen.getByText("Choose a work mode.")).toBeDefined();
    expect(screen.getByText("Add at least one required skill.")).toBeDefined();
    expect(screen.getByText("Description is required.")).toBeDefined();
    expect(screen.getByLabelText("Job title").getAttribute("aria-invalid")).toBe("true");
    expect(mocks.createJob).not.toHaveBeenCalled();
  });

  it("does not post an invalid salary", async () => {
    const user = userEvent.setup();
    render(<JobPostingForm />);

    await fillValidForm(user);
    const salary = screen.getByLabelText("Salary (CAD / year, optional)");
    await user.clear(salary);
    await user.type(salary, "lots");
    await user.click(screen.getByRole("button", { name: "Post job" }));

    expect(
      screen.getByText("Enter a salary as a number, with at most two decimals (e.g. 65000)."),
    ).toBeDefined();
    expect(mocks.createJob).not.toHaveBeenCalled();
  });

  it("previews the skills as tags without repeats", async () => {
    const user = userEvent.setup();
    render(<JobPostingForm />);

    await user.type(screen.getByLabelText("Required skills"), "React, SQL,  react ,");

    const preview = screen.getByRole("list", { name: "Skills preview" });
    expect(within(preview).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "React",
      "SQL",
    ]);
  });

  it("posts the job and goes back to My job postings", async () => {
    const user = userEvent.setup();
    mocks.createJob.mockResolvedValue({
      success: true,
      job: { id: "job-1", title: "Junior Frontend Developer", location: "Montreal, QC", status: "open", created_at: "2026-10-24" },
    });
    render(<JobPostingForm />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Post job" }));

    expect(mocks.createJob).toHaveBeenCalledWith({
      title: "Junior Frontend Developer",
      firm_name: "Acme Inc.",
      location: "Montreal, QC",
      work_mode: "Hybrid",
      required_skills: "React, TypeScript",
      salary: "65000",
      experience: "",
      description: "Build the web app.",
      status: "open",
    });
    expect(mocks.push).toHaveBeenCalledWith("/recruiter/jobs");
  });

  it("sends closed when the recruiter picks Closed", async () => {
    const user = userEvent.setup();
    mocks.createJob.mockResolvedValue({
      success: true,
      job: { id: "job-1", title: "Junior Frontend Developer", location: "Montreal, QC", status: "closed", created_at: "2026-10-24" },
    });
    render(<JobPostingForm />);

    await fillValidForm(user);
    await user.selectOptions(screen.getByLabelText("Status"), "closed");
    await user.click(screen.getByRole("button", { name: "Post job" }));

    expect(mocks.createJob).toHaveBeenCalledWith(expect.objectContaining({ status: "closed" }));
  });

  it("shows the server error and keeps what the recruiter typed", async () => {
    const user = userEvent.setup();
    mocks.createJob.mockResolvedValue({ success: false, error: "Only recruiters can post jobs." });
    render(<JobPostingForm />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Post job" }));

    expect(await screen.findByText("Only recruiters can post jobs.")).toBeDefined();
    expect(screen.getByLabelText<HTMLInputElement>("Job title").value).toBe(
      "Junior Frontend Developer",
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("shows a general error if posting throws", async () => {
    const user = userEvent.setup();
    mocks.createJob.mockRejectedValue(new Error("network down"));
    render(<JobPostingForm />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Post job" }));

    expect(
      await screen.findByText("An unexpected error occurred. Please try again."),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Post job" })).toBeDefined();
  });

  it("has a Cancel link back to My job postings", () => {
    render(<JobPostingForm />);

    expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe(
      "/recruiter/jobs",
    );
  });
});
