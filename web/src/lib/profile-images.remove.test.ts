import { beforeEach, describe, expect, it, vi } from "vitest";
import { removeProfileImage } from "./profile-images";

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    getUser: vi.fn(),
    profileFrom: vi.fn(),
    storageFrom: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    remove: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
    createClient: mocks.createClient,
}));

const userId = "test-user-id";

const existingProfile = {
    id: userId,
    avatar_path: `${userId}/avatar/old.jpg`,
    background_path: `${userId}/background/old.jpg`,
};

function queueRead(
    data: typeof existingProfile | null = existingProfile,
    error: Error | null = null,
) {
    mocks.maybeSingle.mockResolvedValueOnce({ data, error });
}

function queueUpdateFailure() {
    mocks.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: new Error("Update response failed"),
    });
}

function expectNoStorage() {
    expect(mocks.storageFrom).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
}

describe("removeProfileImage", () => {
    beforeEach(() => {
        vi.resetAllMocks();

        const query = {
            select: mocks.select,
            update: mocks.update,
            eq: mocks.eq,
            maybeSingle: mocks.maybeSingle,
        };

        mocks.profileFrom.mockReturnValue(query);
        mocks.select.mockReturnValue(query);
        mocks.update.mockReturnValue(query);
        mocks.eq.mockReturnValue(query);

        mocks.storageFrom.mockReturnValue({
            remove: mocks.remove,
        });

        mocks.getUser.mockResolvedValue({
            data: { user: { id: userId } },
            error: null,
        });

        mocks.createClient.mockResolvedValue({
            auth: { getUser: mocks.getUser },
            from: mocks.profileFrom,
            storage: { from: mocks.storageFrom },
        });

        mocks.remove.mockResolvedValue({
            data: [],
            error: null,
        });
    });

    it.each([
        undefined,
        null,
        {},
        { kind: "cover" },
        { kind: 123 },
    ])("rejects invalid input: %j", async (input) => {
        const result = await removeProfileImage(input);

        expect(result).toEqual({
            success: false,
            code: "INVALID_INPUT",
            error: "Please choose avatar or background.",
        });

        expect(mocks.createClient).not.toHaveBeenCalled();
        expect(mocks.profileFrom).not.toHaveBeenCalled();
        expectNoStorage();
    });

    it.each([
        ["authentication error", new Error("Auth failed")],
        ["missing user", null],
    ])("rejects %s", async (_name, error) => {
        mocks.getUser.mockResolvedValueOnce({
            data: { user: null },
            error,
        });

        const result = await removeProfileImage({ kind: "avatar" });

        expect(result).toEqual({
            success: false,
            code: "UNAUTHENTICATED",
            error: "Unable to authenticate. Please sign in again.",
        });

        expect(mocks.profileFrom).not.toHaveBeenCalled();
        expectNoStorage();
    });

    it("stops when the initial profile read fails", async () => {
        queueRead(null, new Error("Read failed"));

        const result = await removeProfileImage({ kind: "avatar" });

        expect(result).toMatchObject({
            success: false,
            code: "BACKEND_ERROR",
        });

        expect(mocks.update).not.toHaveBeenCalled();
        expectNoStorage();
    });

    it("stops when the profile does not exist", async () => {
        queueRead(null);

        const result = await removeProfileImage({ kind: "avatar" });

        expect(result).toEqual({
            success: false,
            code: "PROFILE_NOT_FOUND",
            error: "Profile not found.",
        });

        expect(mocks.update).not.toHaveBeenCalled();
        expectNoStorage();
    });

    it.each(["avatar", "background"] as const)(
        "succeeds without writing when %s is already empty",
        async (kind) => {
            const column =
                kind === "avatar" ? "avatar_path" : "background_path";

            const emptyProfile = {
                ...existingProfile,
                [column]: null,
            };

            mocks.maybeSingle.mockResolvedValueOnce({
                data: emptyProfile,
                error: null,
            });

            const result = await removeProfileImage({ kind });

            expect(result).toEqual({
                success: true,
                profile: emptyProfile,
            });

            expect(mocks.update).not.toHaveBeenCalled();
            expectNoStorage();
        },
    );

    it.each(["avatar", "background"] as const)(
        "removes %s while preserving the other image",
        async (kind) => {
            const column =
                kind === "avatar" ? "avatar_path" : "background_path";
            const oldPath = existingProfile[column];

            const savedProfile = {
                ...existingProfile,
                [column]: null,
            };

            queueRead();

            mocks.maybeSingle.mockResolvedValueOnce({
                data: savedProfile,
                error: null,
            });

            const result = await removeProfileImage({ kind });

            expect(mocks.profileFrom).toHaveBeenCalledWith("profiles");
            expect(mocks.eq).toHaveBeenCalledWith("id", userId);
            expect(mocks.eq).toHaveBeenCalledWith(column, oldPath);

            // Only the selected column may change.
            expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
                [column]: null,
            });

            expect(mocks.storageFrom).toHaveBeenCalledWith(
                "profile-images",
            );
            expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([
                oldPath,
            ]);

            // Storage deletion must happen after the database update.
            expect(
                mocks.remove.mock.invocationCallOrder[0],
            ).toBeGreaterThan(
                mocks.maybeSingle.mock.invocationCallOrder[1],
            );

            expect(result).toEqual({
                success: true,
                profile: savedProfile,
            });
        },
    );

    it("uses the authenticated identity and stored path", async () => {
        queueRead();

        const savedProfile = {
            ...existingProfile,
            avatar_path: null,
        };

        mocks.maybeSingle.mockResolvedValueOnce({
            data: savedProfile,
            error: null,
        });

        await removeProfileImage({
            kind: "avatar",
            id: "another-user",
            path: "another-user/avatar/private.jpg",
            role: "admin",
        });

        expect(mocks.eq).toHaveBeenCalledWith("id", userId);
        expect(mocks.eq).not.toHaveBeenCalledWith(
            "id",
            "another-user",
        );

        expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
            avatar_path: null,
        });

        expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([
            existingProfile.avatar_path,
        ]);
    });

    it.each([
        ["update error", new Error("Response lost")],
        ["update returns no row", null],
    ])(
        "recovers confirmed removal after %s",
        async (_name, updateError) => {
            queueRead();

            mocks.maybeSingle.mockResolvedValueOnce({
                data: null,
                error: updateError,
            });

            const savedProfile = {
                ...existingProfile,
                avatar_path: null,
            };

            mocks.maybeSingle.mockResolvedValueOnce({
                data: savedProfile,
                error: null,
            });

            const result = await removeProfileImage({
                kind: "avatar",
            });

            expect(result).toEqual({
                success: true,
                profile: savedProfile,
            });

            expect(mocks.maybeSingle).toHaveBeenCalledTimes(3);
            expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([
                existingProfile.avatar_path,
            ]);

            // Cleanup waits for the recovery read.
            expect(
                mocks.remove.mock.invocationCallOrder[0],
            ).toBeGreaterThan(
                mocks.maybeSingle.mock.invocationCallOrder[2],
            );
        },
    );

    it("keeps the file when the recovery read fails", async () => {
        queueRead();
        queueUpdateFailure();
        queueRead(null, new Error("Recovery failed"));

        const result = await removeProfileImage({ kind: "avatar" });

        expect(result).toEqual({
            success: false,
            code: "OUTCOME_UNCERTAIN",
            error: "Could not confirm whether your image was removed. Please refresh your profile.",
        });

        expectNoStorage();
    });

    it("keeps the file when recovery still shows the old path", async () => {
        queueRead();
        queueUpdateFailure();
        queueRead();

        const result = await removeProfileImage({ kind: "avatar" });

        expect(result).toEqual({
            success: false,
            code: "BACKEND_ERROR",
            error: "Unable to remove your profile image. Please try again.",
        });

        expectNoStorage();
    });

    it("preserves a competing upload and reports a conflict", async () => {
        queueRead();

        // The conditional update matched no row.
        mocks.maybeSingle.mockResolvedValueOnce({
            data: null,
            error: null,
        });

        queueRead({
            ...existingProfile,
            avatar_path: `${userId}/avatar/newer.jpg`,
        });

        const result = await removeProfileImage({ kind: "avatar" });

        expect(result).toEqual({
            success: false,
            code: "PROFILE_CONFLICT",
            error: "Your profile image changed during removal. Please refresh your profile before trying again.",
        });

        expect(mocks.eq).toHaveBeenCalledWith(
            "avatar_path",
            existingProfile.avatar_path,
        );
        expect(mocks.update).toHaveBeenCalledTimes(1);
        expectNoStorage();
    });

    it("handles a profile disappearing during recovery", async () => {
        queueRead();
        queueUpdateFailure();
        queueRead(null);

        const result = await removeProfileImage({ kind: "avatar" });

        expect(result).toEqual({
            success: false,
            code: "PROFILE_NOT_FOUND",
            error: "Profile not found.",
        });

        expectNoStorage();
    });

    it.each(["returned error", "thrown error"] as const)(
        "preserves success when cleanup produces a %s",
        async (failureKind) => {
            queueRead();

            const savedProfile = {
                ...existingProfile,
                avatar_path: null,
            };

            mocks.maybeSingle.mockResolvedValueOnce({
                data: savedProfile,
                error: null,
            });

            const cleanupError = new Error("Storage unavailable");

            if (failureKind === "returned error") {
                mocks.remove.mockResolvedValueOnce({
                    data: null,
                    error: cleanupError,
                });
            } else {
                mocks.remove.mockRejectedValueOnce(cleanupError);
            }

            const logSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});

            try {
                const result = await removeProfileImage({
                    kind: "avatar",
                });

                expect(result).toEqual({
                    success: true,
                    profile: savedProfile,
                });

                expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([
                    existingProfile.avatar_path,
                ]);
                expect(logSpy).toHaveBeenCalledWith(
                    expect.any(String),
                    cleanupError,
                );

                // No attempt to restore the deleted database reference.
                expect(mocks.update).toHaveBeenCalledTimes(1);
            } finally {
                logSpy.mockRestore();
            }
        },
    );

    it.each([
        "another-user/avatar/old.jpg",
        `${userId}/background/old.jpg`,
    ])(
        "clears an invalid avatar reference without deleting %s",
        async (oldPath) => {
            queueRead({
                ...existingProfile,
                avatar_path: oldPath,
            });

            const savedProfile = {
                ...existingProfile,
                avatar_path: null,
            };

            mocks.maybeSingle.mockResolvedValueOnce({
                data: savedProfile,
                error: null,
            });

            const result = await removeProfileImage({
                kind: "avatar",
            });

            expect(result).toEqual({
                success: true,
                profile: savedProfile,
            });

            expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
                avatar_path: null,
            });
            expectNoStorage();
        },
    );
});