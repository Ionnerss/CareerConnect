import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    deleteProjectImage,
    uploadProjectImage,
} from "@/lib/profiles/profile-project-images";
import { DELETE, POST } from "./route";

vi.mock("@/lib/profiles/profile-project-images", () => ({
    uploadProjectImage: vi.fn(),
    deleteProjectImage: vi.fn(),
}));

const projectId = "11111111-1111-4111-8111-111111111111";
const imageId = "22222222-2222-4222-8222-222222222222";

function postRequest() {
    const formData = new FormData();

    formData.set("projectId", projectId);
    formData.set(
        "file",
        new File(
            [new Uint8Array([0xff, 0xd8, 0xff])],
            "test.jpg",
            { type: "image/jpeg" },
        ),
    );
    formData.set("alt_text", "Project screenshot");

    return new Request("http://localhost/api/project-images", {
        method: "POST",
        body: formData,
    });
}

function deleteRequest(body: unknown) {
    return new Request("http://localhost/api/project-images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.resetAllMocks();
});

describe("POST /api/project-images", () => {
    it("passes form data to the upload service", async () => {
        const result = {
            success: true,
            image: { id: imageId, project_id: projectId },
        };

        vi.mocked(uploadProjectImage).mockResolvedValue(
            result as never,
        );

        const response = await POST(postRequest());

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(result);

        expect(uploadProjectImage).toHaveBeenCalledOnce();

        const input = vi.mocked(uploadProjectImage).mock.calls[0][0];

        expect(input).toMatchObject({
            projectId,
            alt_text: "Project screenshot",
        });
        expect((input as { file: File }).file).toBeInstanceOf(
            File,
        );
    });

    it("returns 400 for malformed multipart data", async () => {
        const request = new Request(
            "http://localhost/api/project-images",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "multipart/form-data; boundary=missing",
                },
                body: "not a valid multipart body",
            },
        );

        const response = await POST(request);

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
            success: false,
            code: "INVALID_INPUT",
        });
        expect(uploadProjectImage).not.toHaveBeenCalled();
    });

    it("passes missing fields to service validation", async () => {
        const formData = new FormData();
        formData.set("projectId", projectId);

        vi.mocked(uploadProjectImage).mockResolvedValue({
            success: false,
            code: "INVALID_INPUT",
            error: "Choose an image.",
        } as never);

        const response = await POST(
            new Request("http://localhost/api/project-images", {
                method: "POST",
                body: formData,
            }),
        );

        expect(response.status).toBe(400);
        expect(uploadProjectImage).toHaveBeenCalledWith({
            projectId,
            file: null,
            alt_text: null,
        });
    });

    it.each([
        ["INVALID_INPUT", 400],
        ["UNAUTHENTICATED", 401],
        ["PROJECT_NOT_FOUND", 404],
        ["OUTCOME_UNCERTAIN", 503],
        ["BACKEND_ERROR", 500],
    ])("maps %s to HTTP %i", async (code, status) => {
        vi.mocked(uploadProjectImage).mockResolvedValue({
            success: false,
            code,
            error: "Test failure",
        } as never);

        const response = await POST(postRequest());

        expect(response.status).toBe(status);
        expect(await response.json()).toMatchObject({
            success: false,
            code,
        });
    });

    it("returns a generic 500 if the service throws", async () => {
        vi.mocked(uploadProjectImage).mockRejectedValue(
            new Error("Unexpected failure"),
        );

        const consoleSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        try {
            const response = await POST(postRequest());

            expect(response.status).toBe(500);
            expect(await response.json()).toMatchObject({
                success: false,
                code: "BACKEND_ERROR",
            });
        } finally {
            consoleSpy.mockRestore();
        }
    });
});

describe("DELETE /api/project-images", () => {
    it("passes the image ID to the deletion service", async () => {
        const result = {
            success: true,
            imageId,
            cleanupPending: false,
        };

        vi.mocked(deleteProjectImage).mockResolvedValue(
            result as never,
        );

        const response = await DELETE(
            deleteRequest({ imageId }),
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(result);
        expect(deleteProjectImage).toHaveBeenCalledWith(imageId);
    });

    it("returns 200 when deletion succeeded but cleanup is pending", async () => {
        vi.mocked(deleteProjectImage).mockResolvedValue({
            success: true,
            imageId,
            cleanupPending: true,
        } as never);

        const response = await DELETE(
            deleteRequest({ imageId }),
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            success: true,
            cleanupPending: true,
        });
    });

    it("returns 400 for malformed JSON", async () => {
        const request = new Request(
            "http://localhost/api/project-images",
            {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: "{",
            },
        );

        const response = await DELETE(request);

        expect(response.status).toBe(400);
        expect(deleteProjectImage).not.toHaveBeenCalled();
    });

    it.each([
        [{}],
        [{ imageId: null }],
        [{ imageId: 123 }],
    ])("returns 400 when imageId is missing or not a string", async (body) => {
        const response = await DELETE(deleteRequest(body));

        expect(response.status).toBe(400);
        expect(deleteProjectImage).not.toHaveBeenCalled();
    });

    it.each([
        ["INVALID_INPUT", 400],
        ["UNAUTHENTICATED", 401],
        ["IMAGE_NOT_FOUND", 404],
        ["OUTCOME_UNCERTAIN", 503],
        ["BACKEND_ERROR", 500],
    ])("maps %s to HTTP %i", async (code, status) => {
        vi.mocked(deleteProjectImage).mockResolvedValue({
            success: false,
            code,
            error: "Test failure",
        } as never);

        const response = await DELETE(
            deleteRequest({ imageId }),
        );

        expect(response.status).toBe(status);
        expect(await response.json()).toMatchObject({
            success: false,
            code,
        });
    });
});