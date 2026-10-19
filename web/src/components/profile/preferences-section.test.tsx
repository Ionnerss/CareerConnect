// @vitest-environment jsdom

/**
 * Tests the Job preferences section on the profile page: showing preferences,
 * editing and saving them, validation, and adding/removing languages.
 * The server actions are mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  formatSalary,
  PreferencesSection,
  type PreferenceLanguage,
  type Preferences,
} from "./preferences-section";

const mocks = vi.hoisted(() => ({
  savePreferences: vi.fn(),
  addLanguage: vi.fn(),
  deleteLanguage: vi.fn(),
}));

vi.mock("@/app/profile/preferences-actions", () => ({
  savePreferences: mocks.savePreferences,
  addLanguage: mocks.addLanguage,
  deleteLanguage: mocks.deleteLanguage,
}));

const prefs: Preferences = {
  desired_role: "Frontend Developer",
  desired_position: "internship",
  desired_salary: 65000,
  work_mode: "hybrid",
};

const english: PreferenceLanguage = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "English",
};

const french: PreferenceLanguage = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "French",
};

describe("formatSalary", () => {
  it("formats a yearly CAD salary", () => {
    expect(formatSalary(65000)).toBe("$65,000 CAD / year");
  });

  it("returns null when there is no salary", () => {
    expect(formatSalary(null)).toBeNull();
  });
});

describe("PreferencesSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows saved preferences with readable labels", () => {
    render(<PreferencesSection initialPreferences={prefs} initialLanguages={[english]} />);

    expect(screen.getByText("Frontend Developer")).toBeDefined();
    expect(screen.getByText("Internship")).toBeDefined();
    expect(screen.getByText("Hybrid")).toBeDefined();
    expect(screen.getByText("$65,000 CAD / year")).toBeDefined();
    expect(within(screen.getByRole("list", { name: "Languages" })).getByText("English")).toBeDefined();
  });

  it("invites the user to set preferences when none exist", () => {
    render(<PreferencesSection initialPreferences={null} initialLanguages={[]} />);

    expect(screen.getByText("Tell recruiters what you're looking for.")).toBeDefined();
    expect(screen.getByText("No languages added yet.")).toBeDefined();
  });

  it("shows the load error from the server", () => {
    render(
      <PreferencesSection
        initialPreferences={null}
        initialLanguages={[]}
        loadError="Unable to load your preferences. Please try again."
      />,
    );

    expect(screen.getByText("Unable to load your preferences. Please try again.")).toBeDefined();
  });

  it("saves edited preferences", async () => {
    const user = userEvent.setup();
    mocks.savePreferences.mockResolvedValue({
      success: true,
      preferences: {
        profile_id: "user-1",
        desired_role: "Backend Developer",
        desired_position: "full_time",
        desired_salary: "80000",
        work_mode: "remote",
        created_at: "2026-10-19T00:00:00Z",
      },
    });

    render(<PreferencesSection initialPreferences={prefs} initialLanguages={[]} />);

    await user.click(screen.getByRole("button", { name: "Edit preferences" }));
    expect(screen.getByLabelText<HTMLSelectElement>("Position type").value).toBe("internship");

    const role = screen.getByLabelText("Desired role");
    await user.clear(role);
    await user.type(role, "Backend Developer");
    await user.selectOptions(screen.getByLabelText("Position type"), "full_time");
    await user.selectOptions(screen.getByLabelText("Work mode"), "remote");
    const salary = screen.getByLabelText("Desired salary (CAD / year)");
    await user.clear(salary);
    await user.type(salary, "80000");
    await user.click(screen.getByRole("button", { name: "Save preferences" }));

    expect(await screen.findByText("Preferences saved.")).toBeDefined();
    expect(screen.getByText("Backend Developer")).toBeDefined();
    expect(screen.getByText("Full-time")).toBeDefined();
    expect(screen.getByText("Remote")).toBeDefined();
    expect(screen.getByText("$80,000 CAD / year")).toBeDefined();
    expect(mocks.savePreferences).toHaveBeenCalledWith({
      desired_role: "Backend Developer",
      desired_position: "full_time",
      desired_salary: "80000",
      work_mode: "remote",
    });
  });

  it("does not save an invalid salary", async () => {
    const user = userEvent.setup();
    render(<PreferencesSection initialPreferences={null} initialLanguages={[]} />);

    await user.click(screen.getByRole("button", { name: "Edit preferences" }));
    await user.type(screen.getByLabelText("Desired salary (CAD / year)"), "lots");
    await user.click(screen.getByRole("button", { name: "Save preferences" }));

    expect(
      screen.getByText("Enter a positive amount with at most two decimals (e.g. 65000)."),
    ).toBeDefined();
    expect(mocks.savePreferences).not.toHaveBeenCalled();
  });

  it("shows the server error and keeps the form open when saving fails", async () => {
    const user = userEvent.setup();
    mocks.savePreferences.mockResolvedValue({
      success: false,
      error: "Unable to save your preferences. Please try again.",
    });

    render(<PreferencesSection initialPreferences={prefs} initialLanguages={[]} />);

    await user.click(screen.getByRole("button", { name: "Edit preferences" }));
    await user.click(screen.getByRole("button", { name: "Save preferences" }));

    expect(
      await screen.findByText("Unable to save your preferences. Please try again."),
    ).toBeDefined();
    expect(screen.getByLabelText("Desired role")).toBeDefined();
  });

  it("cancels editing without saving", async () => {
    const user = userEvent.setup();
    render(<PreferencesSection initialPreferences={prefs} initialLanguages={[]} />);

    await user.click(screen.getByRole("button", { name: "Edit preferences" }));
    await user.clear(screen.getByLabelText("Desired role"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Frontend Developer")).toBeDefined();
    expect(mocks.savePreferences).not.toHaveBeenCalled();
  });

  it("adds a language", async () => {
    const user = userEvent.setup();
    mocks.addLanguage.mockResolvedValue({
      success: true,
      language: { ...french, profile_id: "user-1", created_at: "2026-10-19T00:00:00Z" },
    });

    render(<PreferencesSection initialPreferences={null} initialLanguages={[english]} />);

    await user.type(screen.getByLabelText("Language"), "French");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Language added.")).toBeDefined();
    const list = screen.getByRole("list", { name: "Languages" });
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "English",
      "French",
    ]);
    expect(mocks.addLanguage).toHaveBeenCalledWith({ name: "French" });
  });

  it("does not add an empty language", async () => {
    const user = userEvent.setup();
    render(<PreferencesSection initialPreferences={null} initialLanguages={[]} />);

    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("Enter a language name (max 100 characters).")).toBeDefined();
    expect(mocks.addLanguage).not.toHaveBeenCalled();
  });

  it("shows the duplicate-language error from the server", async () => {
    const user = userEvent.setup();
    mocks.addLanguage.mockResolvedValue({
      success: false,
      error: "You already added that language.",
    });

    render(<PreferencesSection initialPreferences={null} initialLanguages={[english]} />);

    await user.type(screen.getByLabelText("Language"), "English");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("You already added that language.")).toBeDefined();
  });

  it("removes a language", async () => {
    const user = userEvent.setup();
    mocks.deleteLanguage.mockResolvedValue({ success: true, languageId: french.id });

    render(<PreferencesSection initialPreferences={null} initialLanguages={[english, french]} />);

    await user.click(screen.getByRole("button", { name: "Remove language French" }));

    expect(await screen.findByText("Language removed.")).toBeDefined();
    expect(screen.queryByText("French")).toBeNull();
    expect(mocks.deleteLanguage).toHaveBeenCalledWith(french.id);
  });
});
