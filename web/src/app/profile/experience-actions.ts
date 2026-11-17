"use server";

import { requireMfaForAction } from "@/lib/auth/require-mfa";

import {
  addCurrentExperience,
  deleteCurrentExperience,
  updateCurrentExperience,
} from "@/lib/profiles/profile-experience";

export async function addExperience(input: unknown) {
  await requireMfaForAction();
  return await addCurrentExperience(input);
}

export async function updateExperience(experienceId: string, input: unknown) {
  await requireMfaForAction();
  return await updateCurrentExperience(experienceId, input);
}

export async function deleteExperience(experienceId: string) {
  await requireMfaForAction();
  return await deleteCurrentExperience(experienceId);
}
