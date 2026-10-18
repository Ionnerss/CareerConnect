"use server";

import {
  addCurrentSkill,
  deleteCurrentSkill,
  updateCurrentSkill,
} from "@/lib/profiles/profile-skills";

export async function addSkill(input: unknown) {
  return await addCurrentSkill(input);
}

export async function updateSkill(skillId: string, input: unknown) {
  return await updateCurrentSkill(skillId, input);
}

export async function deleteSkill(skillId: string) {
  return await deleteCurrentSkill(skillId);
}
