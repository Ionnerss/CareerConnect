export type ResumeSaveRecovery =
  | { status: "saved"; shouldDelete: false }
  | { status: "uncertain"; shouldDelete: false };

type VerifyResult = {
  data: { id: number } | null;
  error: unknown | null;
};

export async function recoverResumeSaveOutcome(
  verifyMetadata: () => Promise<VerifyResult>,
): Promise<ResumeSaveRecovery> {
  try {
    const { data, error } = await verifyMetadata();

    if (error || !data) {
      return { status: "uncertain", shouldDelete: false };
    }

    return { status: "saved", shouldDelete: false };
  } catch {
    return { status: "uncertain", shouldDelete: false };
  }
}