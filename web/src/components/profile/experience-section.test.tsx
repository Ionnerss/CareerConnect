// @vitest-environment jsdom

/**
 * Tests the Experience section on the profile page: listing entries,
 * adding, editing, deleting, validation and server errors.
 * The server actions are mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExperienceSection, type ExperienceEntry } from "./experience-section";

const mocks = vi.hoisted(() => ({
  addExperience: vi.fn(),
  updateExperience: vi.fn(),
  deleteExperience: vi.fn(),
}));

vi.mock("@/app/profile/experience-actions", () => ({
  addExperience: mocks.addExperience,
  updateExperience: mocks.updateExperience,
  deleteExperience: mocks.deleteExperience,
}));

const internship: ExperienceEntry = {
  id: "11111111-1111-4111-8111-111111111111",
  company_name: "Shopify",
  job_role: "Frontend Intern",
  start_date: "2025-05-01",
  end_date: null,
  description: "Built React components.",
};

const tutor: ExperienceEntry = {
  id: "22222222-2222-4222-8222-222222222222",
  company_name: "Concordia University",
  job_role: "Teaching Assistant",
  start_date: "2024-01-08",
  end_date: "2024-04-30",
  description: null,
};

describe("ExperienceSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("lists experience entries, newest first", () => {
    render(<ExperienceSection initialExperience={[tutor, internship]} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Frontend Intern")).toBeDefined();
    expect(within(items[0]).getByText("Shopify")).toBeDefined();
    expect(within(items[0]).getByText("May 2025 – Present")).toBeDefined();
    expect(within(items[0]).getByText("Built React components.")).toBeDefined();
    expect(within(items[1]).getByText("Teaching Assistant")).toBeDefined();
    expect(within(items[1]).getByText("Jan 2024 – Apr 2024")).toBeDefined();
  });

  it("shows a message when there is no experience yet", () => {
    render(<ExperienceSection initialExperience={[]} />);

    expect(screen.getByText("No experience added yet.")).toBeDefined();
  });

  it("shows the load error from the server", () => {
    render(
      <ExperienceSection
        initialExperience={[]}
        loadError="Unable to load your experience entries. Please try again."
      />,
    );

    expect(
      screen.getByText("Unable to load your experience entries. Please try again."),
    ).toBeDefined();
  });

  it("adds a new experience entry", async () => {
    const user = userEvent.setup();
    mocks.addExperience.mockResolvedValue({
      success: true,
      experience: { ...internship, profile_id: "user-1", created_at: "2026-10-18T00:00:00Z" },
    });

    render(<ExperienceSection initialExperience={[]} />);

    await user.click(screen.getByRole("button", { name: "Add experience" }));
    await user.type(screen.getByLabelText("Job title"), "Frontend Intern");
    await user.type(screen.getByLabelText("Company"), "Shopify");
    await user.type(screen.getByLabelText("Start date"), "2025-05-01");
    await user.type(screen.getByLabelText("Description"), "Built React components.");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Experience added.")).toBeDefined();
    expect(screen.getByText("Frontend Intern")).toBeDefined();
    expect(mocks.addExperience).toHaveBeenCalledWith({
      company_name: "Shopify",
      job_role: "Frontend Intern",
      start_date: "2025-05-01",
      end_date: "",
      description: "Built React components.",
    });
  });

  it("does not save when required fields are missing", async () => {
    const user = userEvent.setup();
    render(<ExperienceSection initialExperience={[]} />);

    await user.click(screen.getByRole("button", { name: "Add experience" }));
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("Job title is required (max 200 characters).")).toBeDefined();
    expect(screen.getByText("Company is required (max 200 characters).")).toBeDefined();
    expect(screen.getByText("Start date is required.")).toBeDefined();
    expect(mocks.addExperience).not.toHaveBeenCalled();
  });

  it("does not save when the end date is before the start date", async () => {
    const user = userEvent.setup();
    render(<ExperienceSection initialExperience={[]} />);

    await user.click(screen.getByRole("button", { name: "Add experience" }));
    await user.type(screen.getByLabelText("Job title"), "Frontend Intern");
    await user.type(screen.getByLabelText("Company"), "Shopify");
    await user.type(screen.getByLabelText("Start date"), "2025-05-01");
    await user.type(screen.getByLabelText("End date (leave empty if current)"), "2024-01-01");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("End date must be on or after the start date.")).toBeDefined();
    expect(mocks.addExperience).not.toHaveBeenCalled();
  });

  it("edits an existing entry", async () => {
    const user = userEvent.setup();
    mocks.updateExperience.mockResolvedValue({
      success: true,
      experience: { ...internship, end_date: "2025-08-29" },
    });

    render(<ExperienceSection initialExperience={[internship]} />);

    await user.click(screen.getByRole("button", { name: "Edit Frontend Intern at Shopify" }));
    expect(screen.getByLabelText<HTMLInputElement>("Company").value).toBe("Shopify");

    await user.type(screen.getByLabelText("End date (leave empty if current)"), "2025-08-29");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Experience updated.")).toBeDefined();
    expect(screen.getByText("May 2025 – Aug 2025")).toBeDefined();
    expect(mocks.updateExperience).toHaveBeenCalledWith(
      internship.id,
      expect.objectContaining({ end_date: "2025-08-29" }),
    );
  });

  it("shows the server error and keeps the form open when saving fails", async () => {
    const user = userEvent.setup();
    mocks.updateExperience.mockResolvedValue({
      success: false,
      error: "Unable to update your experience entry. Please try again.",
    });

    render(<ExperienceSection initialExperience={[internship]} />);

    await user.click(screen.getByRole("button", { name: "Edit Frontend Intern at Shopify" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("Unable to update your experience entry. Please try again."),
    ).toBeDefined();
    expect(screen.getByLabelText("Company")).toBeDefined();
  });

  it("cancels editing without saving", async () => {
    const user = userEvent.setup();
    render(<ExperienceSection initialExperience={[internship]} />);

    await user.click(screen.getByRole("button", { name: "Edit Frontend Intern at Shopify" }));
    await user.clear(screen.getByLabelText("Company"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Shopify")).toBeDefined();
    expect(screen.queryByLabelText("Company")).toBeNull();
    expect(mocks.updateExperience).not.toHaveBeenCalled();
  });

  it("deletes an entry after confirmation", async () => {
    const user = userEvent.setup();
    mocks.deleteExperience.mockResolvedValue({ success: true, expId: tutor.id });

    render(<ExperienceSection initialExperience={[internship, tutor]} />);

    await user.click(
      screen.getByRole("button", { name: "Delete Teaching Assistant at Concordia University" }),
    );
    expect(mocks.deleteExperience).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", {
        name: "Confirm delete Teaching Assistant at Concordia University",
      }),
    );

    expect(await screen.findByText("Experience removed.")).toBeDefined();
    expect(screen.queryByText("Teaching Assistant")).toBeNull();
    expect(mocks.deleteExperience).toHaveBeenCalledWith(tutor.id);
  });

  it("shows the server error when delete fails", async () => {
    const user = userEvent.setup();
    mocks.deleteExperience.mockResolvedValue({
      success: false,
      error: "Unable to delete your experience entry. Please try again.",
    });

    render(<ExperienceSection initialExperience={[tutor]} />);

    await user.click(
      screen.getByRole("button", { name: "Delete Teaching Assistant at Concordia University" }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Confirm delete Teaching Assistant at Concordia University",
      }),
    );

    expect(
      await screen.findByText("Unable to delete your experience entry. Please try again."),
    ).toBeDefined();
    expect(screen.getByText("Teaching Assistant")).toBeDefined();
  });
});
