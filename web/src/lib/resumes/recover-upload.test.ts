import { describe, expect, it, vi } from "vitest";
import { recoverResumeSaveOutcome } from "./recover-upload";

describe("resume save recovery", () => {
  it("confirms the save when matching metadata exists", async () => {
    const verifyMetadata = vi.fn().mockResolvedValue({
      data: { id: 1 },
      error: null,
    });

    await expect(
      recoverResumeSaveOutcome(verifyMetadata),
    ).resolves.toEqual({
      status: "saved",
      shouldDelete: false,
    });

    expect(verifyMetadata).toHaveBeenCalledOnce();
  });

  it("keeps the file when no matching row is found", async () => {
    const verifyMetadata = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      recoverResumeSaveOutcome(verifyMetadata),
    ).resolves.toEqual({
      status: "uncertain",
      shouldDelete: false,
    });
  });

  it("keeps the file when verification fails", async () => {
    const verifyMetadata = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("verification failed"),
    });

    await expect(
      recoverResumeSaveOutcome(verifyMetadata),
    ).resolves.toEqual({
      status: "uncertain",
      shouldDelete: false,
    });
  });

  it("keeps the file when verification throws", async () => {
    const verifyMetadata = vi
      .fn()
      .mockRejectedValue(new Error("network failure"));

    await expect(
      recoverResumeSaveOutcome(verifyMetadata),
    ).resolves.toEqual({
      status: "uncertain",
      shouldDelete: false,
    });
  });
});