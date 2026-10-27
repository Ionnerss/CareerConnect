import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { getProjectImageUrl } from "./profile-project-images";

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(),
}));

const imageId = "22222222-2222-4222-8222-222222222222";

const storedImage = {
    id: imageId,
    storage_path:
        "fee295f1-dfe8-451e-b378-d07e355dc525/" +
        "11111111-1111-4111-8111-111111111111/" +
        "33333333-3333-4333-8333-333333333333.png",
    alt_text: "Project dashboard",
};

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockStorageFrom = vi.fn();
const mockCreateSignedUrl = vi.fn();

function imageQuery(data: unknown, error: unknown = null) {
    const query = {
        select: vi.fn(),
        eq: vi.fn(),
        maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    };

    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);

    return query;
}

beforeEach(() => {
    vi.resetAllMocks();

    mockGetUser.mockResolvedValue({
        data: {
            user: {
                id: "fee295f1-dfe8-451e-b378-d07e355dc525",
            },
        },
        error: null,
    });

    mockFrom.mockReturnValue(imageQuery(storedImage));

    mockCreateSignedUrl.mockResolvedValue({
        data: {
            signedUrl: "https://example.com/temporary-image-url",
        },
        error: null,
    });

    mockStorageFrom.mockReturnValue({
        createSignedUrl: mockCreateSignedUrl,
    });

    vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: mockGetUser },
        from: mockFrom,
        storage: { from: mockStorageFrom },
    } as never);
});

describe("getProjectImageUrl", () => {
    it("rejects an invalid image ID before creating a client", async () => {
        expect(await getProjectImageUrl("bad-id")).toEqual({
            success: false,
            code: "INVALID_INPUT",
            error: "Invalid project image ID.",
        });

        expect(createClient).not.toHaveBeenCalled();
    });

    it("stops before querying when signed out", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        expect(await getProjectImageUrl(imageId)).toMatchObject({
            success: false,
            code: "UNAUTHENTICATED",
        });

        expect(mockFrom).not.toHaveBeenCalled();
        expect(mockStorageFrom).not.toHaveBeenCalled();
    });

    it("does not sign an image row invisible under RLS", async () => {
        mockFrom.mockReturnValue(imageQuery(null));

        expect(await getProjectImageUrl(imageId)).toMatchObject({
            success: false,
            code: "IMAGE_NOT_FOUND",
        });

        expect(mockStorageFrom).not.toHaveBeenCalled();
    });

    it("reports a database read error without signing", async () => {
        mockFrom.mockReturnValue(
            imageQuery(null, new Error("Read failed")),
        );

        expect(await getProjectImageUrl(imageId)).toMatchObject({
            success: false,
            code: "BACKEND_ERROR",
        });

        expect(mockStorageFrom).not.toHaveBeenCalled();
    });

    it("signs only the path retrieved from the image row", async () => {
        const result = await getProjectImageUrl(imageId);

        expect(result).toEqual({
            success: true,
            imageId,
            alt_text: "Project dashboard",
            url: "https://example.com/temporary-image-url",
            expiresIn: 60,
        });

        expect(mockFrom).toHaveBeenCalledWith(
            "profile_project_images",
        );

        const query = mockFrom.mock.results[0].value;
        expect(query.eq).toHaveBeenCalledWith("id", imageId);

        expect(mockStorageFrom).toHaveBeenCalledWith(
            "project-images",
        );
        expect(mockCreateSignedUrl).toHaveBeenCalledWith(
            storedImage.storage_path,
            60,
        );
    });

    it("works with a visible recruiter image row", async () => {
        mockGetUser.mockResolvedValue({
            data: {
                user: {
                    id: "44444444-4444-4444-8444-444444444444",
                },
            },
            error: null,
        });

        expect(await getProjectImageUrl(imageId)).toMatchObject({
            success: true,
            imageId,
        });

        expect(mockCreateSignedUrl).toHaveBeenCalledWith(
            storedImage.storage_path,
            60,
        );
    });

    it("returns a failure when Storage rejects signing", async () => {
        mockCreateSignedUrl.mockResolvedValue({
            data: null,
            error: new Error("Not allowed"),
        });

        expect(await getProjectImageUrl(imageId)).toMatchObject({
            success: false,
            code: "BACKEND_ERROR",
        });
    });

    it("returns a failure when signing returns no URL", async () => {
        mockCreateSignedUrl.mockResolvedValue({
            data: null,
            error: null,
        });

        expect(await getProjectImageUrl(imageId)).toMatchObject({
            success: false,
            code: "BACKEND_ERROR",
        });
    });
});