/**
 * Every profile server action must pass the MFA check before touching the
 * user's data, and must forward the input unchanged to the profile library.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveProfile } from "./actions";
import { addEducation, deleteEducation, updateEducation } from "./education-actions";
import { addExperience, deleteExperience, updateExperience } from "./experience-actions";
import { addLanguage, deleteLanguage, savePreferences } from "./preferences-actions";
import {
  addLink,
  addProject,
  deleteLink,
  deleteProject,
  getImageUrl,
  updateProject,
} from "./projects-actions";
import { addSkill, deleteSkill, updateSkill } from "./skills-actions";

const lib = vi.hoisted(() => {
  const names = [
    "updateCurrentProfile",
    "addCurrentEducation", "updateCurrentEducation", "deleteCurrentEducation",
    "addCurrentExperience", "updateCurrentExperience", "deleteCurrentExperience",
    "addCurrentSkill", "updateCurrentSkill", "deleteCurrentSkill",
    "saveCurrentPreferences", "addPreferenceLanguage", "deletePreferenceLanguage",
    "addCurrentProject", "updateCurrentProject", "deleteCurrentProject",
    "addProjectLink", "deleteProjectLink", "getProjectImageUrl",
  ] as const;
  return Object.fromEntries(names.map((name) => [name, vi.fn()])) as Record<(typeof names)[number], ReturnType<typeof vi.fn>>;
});
const requireMfaForAction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/require-mfa", () => ({ requireMfaForAction }));
vi.mock("@/lib/profiles/profile", () => ({ updateCurrentProfile: lib.updateCurrentProfile }));
vi.mock("@/lib/profiles/profile-education", () => ({
  addCurrentEducation: lib.addCurrentEducation,
  updateCurrentEducation: lib.updateCurrentEducation,
  deleteCurrentEducation: lib.deleteCurrentEducation,
}));
vi.mock("@/lib/profiles/profile-experience", () => ({
  addCurrentExperience: lib.addCurrentExperience,
  updateCurrentExperience: lib.updateCurrentExperience,
  deleteCurrentExperience: lib.deleteCurrentExperience,
}));
vi.mock("@/lib/profiles/profile-skills", () => ({
  addCurrentSkill: lib.addCurrentSkill,
  updateCurrentSkill: lib.updateCurrentSkill,
  deleteCurrentSkill: lib.deleteCurrentSkill,
}));
vi.mock("@/lib/profiles/profile-preferences", () => ({
  saveCurrentPreferences: lib.saveCurrentPreferences,
  addPreferenceLanguage: lib.addPreferenceLanguage,
  deletePreferenceLanguage: lib.deletePreferenceLanguage,
}));
vi.mock("@/lib/profiles/profile-projects", () => ({
  addCurrentProject: lib.addCurrentProject,
  updateCurrentProject: lib.updateCurrentProject,
  deleteCurrentProject: lib.deleteCurrentProject,
}));
vi.mock("@/lib/profiles/profile-project-links", () => ({
  addProjectLink: lib.addProjectLink,
  deleteProjectLink: lib.deleteProjectLink,
}));
vi.mock("@/lib/profiles/profile-project-images", () => ({
  getProjectImageUrl: lib.getProjectImageUrl,
}));

const input = { anything: "from the form" };

// [action name, call the action, library function it must use, expected arguments]
const protectedActions: [string, () => Promise<unknown>, ReturnType<typeof vi.fn>, unknown[]][] = [
  ["addEducation", () => addEducation(input), lib.addCurrentEducation, [input]],
  ["updateEducation", () => updateEducation("edu-1", input), lib.updateCurrentEducation, ["edu-1", input]],
  ["deleteEducation", () => deleteEducation("edu-1"), lib.deleteCurrentEducation, ["edu-1"]],
  ["addExperience", () => addExperience(input), lib.addCurrentExperience, [input]],
  ["updateExperience", () => updateExperience("exp-1", input), lib.updateCurrentExperience, ["exp-1", input]],
  ["deleteExperience", () => deleteExperience("exp-1"), lib.deleteCurrentExperience, ["exp-1"]],
  ["addSkill", () => addSkill(input), lib.addCurrentSkill, [input]],
  ["updateSkill", () => updateSkill("skill-1", input), lib.updateCurrentSkill, ["skill-1", input]],
  ["deleteSkill", () => deleteSkill("skill-1"), lib.deleteCurrentSkill, ["skill-1"]],
  ["savePreferences", () => savePreferences(input), lib.saveCurrentPreferences, [input]],
  ["addLanguage", () => addLanguage(input), lib.addPreferenceLanguage, [input]],
  ["deleteLanguage", () => deleteLanguage("lang-1"), lib.deletePreferenceLanguage, ["lang-1"]],
  ["addProject", () => addProject(input), lib.addCurrentProject, [input]],
  ["updateProject", () => updateProject("proj-1", input), lib.updateCurrentProject, ["proj-1", input]],
  ["deleteProject", () => deleteProject("proj-1"), lib.deleteCurrentProject, ["proj-1"]],
  ["addLink", () => addLink("proj-1", input), lib.addProjectLink, ["proj-1", input]],
  ["deleteLink", () => deleteLink("link-1"), lib.deleteProjectLink, ["link-1"]],
  ["getImageUrl", () => getImageUrl("img-1"), lib.getProjectImageUrl, ["img-1"]],
];

beforeEach(() => {
  vi.clearAllMocks();
  requireMfaForAction.mockResolvedValue({ user: { id: "user-1" } });
  for (const fn of Object.values(lib)) fn.mockResolvedValue({ success: true });
});

describe("profile server actions", () => {
  it.each(protectedActions)("%s checks MFA, then saves through the profile library", async (_name, run, libFn, args) => {
    expect(await run()).toEqual({ success: true });

    expect(requireMfaForAction).toHaveBeenCalledTimes(1);
    expect(libFn).toHaveBeenCalledWith(...args);
    expect(requireMfaForAction.mock.invocationCallOrder[0]).toBeLessThan(libFn.mock.invocationCallOrder[0]);
  });

  it.each(protectedActions)("%s changes nothing when the MFA check fails", async (_name, run, libFn) => {
    requireMfaForAction.mockRejectedValue(new Error("MFA verification required."));

    await expect(run()).rejects.toThrow("MFA verification required.");
    expect(libFn).not.toHaveBeenCalled();
  });

  // saveProfile has no check of its own: updateCurrentProfile checks MFA on the same Supabase client.
  it("saveProfile forwards the form data to the profile library", async () => {
    expect(await saveProfile(input)).toEqual({ success: true });
    expect(lib.updateCurrentProfile).toHaveBeenCalledWith(input);
  });
});
