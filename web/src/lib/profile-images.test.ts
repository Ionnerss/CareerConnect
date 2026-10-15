import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadProfileImage } from "./profile-images";

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    getUser: vi.fn(),
    profileFrom: vi.fn(),
    storageFrom: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn(),
    upload: vi.fn(),
    remove: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
    createClient: mocks.createClient,
}));

type ImagePaths = {
    avatar_path: string | null;
    background_path: string | null;
};

type ImageKind = "avatar" | "background";

const userId = "test-user-id";

const emptyPaths: ImagePaths = {
    avatar_path: null,
    background_path: null,
};

// These fixtures exercise signature checks, not complete image decoding.
function jpegFile() {
    return new File(
        [new Uint8Array([0xff, 0xd8, 0xff])],
        "test.jpg",
        { type: "image/jpeg" },
    );
}

function queueExistingProfile(paths: ImagePaths = emptyPaths) {
    mocks.maybeSingle.mockResolvedValueOnce({
        data: { ...paths },
        error: null,
    });
}

function uploadedPath(): string {
    const path: unknown = mocks.upload.mock.calls[0]?.[0];

    if (typeof path !== "string") {
        throw new Error("Expected an uploaded file path.");
    }

    return path;
}

function queueSavedProfile(
    kind: ImageKind = "avatar",
    paths: ImagePaths = emptyPaths,
) {
    mocks.maybeSingle.mockImplementationOnce(async () => ({
        data: {
            id: userId,
            ...paths,
            [kind === "avatar" ? "avatar_path" : "background_path"]:
                uploadedPath(),
        },
        error: null,
    }));
}

function expectNoDatabaseOrStorage() {
    expect(mocks.profileFrom).not.toHaveBeenCalled();
    expect(mocks.storageFrom).not.toHaveBeenCalled();
}

