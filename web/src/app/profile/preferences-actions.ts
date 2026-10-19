"use server";

import {
  addPreferenceLanguage,
  deletePreferenceLanguage,
  saveCurrentPreferences,
} from "@/lib/profiles/profile-preferences";

export async function savePreferences(input: unknown) {
  return await saveCurrentPreferences(input);
}

export async function addLanguage(input: unknown) {
  return await addPreferenceLanguage(input);
}

export async function deleteLanguage(languageId: string) {
  return await deletePreferenceLanguage(languageId);
}
