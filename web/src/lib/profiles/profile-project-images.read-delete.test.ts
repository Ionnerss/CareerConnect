import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import {
    deleteProjectImage,
    getCurrentProjectImages,
} from "./profile-project-images";

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(),
}));

const userId = "fee295f1-dfe8-451e-b378-d07e355dc525";
const projectId = "11111111-1111-4111-8111-111111111111";
const imageId = "22222222-2222-4222-8222-222222222222";

const path =
    `${userId}/${projectId}/` +
    "33333333-3333-4333-8333-333333333333.jpg";

const image = {
    id: imageId,
    project_id: projectId,
    storage_path: path,
    alt_text: "Screenshot",
    created_at: "2026-10-18T12:00:00Z",
};

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockStorageFrom = vi.fn();
const mockRemove = vi.fn();

function singleQuery(data: unknown, error: unknown = null) {
    const result = {
        select: vi.fn(),
        eq: vi.fn(),
        delete: vi.fn(),
        maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    };

    result.select.mockReturnValue(result);
    result.eq.mockReturnValue(result);
    result.delete.mockReturnValue(result);

    return result;
}

function listQuery(data: unknown, error: unknown = null) {
    const result = {
        select: vi.fn(),
        eq: vi.fn(),
        order: vi.fn().mockResolvedValue({ data, error }),
    };

    result.select.mockReturnValue(result);
    result.eq.mockReturnValue(result);

    return result;
}

function queueQueries(
    projects: Array<ReturnType<typeof singleQuery>>,
    images: Array<
        ReturnType<typeof singleQuery> | ReturnType<typeof listQuery>
    >,
) {
    const projectQueue = [...projects];
    const imageQueue = [...images];

    mockFrom.mockImplementation((table: string) => {
        if (table === "profile_projects") {
            const next = projectQueue.shift();
            if (!next) throw new Error("Unexpected project query");
            return next;
        }

        if (table === "profile_project_images") {
            const next = imageQueue.shift();
            if (!next) throw new Error("Unexpected image query");
            return next;
        }

        throw new Error(`Unexpected table: ${table}`);
    });
}

beforeEach(() => {
    vi.resetAllMocks();

    mockGetUser.mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
    });

    mockRemove.mockResolvedValue({
        data: [],
        error: null,
    });

    mockStorageFrom.mockReturnValue({
        remove: mockRemove,
    });

    vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: mockGetUser },
        from: mockFrom,
        storage: { from: mockStorageFrom },
    } as never);
});