describe("uploadProfileImage", () => {
    beforeEach(() => {
        vi.resetAllMocks();

        const query = {
            select: mocks.select,
            update: mocks.update,
            eq: mocks.eq,
            is: mocks.is,
            maybeSingle: mocks.maybeSingle,
        };

        mocks.profileFrom.mockReturnValue(query);
        mocks.select.mockReturnValue(query);
        mocks.update.mockReturnValue(query);
        mocks.eq.mockReturnValue(query);
        mocks.is.mockReturnValue(query);

        mocks.storageFrom.mockReturnValue({
            upload: mocks.upload,
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

        mocks.upload.mockResolvedValue({
            data: { path: "uploaded" },
            error: null,
        });

        mocks.remove.mockResolvedValue({
            data: [],
            error: null,
        });
    });

    it("rejects invalid input before creating a client", async () => {
        const result = await uploadProfileImage({ kind: "avatar" });

        expect(result).toEqual({
            success: false,
            code: "INVALID_INPUT",
            error: "Please choose a nonempty JPEG, PNG, or WebP image of 5 MiB or smaller.",
        });

        expect(mocks.createClient).not.toHaveBeenCalled();
        expect(mocks.getUser).not.toHaveBeenCalled();
        expectNoDatabaseOrStorage();
    });

    it("rejects an invalid image signature", async () => {
        const file = new File(
            [new Uint8Array([1, 2, 3])],
            "bad.jpg",
            { type: "image/jpeg" },
        );

        const result = await uploadProfileImage({
            kind: "avatar",
            file,
        });

        expect(result).toEqual({
            success: false,
            code: "INVALID_INPUT",
            error: "Invalid image. Please try a different image.",
        });

        expect(mocks.getUser).toHaveBeenCalledTimes(1);
        expectNoDatabaseOrStorage();
    });

    it("handles an unreadable image", async () => {
        const file = jpegFile();
        const sliceSpy = vi.spyOn(file, "slice").mockImplementation(() => {
            throw new Error("Read failed");
        });

        try {
            const result = await uploadProfileImage({
                kind: "avatar",
                file,
            });

            expect(result).toEqual({
                success: false,
                code: "INVALID_INPUT",
                error: "Unable to read your image. Please try a different image.",
            });

            expectNoDatabaseOrStorage();
        } finally {
            sliceSpy.mockRestore();
        }
    });

    it.each([
        ["authentication error", new Error("Auth failed")],
        ["missing user", null],
    ])("rejects %s", async (_label, authError) => {
        mocks.getUser.mockResolvedValueOnce({
            data: { user: null },
            error: authError,
        });

        const result = await uploadProfileImage({
            kind: "avatar",
            file: jpegFile(),
        });

        expect(result).toEqual({
            success: false,
            code: "UNAUTHENTICATED",
            error: "Unable to authenticate. Please sign in again.",
        });

        expect(mocks.getUser).toHaveBeenCalledTimes(1);
        expectNoDatabaseOrStorage();
    });

    it.each([
        {
            name: "initial profile read fails",
            databaseError: new Error("Read failed"),
            code: "BACKEND_ERROR",
            message: "Could not load your profile. Please try again.",
        },
        {
            name: "initial profile is missing",
            databaseError: null,
            code: "PROFILE_NOT_FOUND",
            message: "Profile not found.",
        },
    ])("$name", async ({ databaseError, code, message }) => {
        mocks.maybeSingle.mockResolvedValueOnce({
            data: null,
            error: databaseError,
        });

        const result = await uploadProfileImage({
            kind: "avatar",
            file: jpegFile(),
        });

        expect(result).toEqual({
            success: false,
            code,
            error: message,
        });

        expect(mocks.profileFrom).toHaveBeenCalledWith("profiles");
        expect(mocks.eq).toHaveBeenCalledWith("id", userId);
        expect(mocks.storageFrom).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it("stops when Storage upload fails", async () => {
        queueExistingProfile();

        mocks.upload.mockResolvedValueOnce({
            data: null,
            error: new Error("Upload failed"),
        });

        const result = await uploadProfileImage({
            kind: "avatar",
            file: jpegFile(),
        });

        expect(result).toEqual({
            success: false,
            code: "BACKEND_ERROR",
            error: "Unable to upload your image. Please try again.",
        });

        expect(mocks.storageFrom).toHaveBeenCalledWith("profile-images");
        expect(mocks.upload).toHaveBeenCalledTimes(1);
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.remove).not.toHaveBeenCalled();
    });

    it.each(["avatar", "background"] as const)(
        "saves a new %s image",
        async (kind) => {
            queueExistingProfile();
            queueSavedProfile(kind);

            const file = jpegFile();
            const result = await uploadProfileImage({ kind, file });
            const path = uploadedPath();
            const column =
                kind === "avatar" ? "avatar_path" : "background_path";

            expect(path).toMatch(
                new RegExp(
                    `^${userId}/${kind}/` +
                        "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-" +
                        "[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.jpg$",
                ),
            );

            expect(mocks.upload).toHaveBeenCalledExactlyOnceWith(
                path,
                file,
                {
                    contentType: "image/jpeg",
                    upsert: false,
                },
            );

            expect(mocks.profileFrom).toHaveBeenCalledWith("profiles");
            expect(mocks.storageFrom).toHaveBeenCalledWith("profile-images");
            expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
                [column]: path,
            });
            expect(mocks.eq).toHaveBeenCalledWith("id", userId);
            expect(mocks.is).toHaveBeenCalledWith(column, null);

            expect(result).toEqual({
                success: true,
                profile: {
                    id: userId,
                    ...emptyPaths,
                    [column]: path,
                },
            });

            expect(mocks.remove).not.toHaveBeenCalled();
        },
    );

    it("removes the old image after the new image is saved", async () => {
        const oldPath = `${userId}/avatar/old.jpg`;

        queueExistingProfile({
            ...emptyPaths,
            avatar_path: oldPath,
        });
        queueSavedProfile();

        const result = await uploadProfileImage({
            kind: "avatar",
            file: jpegFile(),
        });

        expect(result.success).toBe(true);
        expect(mocks.eq).toHaveBeenCalledWith("avatar_path", oldPath);
        expect(mocks.is).not.toHaveBeenCalled();
        expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([oldPath]);

        expect(mocks.remove.mock.invocationCallOrder[0]).toBeGreaterThan(
            mocks.maybeSingle.mock.invocationCallOrder[1],
        );
    });

    it("recovers a confirmed save and cleans up the old image", async () => {
        const oldPath = `${userId}/avatar/old.jpg`;

        queueExistingProfile({
            ...emptyPaths,
            avatar_path: oldPath,
        });

        mocks.maybeSingle.mockResolvedValueOnce({
            data: null,
            error: new Error("Update response failed"),
        });

        // The recovery read confirms the new path was saved.
        queueSavedProfile();

        const result = await uploadProfileImage({
            kind: "avatar",
            file: jpegFile(),
        });

        expect(result).toEqual({
            success: true,
            profile: {
                id: userId,
                ...emptyPaths,
                avatar_path: uploadedPath(),
            },
        });

        expect(mocks.maybeSingle).toHaveBeenCalledTimes(3);
        expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([oldPath]);
    });

    it("removes the new upload when the save failed", async () => {
        queueExistingProfile();

        mocks.maybeSingle
            .mockResolvedValueOnce({
                data: null,
                error: new Error("Update failed"),
            })
            .mockResolvedValueOnce({
                data: { id: userId, ...emptyPaths },
                error: null,
            });

        const result = await uploadProfileImage({
            kind: "avatar",
            file: jpegFile(),
        });

        expect(result).toEqual({
            success: false,
            code: "BACKEND_ERROR",
            error: "Your image could not be saved. Please refresh your profile before trying again.",
        });

        expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([
            uploadedPath(),
        ]);
    });

    it("keeps files when the recovery read fails", async () => {
        queueExistingProfile({
            ...emptyPaths,
            avatar_path: `${userId}/avatar/old.jpg`,
        });

        mocks.maybeSingle
            .mockResolvedValueOnce({
                data: null,
                error: new Error("Update response failed"),
            })
            .mockResolvedValueOnce({
                data: null,
                error: new Error("Recovery read failed"),
            });

        const result = await uploadProfileImage({
            kind: "avatar",
            file: jpegFile(),
        });

        expect(result).toEqual({
            success: false,
            code: "OUTCOME_UNCERTAIN",
            error: "Could not confirm whether your image was saved. Please refresh your profile.",
        });

        expect(mocks.remove).not.toHaveBeenCalled();
    });

    it("reports a conflict and removes only this request's upload", async () => {
        const oldPath = `${userId}/avatar/old.jpg`;
        const competingPath = `${userId}/avatar/another-upload.jpg`;

        queueExistingProfile({
            ...emptyPaths,
            avatar_path: oldPath,
        });

        mocks.maybeSingle
            .mockResolvedValueOnce({
                data: null,
                error: null,
            })
            .mockResolvedValueOnce({
                data: {
                    id: userId,
                    ...emptyPaths,
                    avatar_path: competingPath,
                },
                error: null,
            });

        const result = await uploadProfileImage({
            kind: "avatar",
            file: jpegFile(),
        });

        expect(result).toEqual({
            success: false,
            code: "PROFILE_CONFLICT",
            error: "Your profile image changed during this upload. Please refresh your profile before trying again.",
        });

        expect(mocks.eq).toHaveBeenCalledWith("avatar_path", oldPath);
        expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([
            uploadedPath(),
        ]);
    });

    it("handles a profile missing during recovery", async () => {
        queueExistingProfile();

        mocks.maybeSingle
            .mockResolvedValueOnce({ data: null, error: null })
            .mockResolvedValueOnce({ data: null, error: null });

        const result = await uploadProfileImage({
            kind: "avatar",
            file: jpegFile(),
        });

        expect(result).toEqual({
            success: false,
            code: "PROFILE_NOT_FOUND",
            error: "Profile not found.",
        });

        expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([
            uploadedPath(),
        ]);
    });

    it("reports failure to clean up an unused upload", async () => {
        queueExistingProfile();

        mocks.maybeSingle
            .mockResolvedValueOnce({
                data: null,
                error: new Error("Update failed"),
            })
            .mockResolvedValueOnce({
                data: { id: userId, ...emptyPaths },
                error: null,
            });

        const cleanupError = new Error("Cleanup failed");

        mocks.remove.mockResolvedValueOnce({
            data: null,
            error: cleanupError,
        });

        const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        try {
            const result = await uploadProfileImage({
                kind: "avatar",
                file: jpegFile(),
            });

            expect(result).toEqual({
                success: false,
                code: "BACKEND_ERROR",
                error: "Your image could not be saved or cleaned up. Please try again later.",
            });

            expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([
                uploadedPath(),
            ]);
            expect(logSpy).toHaveBeenCalledWith(
                "Failed to remove unused profile image:",
                cleanupError,
            );
        } finally {
            logSpy.mockRestore();
        }
    });

    it("preserves success when old-image cleanup fails", async () => {
        const oldPath = `${userId}/avatar/old.jpg`;

        queueExistingProfile({
            ...emptyPaths,
            avatar_path: oldPath,
        });
        queueSavedProfile();

        const cleanupError = new Error("Cleanup failed");

        mocks.remove.mockResolvedValueOnce({
            data: null,
            error: cleanupError,
        });

        const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        try {
            const result = await uploadProfileImage({
                kind: "avatar",
                file: jpegFile(),
            });

            expect(result).toEqual({
                success: true,
                profile: {
                    id: userId,
                    ...emptyPaths,
                    avatar_path: uploadedPath(),
                },
            });

            expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([oldPath]);
            expect(logSpy).toHaveBeenCalledWith(
                "Failed to remove previous profile image:",
                cleanupError,
            );
        } finally {
            logSpy.mockRestore();
        }
    });

    it.each([
        "another-user/avatar/old.jpg",
        `${userId}/background/old.jpg`,
    ])("does not clean up an unrelated old path: %s", async (oldPath) => {
        queueExistingProfile({
            ...emptyPaths,
            avatar_path: oldPath,
        });
        queueSavedProfile();

        const result = await uploadProfileImage({
            kind: "avatar",
            file: jpegFile(),
        });

        expect(result.success).toBe(true);
        expect(mocks.remove).not.toHaveBeenCalled();
    });

    it.each([
        {
            label: "PNG",
            mime: "image/png",
            extension: "png",
            bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
        },
        {
            label: "WebP",
            mime: "image/webp",
            extension: "webp",
            bytes: [
                82, 73, 70, 70, // RIFF
                4, 0, 0, 0,    // Size field
                87, 69, 66, 80, // WEBP
            ],
        },
    ])(
        "accepts a matching $label signature",
        async ({ mime, extension, bytes }) => {
            queueExistingProfile();
            queueSavedProfile();

            const file = new File(
                [new Uint8Array(bytes)],
                `test.${extension}`,
                { type: mime },
            );

            const result = await uploadProfileImage({
                kind: "avatar",
                file,
            });

            const path = uploadedPath();

            expect(result.success).toBe(true);
            expect(path.startsWith(`${userId}/avatar/`)).toBe(true);
            expect(path.endsWith(`.${extension}`)).toBe(true);

            expect(mocks.upload).toHaveBeenCalledExactlyOnceWith(
                path,
                file,
                {
                    contentType: mime,
                    upsert: false,
                },
            );

            expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
                avatar_path: path,
            });
        },
    );

    it.each([
        {
            label: "truncated PNG",
            mime: "image/png",
            bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a],
        },
        {
            label: "PNG with incorrect final signature byte",
            mime: "image/png",
            bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x00],
        },
        {
            label: "truncated WebP",
            mime: "image/webp",
            bytes: [82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66],
        },
        {
            label: "WebP with incorrect RIFF marker",
            mime: "image/webp",
            bytes: [0, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80],
        },
        {
            label: "WebP with incorrect WEBP marker",
            mime: "image/webp",
            bytes: [82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 0],
        },
        {
            label: "PNG bytes declared as WebP",
            mime: "image/webp",
            bytes: [
                0x89, 0x50, 0x4e, 0x47,
                0x0d, 0x0a, 0x1a, 0x0a,
                0, 0, 0, 0,
            ],
        },
        {
            label: "WebP bytes declared as PNG",
            mime: "image/png",
            bytes: [82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80],
        },
    ])("rejects $label before database or Storage access", async ({
        mime,
        bytes,
    }) => {
        const file = new File(
            [new Uint8Array(bytes)],
            "invalid-image",
            { type: mime },
        );

        const result = await uploadProfileImage({
            kind: "avatar",
            file,
        });

        expect(result).toEqual({
            success: false,
            code: "INVALID_INPUT",
            error: "Invalid image. Please try a different image.",
        });

        expect(mocks.getUser).toHaveBeenCalledTimes(1);
        expectNoDatabaseOrStorage();
    });

    it.each(["avatar", "background"] as const)(
        "replaces %s without changing or deleting the other image",
        async (kind) => {
            const paths: ImagePaths = {
                avatar_path: `${userId}/avatar/existing.jpg`,
                background_path: `${userId}/background/existing.jpg`,
            };

            const column =
                kind === "avatar" ? "avatar_path" : "background_path";

            const otherColumn =
                kind === "avatar" ? "background_path" : "avatar_path";

            const oldPath = paths[column];

            queueExistingProfile(paths);
            queueSavedProfile(kind, paths);

            const result = await uploadProfileImage({
                kind,
                file: jpegFile(),
            });

            const newPath = uploadedPath();

            expect(newPath).not.toBe(oldPath);
            expect(newPath.startsWith(`${userId}/${kind}/`)).toBe(true);

            // The update must contain only the selected image column.
            expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
                [column]: newPath,
            });

            expect(mocks.eq).toHaveBeenCalledWith("id", userId);
            expect(mocks.eq).toHaveBeenCalledWith(column, oldPath);
            expect(mocks.is).not.toHaveBeenCalled();

            // Delete only the replaced image.
            expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([
                oldPath,
            ]);

            expect(mocks.remove).not.toHaveBeenCalledWith([
                paths[otherColumn],
            ]);

            expect(
                mocks.remove.mock.invocationCallOrder[0],
            ).toBeGreaterThan(
                mocks.maybeSingle.mock.invocationCallOrder[1],
            );

            expect(result).toEqual({
                success: true,
                profile: {
                    id: userId,
                    ...paths,
                    [column]: newPath,
                },
            });
        },
    );
});