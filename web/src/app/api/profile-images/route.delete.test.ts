// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { removeProfileImage, type ProfileImageErrorCode, type ProfileImageResult } from "@/lib/profile-images";
import { DELETE } from "./route";

vi.mock("@/lib/profile-images", () => ({
    uploadProfileImage: vi.fn(),
    removeProfileImage: vi.fn(),
}));

const mockRemoveProfileImage = vi.mocked(removeProfileImage);

function createRequest(input: unknown) {
    return new Request("http://localhost/api/profile-images", {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
    });
}

describe("DELETE /api/profile-images", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it.each(["", "{invalid-json"])(
        "rejects an invalid JSON body: %j",
        async (body) => {
            const request = new Request(
                "http://localhost/api/profile-images",
                {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body,
                },
            );

            const response = await DELETE(request);

            expect(response.status).toBe(400);
            expect(await response.json()).toEqual({
                success: false,
                code: "INVALID_INPUT",
                error: "Please send a valid JSON body containing kind.",
            });

            expect(mockRemoveProfileImage).not.toHaveBeenCalled();
        },
    );

    it.each(["avatar", "background"] as const)(
        "forwards %s removal and returns the saved profile",
        async (kind) => {
            const column =
                kind === "avatar" ? "avatar_path" : "background_path";

            const result: ProfileImageResult = {
                success: true,
                profile: {
                    id: "test-user-id",
                    avatar_path: "test-user-id/avatar/old.jpg",
                    background_path: "test-user-id/background/old.jpg",
                    [column]: null,
                },
            };

            mockRemoveProfileImage.mockResolvedValueOnce(result);

            const response = await DELETE(createRequest({ kind }));

            expect(mockRemoveProfileImage)
                .toHaveBeenCalledExactlyOnceWith({ kind });

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain(
                "application/json",
            );
            expect(await response.json()).toEqual(result);
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
        "returns $status for $code",
        async ({ code, status }) => {
            const result: ProfileImageResult = {
                success: false,
                code,
                error: "Removal failed.",
            };

            mockRemoveProfileImage.mockResolvedValueOnce(result);

            const response = await DELETE(
                createRequest({ kind: "avatar" }),
            );

            expect(response.status).toBe(status);
            expect(await response.json()).toEqual(result);
            expect(mockRemoveProfileImage)
                .toHaveBeenCalledExactlyOnceWith({
                    kind: "avatar",
                });
        },
    );

    it.each([null, {}, { kind: "cover" }])(
        "delegates input validation to the service: %j",
        async (input) => {
            mockRemoveProfileImage.mockResolvedValueOnce({
                success: false,
                code: "INVALID_INPUT",
                error: "Please choose avatar or background.",
            });

            const response = await DELETE(createRequest(input));

            expect(response.status).toBe(400);
            expect(mockRemoveProfileImage)
                .toHaveBeenCalledExactlyOnceWith(input);
        },
    );
});