describe("getCurrentProjectImages", () => {
    it("rejects an invalid project ID before creating a client", async () => {
        expect(await getCurrentProjectImages("bad-id")).toEqual({
            success: false,
            error: "Invalid project ID.",
        });
        expect(createClient).not.toHaveBeenCalled();
    });

    it("rejects a signed-out user without querying the database", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        expect(await getCurrentProjectImages(projectId)).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        });
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("does not list another user's project images", async () => {
        const projectQuery = singleQuery(null);
        queueQueries([projectQuery], []);

        expect(await getCurrentProjectImages(projectId)).toEqual({
            success: false,
            error: "Project not found.",
        });

        expect(projectQuery.eq).toHaveBeenCalledWith(
            "profile_id",
            userId,
        );
        expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it("returns an empty array for a project without images", async () => {
        const imagesQuery = listQuery([]);
        queueQueries(
            [singleQuery({ id: projectId })],
            [imagesQuery],
        );

        expect(await getCurrentProjectImages(projectId)).toEqual({
            success: true,
            images: [],
        });
        expect(imagesQuery.eq).toHaveBeenCalledWith(
            "project_id",
            projectId,
        );
        expect(imagesQuery.order).toHaveBeenCalledWith(
            "created_at",
            { ascending: false },
        );
    });

    it("returns multiple images", async () => {
        const second = {
            ...image,
            id: "44444444-4444-4444-8444-444444444444",
        };

        queueQueries(
            [singleQuery({ id: projectId })],
            [listQuery([image, second])],
        );

        expect(await getCurrentProjectImages(projectId)).toEqual({
            success: true,
            images: [image, second],
        });
    });

    it("reports a database listing error", async () => {
        queueQueries(
            [singleQuery({ id: projectId })],
            [listQuery(null, new Error("Read failed"))],
        );

        expect(await getCurrentProjectImages(projectId)).toEqual({
            success: false,
            error: "Unable to load project images. Please try again.",
        });
    });
});

describe("deleteProjectImage", () => {
    it("rejects an invalid image ID before creating a client", async () => {
        expect(await deleteProjectImage("bad-id")).toEqual({
            success: false,
            code: "INVALID_INPUT",
            error: "Invalid project image ID.",
        });
        expect(createClient).not.toHaveBeenCalled();
    });

    it("rejects a signed-out user before reading an image", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: new Error("Session expired"),
        });

        expect(await deleteProjectImage(imageId)).toMatchObject({
            success: false,
            code: "UNAUTHENTICATED",
        });
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("returns not found when the image is missing", async () => {
        queueQueries([], [singleQuery(null)]);

        expect(await deleteProjectImage(imageId)).toMatchObject({
            success: false,
            code: "IMAGE_NOT_FOUND",
        });
        expect(mockStorageFrom).not.toHaveBeenCalled();
    });

    it("does not delete a readable image from another user's project", async () => {
        queueQueries(
            [singleQuery(null)],
            [singleQuery(image)],
        );

        expect(await deleteProjectImage(imageId)).toMatchObject({
            success: false,
            code: "IMAGE_NOT_FOUND",
        });
        expect(mockStorageFrom).not.toHaveBeenCalled();
        expect(mockFrom).toHaveBeenCalledTimes(2);
    });

    it("deletes the row before removing its Storage file", async () => {
        const deleteQuery = singleQuery({ id: imageId });

        queueQueries(
            [singleQuery({ id: projectId })],
            [singleQuery(image), deleteQuery],
        );

        expect(await deleteProjectImage(imageId)).toEqual({
            success: true,
            imageId,
            cleanupPending: false,
        });

        expect(deleteQuery.delete).toHaveBeenCalledOnce();
        expect(deleteQuery.eq).toHaveBeenCalledWith(
            "id",
            imageId,
        );
        expect(deleteQuery.eq).toHaveBeenCalledWith(
            "project_id",
            projectId,
        );
        expect(mockStorageFrom).toHaveBeenCalledWith(
            "project-images",
        );
        expect(mockRemove).toHaveBeenCalledWith([path]);
    });

    it("cleans up after a failed delete response if a read confirms deletion", async () => {
        queueQueries(
            [singleQuery({ id: projectId })],
            [
                singleQuery(image),
                singleQuery(null, new Error("Response lost")),
                singleQuery(null),
            ],
        );

        expect(await deleteProjectImage(imageId)).toEqual({
            success: true,
            imageId,
            cleanupPending: false,
        });
        expect(mockRemove).toHaveBeenCalledWith([path]);
    });

    it("keeps the file when a read confirms the row still exists", async () => {
        queueQueries(
            [singleQuery({ id: projectId })],
            [
                singleQuery(image),
                singleQuery(null, new Error("Delete failed")),
                singleQuery({ id: imageId }),
            ],
        );

        expect(await deleteProjectImage(imageId)).toMatchObject({
            success: false,
            code: "BACKEND_ERROR",
        });
        expect(mockStorageFrom).not.toHaveBeenCalled();
    });

    it("keeps the file when the recovery read fails", async () => {
        queueQueries(
            [singleQuery({ id: projectId })],
            [
                singleQuery(image),
                singleQuery(null, new Error("Delete failed")),
                singleQuery(null, new Error("Read failed")),
            ],
        );

        expect(await deleteProjectImage(imageId)).toMatchObject({
            success: false,
            code: "OUTCOME_UNCERTAIN",
        });
        expect(mockStorageFrom).not.toHaveBeenCalled();
    });

    it("reports cleanupPending if Storage removal fails", async () => {
        queueQueries(
            [singleQuery({ id: projectId })],
            [singleQuery(image), singleQuery({ id: imageId })],
        );

        mockRemove.mockResolvedValue({
            data: null,
            error: new Error("Remove failed"),
        });

        const consoleSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        try {
            expect(await deleteProjectImage(imageId)).toEqual({
                success: true,
                imageId,
                cleanupPending: true,
            });
            expect(consoleSpy).toHaveBeenCalled();
        } finally {
            consoleSpy.mockRestore();
        }
    });
});