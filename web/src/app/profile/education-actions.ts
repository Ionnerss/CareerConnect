"use server";

import {
  addCurrentEducation,
  deleteCurrentEducation,
  updateCurrentEducation,
} from "@/lib/profiles/profile-education";

export async function addEducation(input: unknown) {
  return await addCurrentEducation(input);
}

export async function updateEducation(educationId: string, input: unknown) {
  return await updateCurrentEducation(educationId, input);
}

export async function deleteEducation(educationId: string) {
  return await deleteCurrentEducation(educationId);
}
