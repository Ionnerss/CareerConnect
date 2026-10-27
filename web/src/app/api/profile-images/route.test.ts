// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadProfileImage, type ProfileImageErrorCode, type ProfileImageResult } from "@/lib/profiles/profile-images";
import { POST } from "./route";

vi.mock("@/lib/profiles/profile-images", () => ({
    uploadProfileImage: vi.fn(),
}));

const mockUploadProfileImage = vi.mocked(uploadProfileImage);

function createFile() {
    return new File(
        [new Uint8Array([0xff, 0xd8, 0xff])],
        "test.jpg",
        { type: "image/jpeg" },
    );
}

function createRequest(formData: FormData) {
    return new Request("http://localhost/api/profile-images", {
        method: "POST",
        body: formData,
    });
}

function createUploadRequest(kind = "avatar") {
    const formData = new FormData();

    formData.set("kind", kind);
    formData.set("file", createFile());

    return createRequest(formData);
}

describe("POST /api/profile-images", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("rejects a malformed multipart body without calling the upload function", async () => {
        const request = new Request(
            "http://localhost/api/profile-images",
            {
                method: "POST",
                headers: {
                    // A multipart body requires a boundary.
                    "Content-Type": "multipart/form-data",
                },
                body: "invalid multipart body",
            },
        );

        const response = await POST(request);

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
            success: false,
            code: "INVALID_INPUT",
            error: "Invalid upload request.",
        });

        expect(mockUploadProfileImage).not.toHaveBeenCalled();
    });

    it.each(["avatar", "background"] as const)(
        "forwards the %s form fields and returns the successful result",
        async (kind) => {
            const column =
                kind === "avatar" ? "avatar_path" : "background_path";

            const result: ProfileImageResult = {
                success: true,
                profile: {
                    id: "test-user-id",
                    avatar_path: null,
                    background_path: null,
                    [column]: `test-user-id/${kind}/saved.jpg`,
                },
            };

            mockUploadProfileImage.mockResolvedValueOnce(result);

            const response = await POST(createUploadRequest(kind));

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );
            expect(await response.json()).toEqual(result);

            expect(mockUploadProfileImage).toHaveBeenCalledTimes(1);

            // Multipart parsing creates a new File, so check its contents
            // and metadata rather than comparing object identity.
            expect(mockUploadProfileImage).toHaveBeenCalledWith({
                kind,
                file: expect.any(File),
            });

            const submitted = mockUploadProfileImage.mock.calls[0][0] as {
                kind: string;
                file: File;
            };

            expect(submitted.file.name).toBe("test.jpg");
            expect(submitted.file.type).toBe("image/jpeg");
            expect(submitted.file.size).toBe(3);
            expect(
                new Uint8Array(await submitted.file.arrayBuffer()),
            ).toEqual(new Uint8Array([0xff, 0xd8, 0xff]));
        },
    );

    const failureCases: Array<{
        code: ProfileImageErrorCode;
        status: number;
    }> = [
        { code: "INVALID_INPUT", status: 400 },
        { code: "UNAUTHENTICATED", status: 401 },
        { code: "PROFILE_NOT_FOUND", status: 404 },
        { code: "PROFILE_CONFLICT", status: 409 },
        { code: "BACKEND_ERROR", status: 500 },
        { code: "OUTCOME_UNCERTAIN", status: 503 },
    ];

    it.each(failureCases)(
        "returns $status for $code and preserves the response body",
        async ({ code, status }) => {
            const result: ProfileImageResult = {
                success: false,
                code,
                error: `Test failure: ${code}`,
            };

            mockUploadProfileImage.mockResolvedValueOnce(result);

            const response = await POST(createUploadRequest());

            expect(response.status).toBe(status);
            expect(await response.json()).toEqual(result);
            expect(mockUploadProfileImage).toHaveBeenCalledTimes(1);
        },
    );

    it.each(["kind", "file", "both"] as const)(
        "passes null for missing fields: %s",
        async (missing) => {
            const formData = new FormData();

            if (missing !== "kind" && missing !== "both") {
                formData.set("kind", "avatar");
            }

            if (missing !== "file" && missing !== "both") {
                formData.set("file", createFile());
            }

            const result: ProfileImageResult = {
                success: false,
                code: "INVALID_INPUT",
                error: "Missing required upload fields.",
            };

            mockUploadProfileImage.mockResolvedValueOnce(result);

            const response = await POST(createRequest(formData));

            expect(response.status).toBe(400);
            expect(await response.json()).toEqual(result);

            expect(mockUploadProfileImage).toHaveBeenCalledTimes(1);
            expect(mockUploadProfileImage).toHaveBeenCalledWith({
                kind: missing === "kind" || missing === "both"
                    ? null
                    : "avatar",
                file: missing === "file" || missing === "both"
                    ? null
                    : expect.any(File),
            });
        },
    );
});