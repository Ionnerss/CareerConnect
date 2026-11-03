"use server";

import { MfaActionError } from "@/lib/auth/require-mfa";
import {
  archiveResume, unarchiveResume, downloadResume, viewResume,
  renameResume, replaceResume, deleteResume,
} from "./resume_actions_logic";

type ActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: "UNAUTHENTICATED" | "MFA_REQUIRED" | "AUTH_UNAVAILABLE" | "OPERATION_FAILED"; message: string };

async function resultOf<T>(action: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, value: await action() };
  } catch (error) {
    if (error instanceof MfaActionError) {
      return { ok: false, code: error.code, message: error.message };
    }
    return { ok: false, code: "OPERATION_FAILED", message: "Unable to complete this resume operation. Refresh and retry." };
  }
}

export async function safeArchiveResume(id: string) { return resultOf(() => archiveResume(id)); }
export async function safeUnarchiveResume(id: string) { return resultOf(() => unarchiveResume(id)); }
export async function safeDownloadResume(id: string) { return resultOf(() => downloadResume(id)); }
export async function safeViewResume(id: string) { return resultOf(() => viewResume(id)); }
export async function safeRenameResume(id: string, name: string) { return resultOf(() => renameResume(id, name)); }
export async function safeReplaceResume(id: string, data: FormData) { return resultOf(() => replaceResume(id, data)); }
export async function safeDeleteResume(id: string) { return resultOf(() => deleteResume(id)); }
