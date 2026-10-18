// @vitest-environment jsdom

/**
 * Tests the Skills section on the profile page: listing skills,
 * adding, editing, deleting, validation and server errors.
 * The server actions are mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SkillsSection, type SkillEntry } from "./skills-section";

const mocks = vi.hoisted(() => ({
  addSkill: vi.fn(),
  updateSkill: vi.fn(),
  deleteSkill: vi.fn(),
}));

vi.mock("@/app/profile/skills-actions", () => ({
  addSkill: mocks.addSkill,
  updateSkill: mocks.updateSkill,
  deleteSkill: mocks.deleteSkill,
}));

const react: SkillEntry = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "React",
  proficiency: "Advanced",
};

const typescript: SkillEntry = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "TypeScript",
  proficiency: "Intermediate",
};

const css: SkillEntry = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "css",
  proficiency: "Beginner",
};

describe("SkillsSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("lists skills alphabetically with their proficiency", () => {
    render(<SkillsSection initialSkills={[typescript, react, css]} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText("css")).toBeDefined();
    expect(within(items[0]).getByText("Beginner")).toBeDefined();
    expect(within(items[1]).getByText("React")).toBeDefined();
    expect(within(items[1]).getByText("Advanced")).toBeDefined();
    expect(within(items[2]).getByText("TypeScript")).toBeDefined();
  });

  it("shows a message when there are no skills yet", () => {
    render(<SkillsSection initialSkills={[]} />);

    expect(screen.getByText("No skills added yet.")).toBeDefined();
  });

  it("shows the load error from the server", () => {
    render(
      <SkillsSection initialSkills={[]} loadError="Unable to load your skills. Please try again." />,
    );

    expect(screen.getByText("Unable to load your skills. Please try again.")).toBeDefined();
  });

  it("offers the four proficiency levels", async () => {
    const user = userEvent.setup();
    render(<SkillsSection initialSkills={[]} />);

    await user.click(screen.getByRole("button", { name: "Add skill" }));

    const select = screen.getByLabelText<HTMLSelectElement>("Proficiency");
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
      "Select a level",
      "Beginner",
      "Intermediate",
      "Advanced",
      "Expert",
    ]);
  });

  it("adds a new skill", async () => {
    const user = userEvent.setup();
    mocks.addSkill.mockResolvedValue({
      success: true,
      skill: { ...react, profile_id: "user-1", created_at: "2026-10-18T00:00:00Z" },
    });

    render(<SkillsSection initialSkills={[]} />);

    await user.click(screen.getByRole("button", { name: "Add skill" }));
    await user.type(screen.getByLabelText("Skill"), "React");
    await user.selectOptions(screen.getByLabelText("Proficiency"), "Advanced");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Skill added.")).toBeDefined();
    expect(screen.getByText("React")).toBeDefined();
    expect(mocks.addSkill).toHaveBeenCalledWith({ name: "React", proficiency: "Advanced" });
  });

  it("does not save without a name and proficiency", async () => {
    const user = userEvent.setup();
    render(<SkillsSection initialSkills={[]} />);

    await user.click(screen.getByRole("button", { name: "Add skill" }));
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("Skill name is required (max 100 characters).")).toBeDefined();
    expect(screen.getByText("Please choose a proficiency level.")).toBeDefined();
    expect(mocks.addSkill).not.toHaveBeenCalled();
  });

  it("shows the duplicate-skill error from the server", async () => {
    const user = userEvent.setup();
    mocks.addSkill.mockResolvedValue({
      success: false,
      error: "You already have a skill with that name.",
    });

    render(<SkillsSection initialSkills={[react]} />);

    await user.click(screen.getByRole("button", { name: "Add skill" }));
    await user.type(screen.getByLabelText("Skill"), "React");
    await user.selectOptions(screen.getByLabelText("Proficiency"), "Expert");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("You already have a skill with that name.")).toBeDefined();
    expect(screen.getByLabelText("Skill")).toBeDefined();
  });

  it("edits a skill's proficiency", async () => {
    const user = userEvent.setup();
    mocks.updateSkill.mockResolvedValue({
      success: true,
      skill: { ...typescript, proficiency: "Expert" },
    });

    render(<SkillsSection initialSkills={[typescript]} />);

    await user.click(screen.getByRole("button", { name: "Edit TypeScript" }));
    expect(screen.getByLabelText<HTMLInputElement>("Skill").value).toBe("TypeScript");
    expect(screen.getByLabelText<HTMLSelectElement>("Proficiency").value).toBe("Intermediate");

    await user.selectOptions(screen.getByLabelText("Proficiency"), "Expert");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Skill updated.")).toBeDefined();
    expect(screen.getByText("Expert")).toBeDefined();
    expect(mocks.updateSkill).toHaveBeenCalledWith(typescript.id, {
      name: "TypeScript",
      proficiency: "Expert",
    });
  });

  it("cancels editing without saving", async () => {
    const user = userEvent.setup();
    render(<SkillsSection initialSkills={[typescript]} />);

    await user.click(screen.getByRole("button", { name: "Edit TypeScript" }));
    await user.clear(screen.getByLabelText("Skill"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("TypeScript")).toBeDefined();
    expect(screen.queryByLabelText("Skill")).toBeNull();
    expect(mocks.updateSkill).not.toHaveBeenCalled();
  });

  it("deletes a skill after confirmation", async () => {
    const user = userEvent.setup();
    mocks.deleteSkill.mockResolvedValue({ success: true, skillId: css.id });

    render(<SkillsSection initialSkills={[react, css]} />);

    await user.click(screen.getByRole("button", { name: "Delete css" }));
    expect(mocks.deleteSkill).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirm delete css" }));

    expect(await screen.findByText("Skill removed.")).toBeDefined();
    expect(screen.queryByText("css")).toBeNull();
    expect(mocks.deleteSkill).toHaveBeenCalledWith(css.id);
  });

  it("keeps the skill when delete is cancelled", async () => {
    const user = userEvent.setup();
    render(<SkillsSection initialSkills={[react]} />);

    await user.click(screen.getByRole("button", { name: "Delete React" }));
    await user.click(screen.getByRole("button", { name: "Keep" }));

    expect(screen.getByText("React")).toBeDefined();
    expect(mocks.deleteSkill).not.toHaveBeenCalled();
  });
});
