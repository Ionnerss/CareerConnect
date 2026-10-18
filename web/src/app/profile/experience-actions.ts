"use server";

import {
  addCurrentExperience,
  deleteCurrentExperience,
  updateCurrentExperience,
} from "@/lib/profiles/profile-experience";

export async function addExperience(input: unknown) {
  return await addCurrentExperience(input);
}

export async function updateExperience(experienceId: string, input: unknown) {
  return await updateCurrentExperience(experienceId, input);
}

export async function deleteExperience(experienceId: string) {
  return await deleteCurrentExperience(experienceId);
}
