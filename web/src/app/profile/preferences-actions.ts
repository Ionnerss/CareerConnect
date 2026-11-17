"use server";

import { requireMfaForAction } from "@/lib/auth/require-mfa";

import {
  addPreferenceLanguage,
  deletePreferenceLanguage,
  saveCurrentPreferences,
} from "@/lib/profiles/profile-preferences";

export async function savePreferences(input: unknown) {
  await requireMfaForAction();
  return await saveCurrentPreferences(input);
}

export async function addLanguage(input: unknown) {
  await requireMfaForAction();
  return await addPreferenceLanguage(input);
}

export async function deleteLanguage(languageId: string) {
  await requireMfaForAction();
  return await deletePreferenceLanguage(languageId);
}
