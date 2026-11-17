"use server";

import { requireMfaForAction } from "@/lib/auth/require-mfa";

import {
  addCurrentEducation,
  deleteCurrentEducation,
  updateCurrentEducation,
} from "@/lib/profiles/profile-education";

export async function addEducation(input: unknown) {
  await requireMfaForAction();
  return await addCurrentEducation(input);
}

export async function updateEducation(educationId: string, input: unknown) {
  await requireMfaForAction();
  return await updateCurrentEducation(educationId, input);
}

export async function deleteEducation(educationId: string) {
  await requireMfaForAction();
  return await deleteCurrentEducation(educationId);
}
