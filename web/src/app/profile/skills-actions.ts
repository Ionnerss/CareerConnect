"use server";

import { requireMfaForAction } from "@/lib/auth/require-mfa";

import {
  addCurrentSkill,
  deleteCurrentSkill,
  updateCurrentSkill,
} from "@/lib/profiles/profile-skills";

export async function addSkill(input: unknown) {
  await requireMfaForAction();
  return await addCurrentSkill(input);
}

export async function updateSkill(skillId: string, input: unknown) {
  await requireMfaForAction();
  return await updateCurrentSkill(skillId, input);
}

export async function deleteSkill(skillId: string) {
  await requireMfaForAction();
  return await deleteCurrentSkill(skillId);
}
