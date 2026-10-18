// @vitest-environment jsdom

/**
 * Tests the Education section on the profile page: listing entries,
 * adding, editing, deleting, validation and server errors.
 * The server actions are mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EducationSection, type EducationEntry } from "./education-section";

const mocks = vi.hoisted(() => ({
  addEducation: vi.fn(),
  updateEducation: vi.fn(),
  deleteEducation: vi.fn(),
}));

vi.mock("@/app/profile/education-actions", () => ({
  addEducation: mocks.addEducation,
  updateEducation: mocks.updateEducation,
  deleteEducation: mocks.deleteEducation,
}));

const concordia: EducationEntry = {
  id: "11111111-1111-4111-8111-111111111111",
  school: "Concordia University",
  degree: "Bachelor's Degree",
  field_of_study: "Software Engineering",
  start_date: "2023-09-01",
  end_date: null,
  description: "Member of the robotics club.",
};

const cegep: EducationEntry = {
  id: "22222222-2222-4222-8222-222222222222",
  school: "Dawson College",
  degree: "DEC",
  field_of_study: null,
  start_date: "2021-08-15",
  end_date: "2023-05-31",
  description: null,
};

describe("EducationSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("lists education entries, newest first", () => {
    render(<EducationSection initialEducation={[cegep, concordia]} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Concordia University")).toBeDefined();
    expect(within(items[0]).getByText("Bachelor's Degree, Software Engineering")).toBeDefined();
    expect(within(items[0]).getByText("Sep 2023 – Present")).toBeDefined();
    expect(within(items[0]).getByText("Member of the robotics club.")).toBeDefined();
    expect(within(items[1]).getByText("Dawson College")).toBeDefined();
    expect(within(items[1]).getByText("Aug 2021 – May 2023")).toBeDefined();
  });

  it("shows a message when there is no education yet", () => {
    render(<EducationSection initialEducation={[]} />);

    expect(screen.getByText("No education added yet.")).toBeDefined();
  });

  it("shows the load error from the server", () => {
    render(
      <EducationSection
        initialEducation={[]}
        loadError="Unable to load your education entries. Please try again."
      />,
    );

    expect(
      screen.getByText("Unable to load your education entries. Please try again."),
    ).toBeDefined();
  });

  it("adds a new education entry", async () => {
    const user = userEvent.setup();
    mocks.addEducation.mockResolvedValue({
      success: true,
      education: { ...concordia, profile_id: "user-1", created_at: "2026-10-18T00:00:00Z" },
    });

    render(<EducationSection initialEducation={[]} />);

    await user.click(screen.getByRole("button", { name: "Add education" }));
    await user.type(screen.getByLabelText("School"), "Concordia University");
    await user.selectOptions(screen.getByLabelText("Degree"), "Bachelor's Degree");
    await user.type(screen.getByLabelText("Field of study"), "Software Engineering");
    await user.type(screen.getByLabelText("Start date"), "2023-09-01");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Education added.")).toBeDefined();
    expect(screen.getByText("Concordia University")).toBeDefined();
    expect(mocks.addEducation).toHaveBeenCalledWith({
      school: "Concordia University",
      degree: "Bachelor's Degree",
      field_of_study: "Software Engineering",
      start_date: "2023-09-01",
      end_date: "",
      description: "",
    });
  });

  it("does not save when required fields are missing", async () => {
    const user = userEvent.setup();
    render(<EducationSection initialEducation={[]} />);

    await user.click(screen.getByRole("button", { name: "Add education" }));
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("School is required (max 200 characters).")).toBeDefined();
    expect(
      screen.getByText("Please choose a degree (or describe it under Other, max 200 characters)."),
    ).toBeDefined();
    expect(screen.getByText("Start date is required.")).toBeDefined();
    expect(mocks.addEducation).not.toHaveBeenCalled();
  });

  it("does not save when the end date is before the start date", async () => {
    const user = userEvent.setup();
    render(<EducationSection initialEducation={[]} />);

    await user.click(screen.getByRole("button", { name: "Add education" }));
    await user.type(screen.getByLabelText("School"), "Concordia University");
    await user.selectOptions(screen.getByLabelText("Degree"), "Bachelor's Degree");
    await user.type(screen.getByLabelText("Start date"), "2023-09-01");
    await user.type(screen.getByLabelText("End date (leave empty if ongoing)"), "2022-01-01");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(
      screen.getByText("End date must be on or after the start date."),
    ).toBeDefined();
    expect(mocks.addEducation).not.toHaveBeenCalled();
  });

  it("lists the common degree options", async () => {
    const user = userEvent.setup();
    render(<EducationSection initialEducation={[]} />);

    await user.click(screen.getByRole("button", { name: "Add education" }));

    const select = screen.getByLabelText<HTMLSelectElement>("Degree");
    const options = Array.from(select.options).map((option) => option.textContent);
    expect(options).toEqual([
      "Select a degree",
      "High School Diploma",
      "DEC (CEGEP)",
      "Certificate / Diploma",
      "Associate Degree",
      "Bachelor's Degree",
      "Master's Degree",
      "Doctorate (PhD)",
      "Other",
    ]);
    expect(screen.queryByLabelText("Other degree")).toBeNull();
  });

  it("saves a custom degree typed under Other", async () => {
    const user = userEvent.setup();
    mocks.addEducation.mockResolvedValue({
      success: true,
      education: { ...cegep, degree: "Undergraduate certificate" },
    });

    render(<EducationSection initialEducation={[]} />);

    await user.click(screen.getByRole("button", { name: "Add education" }));
    await user.type(screen.getByLabelText("School"), "Dawson College");
    await user.selectOptions(screen.getByLabelText("Degree"), "Other");
    await user.type(screen.getByLabelText("Other degree"), "Undergraduate certificate");
    await user.type(screen.getByLabelText("Start date"), "2021-08-15");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Education added.")).toBeDefined();
    expect(mocks.addEducation).toHaveBeenCalledWith(
      expect.objectContaining({ degree: "Undergraduate certificate" }),
    );
  });

  it("does not save Other without a typed degree", async () => {
    const user = userEvent.setup();
    render(<EducationSection initialEducation={[]} />);

    await user.click(screen.getByRole("button", { name: "Add education" }));
    await user.type(screen.getByLabelText("School"), "Dawson College");
    await user.selectOptions(screen.getByLabelText("Degree"), "Other");
    await user.type(screen.getByLabelText("Start date"), "2021-08-15");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(
      screen.getByText("Please choose a degree (or describe it under Other, max 200 characters)."),
    ).toBeDefined();
    expect(mocks.addEducation).not.toHaveBeenCalled();
  });

  it("opens a custom degree under Other when editing", async () => {
    const user = userEvent.setup();
    render(
      <EducationSection initialEducation={[{ ...concordia, degree: "Undergraduate" }]} />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Concordia University" }));

    expect(screen.getByLabelText<HTMLSelectElement>("Degree").value).toBe("Other");
    expect(screen.getByLabelText<HTMLInputElement>("Other degree").value).toBe("Undergraduate");
  });

  it("edits an existing entry", async () => {
    const user = userEvent.setup();
    mocks.updateEducation.mockResolvedValue({
      success: true,
      education: { ...concordia, end_date: "2027-04-30" },
    });

    render(<EducationSection initialEducation={[concordia]} />);

    await user.click(screen.getByRole("button", { name: "Edit Concordia University" }));
    expect(screen.getByLabelText<HTMLInputElement>("School").value).toBe("Concordia University");

    await user.type(screen.getByLabelText("End date (leave empty if ongoing)"), "2027-04-30");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Education updated.")).toBeDefined();
    expect(screen.getByText("Sep 2023 – Apr 2027")).toBeDefined();
    expect(mocks.updateEducation).toHaveBeenCalledWith(
      concordia.id,
      expect.objectContaining({ end_date: "2027-04-30" }),
    );
  });

  it("shows the server error and keeps the form open when saving fails", async () => {
    const user = userEvent.setup();
    mocks.updateEducation.mockResolvedValue({
      success: false,
      error: "Unable to update your education entry. Please try again.",
    });

    render(<EducationSection initialEducation={[concordia]} />);

    await user.click(screen.getByRole("button", { name: "Edit Concordia University" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("Unable to update your education entry. Please try again."),
    ).toBeDefined();
    expect(screen.getByLabelText("School")).toBeDefined();
  });

  it("cancels editing without saving", async () => {
    const user = userEvent.setup();
    render(<EducationSection initialEducation={[concordia]} />);

    await user.click(screen.getByRole("button", { name: "Edit Concordia University" }));
    await user.clear(screen.getByLabelText("School"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Concordia University")).toBeDefined();
    expect(screen.queryByLabelText("School")).toBeNull();
    expect(mocks.updateEducation).not.toHaveBeenCalled();
  });

  it("deletes an entry after confirmation", async () => {
    const user = userEvent.setup();
    mocks.deleteEducation.mockResolvedValue({ success: true, educationId: cegep.id });

    render(<EducationSection initialEducation={[concordia, cegep]} />);

    await user.click(screen.getByRole("button", { name: "Delete Dawson College" }));
    expect(mocks.deleteEducation).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirm delete Dawson College" }));

    expect(await screen.findByText("Education removed.")).toBeDefined();
    expect(screen.queryByText("Dawson College")).toBeNull();
    expect(mocks.deleteEducation).toHaveBeenCalledWith(cegep.id);
  });

  it("keeps the entry when delete is cancelled", async () => {
    const user = userEvent.setup();
    render(<EducationSection initialEducation={[cegep]} />);

    await user.click(screen.getByRole("button", { name: "Delete Dawson College" }));
    await user.click(screen.getByRole("button", { name: "Keep" }));

    expect(screen.getByText("Dawson College")).toBeDefined();
    expect(mocks.deleteEducation).not.toHaveBeenCalled();
  });
});
