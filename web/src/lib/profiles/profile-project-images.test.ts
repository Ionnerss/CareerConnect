import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { uploadProjectImage } from "./profile-project-images";

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(),
}));

const userId = "fee295f1-dfe8-451e-b378-d07e355dc525";
const projectId = "11111111-1111-4111-8111-111111111111";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockStorageFrom = vi.fn();
const mockUpload = vi.fn();
const mockRemove = vi.fn();

function jpegFile() {
    return new File(
        [new Uint8Array([0xff, 0xd8, 0xff, 0x00])],
        "test.jpg",
        { type: "image/jpeg" },
    );
}

function pngFile() {
    return new File(
        [
            new Uint8Array([
                0x89, 0x50, 0x4e, 0x47,
                0x0d, 0x0a, 0x1a, 0x0a,
            ]),
        ],
        "test.png",
        { type: "image/png" },
    );
}

function webpFile() {
    return new File(
        [
            new Uint8Array([
                0x52, 0x49, 0x46, 0x46,
                0x00, 0x00, 0x00, 0x00,
                0x57, 0x45, 0x42, 0x50,
            ]),
        ],
        "test.webp",
        { type: "image/webp" },
    );
}

function query(data: unknown, error: unknown = null) {
    const result = {
        select: vi.fn(),
        eq: vi.fn(),
        insert: vi.fn(),
        maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    };

    result.select.mockReturnValue(result);
    result.eq.mockReturnValue(result);
    result.insert.mockReturnValue(result);

    return result;
}

function setDatabaseQueries(
    projectQuery: ReturnType<typeof query>,
    imageQueries: Array<ReturnType<typeof query>> = [],
) {
    const remainingImages = [...imageQueries];

    mockFrom.mockImplementation((table: string) => {
        if (table === "profile_projects") return projectQuery;

        if (table === "profile_project_images") {
            const next = remainingImages.shift();
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

    mockUpload.mockResolvedValue({
        data: { path: "uploaded" },
        error: null,
    });

    mockRemove.mockResolvedValue({
        data: [],
        error: null,
    });

    mockStorageFrom.mockReturnValue({
        upload: mockUpload,
        remove: mockRemove,
    });

    vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: mockGetUser },
        from: mockFrom,
        storage: { from: mockStorageFrom },
    } as never);
});

describe("uploadProjectImage", () => {
    it("rejects invalid input before creating a Supabase client", async () => {
        const result = await uploadProjectImage({
            projectId,
            file: new File([], "empty.png", {
                type: "image/png",
            }),
        });

        expect(result).toMatchObject({
            success: false,
            code: "INVALID_INPUT",
        });
        expect(createClient).not.toHaveBeenCalled();
        expect(mockFrom).not.toHaveBeenCalled();
        expect(mockStorageFrom).not.toHaveBeenCalled();
    });

    it("stops when authentication fails", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: new Error("Expired session"),
        });

        const result = await uploadProjectImage({
            projectId,
            file: jpegFile(),
        });

        expect(result).toMatchObject({
            success: false,
            code: "UNAUTHENTICATED",
        });
        expect(mockFrom).not.toHaveBeenCalled();
        expect(mockStorageFrom).not.toHaveBeenCalled();
    });

    it("does not upload to someone else's project", async () => {
        const projectQuery = query(null);
        setDatabaseQueries(projectQuery);

        const result = await uploadProjectImage({
            projectId,
            file: jpegFile(),
        });

        expect(result).toMatchObject({
            success: false,
            code: "PROJECT_NOT_FOUND",
        });
        expect(projectQuery.eq).toHaveBeenCalledWith(
            "profile_id",
            userId,
        );
        expect(mockStorageFrom).not.toHaveBeenCalled();
    });

    it("reports a project query error before uploading", async () => {
        setDatabaseQueries(
            query(null, new Error("Database unavailable")),
        );

        const result = await uploadProjectImage({
            projectId,
            file: jpegFile(),
        });

        expect(result).toMatchObject({
            success: false,
            code: "BACKEND_ERROR",
        });
        expect(mockStorageFrom).not.toHaveBeenCalled();
    });

    it.each([
        ["JPEG", jpegFile],
        ["PNG", pngFile],
        ["WebP", webpFile],
    ])("uploads and records a valid %s image", async (_type, makeFile) => {
        const file = makeFile();
        const insertQuery = query({
            id: "33333333-3333-4333-8333-333333333333",
            project_id: projectId,
            storage_path: "saved-path",
            alt_text: "Project screenshot",
            created_at: "2026-10-18T12:00:00Z",
        });

        setDatabaseQueries(
            query({ id: projectId }),
            [insertQuery],
        );

        const result = await uploadProjectImage({
            projectId,
            file,
            alt_text: "  Project screenshot  ",
        });

        expect(result.success).toBe(true);
        expect(mockStorageFrom).toHaveBeenCalledWith(
            "project-images",
        );

        const [path, uploadedFile, options] =
            mockUpload.mock.calls[0];

        const extension =
            file.type === "image/jpeg"
                ? "jpg"
                : file.type === "image/png"
                  ? "png"
                  : "webp";

        expect(path).toMatch(
            new RegExp(
                `^${userId}/${projectId}/` +
                    `[0-9a-f-]{36}\\.${extension}$`,
            ),
        );
        expect(uploadedFile).toBe(file);
        expect(options).toEqual({
            contentType: file.type,
            upsert: false,
        });
        expect(insertQuery.insert).toHaveBeenCalledWith({
            project_id: projectId,
            storage_path: path,
            alt_text: "Project screenshot",
        });
        expect(mockRemove).not.toHaveBeenCalled();
    });

    it("rejects a fake JPEG before reaching Storage", async () => {
        setDatabaseQueries(query({ id: projectId }));

        const fake = new File(
            [new Uint8Array([1, 2, 3])],
            "fake.jpg",
            { type: "image/jpeg" },
        );

        const result = await uploadProjectImage({
            projectId,
            file: fake,
        });

        expect(result).toMatchObject({
            success: false,
            code: "INVALID_INPUT",
        });
        expect(mockStorageFrom).not.toHaveBeenCalled();
        expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it("rejects a fake PNG and a fake WebP", async () => {
        setDatabaseQueries(query({ id: projectId }));

        for (const type of ["image/png", "image/webp"]) {
            const fake = new File(
                [new Uint8Array(12)],
                "fake-image",
                { type },
            );

            const result = await uploadProjectImage({
                projectId,
                file: fake,
            });

            expect(result).toMatchObject({
                success: false,
                code: "INVALID_INPUT",
            });
        }

        expect(mockStorageFrom).not.toHaveBeenCalled();
    });

    it("does not insert a row if Storage upload fails", async () => {
        setDatabaseQueries(query({ id: projectId }));

        mockUpload.mockResolvedValue({
            data: null,
            error: new Error("Storage unavailable"),
        });

        const result = await uploadProjectImage({
            projectId,
            file: jpegFile(),
        });

        expect(result).toMatchObject({
            success: false,
            code: "BACKEND_ERROR",
        });
        expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it("keeps the file when recovery confirms the row was saved", async () => {
        const recovered = {
            id: "33333333-3333-4333-8333-333333333333",
            project_id: projectId,
            storage_path: "recovered-path",
            alt_text: null,
            created_at: "2026-10-18T12:00:00Z",
        };

        const recoveryQuery = query(recovered);

        setDatabaseQueries(
            query({ id: projectId }),
            [
                query(null, new Error("Response lost")),
                recoveryQuery,
            ],
        );

        const result = await uploadProjectImage({
            projectId,
            file: jpegFile(),
        });

        expect(result).toEqual({
            success: true,
            image: recovered,
        });

        const uploadedPath = mockUpload.mock.calls[0][0];
        expect(recoveryQuery.eq).toHaveBeenCalledWith(
            "storage_path",
            uploadedPath,
        );
        expect(mockRemove).not.toHaveBeenCalled();
    });

    it("removes the upload when recovery confirms no row exists", async () => {
        setDatabaseQueries(
            query({ id: projectId }),
            [
                query(null, new Error("Insert failed")),
                query(null),
            ],
        );

        const result = await uploadProjectImage({
            projectId,
            file: jpegFile(),
        });

        const uploadedPath = mockUpload.mock.calls[0][0];

        expect(result).toMatchObject({
            success: false,
            code: "BACKEND_ERROR",
        });
        expect(mockRemove).toHaveBeenCalledWith([
            uploadedPath,
        ]);
    });

    it("keeps the file when the recovery read fails", async () => {
        setDatabaseQueries(
            query({ id: projectId }),
            [
                query(null, new Error("Insert response failed")),
                query(null, new Error("Recovery unavailable")),
            ],
        );

        const result = await uploadProjectImage({
            projectId,
            file: jpegFile(),
        });

        expect(result).toMatchObject({
            success: false,
            code: "OUTCOME_UNCERTAIN",
        });
        expect(mockRemove).not.toHaveBeenCalled();
    });

    it("reports a failed cleanup after confirmed insert failure", async () => {
        setDatabaseQueries(
            query({ id: projectId }),
            [
                query(null, new Error("Insert failed")),
                query(null),
            ],
        );

        mockRemove.mockResolvedValue({
            data: null,
            error: new Error("Storage remove failed"),
        });

        const consoleSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        try {
            const result = await uploadProjectImage({
                projectId,
                file: jpegFile(),
            });

            expect(result).toMatchObject({
                success: false,
                code: "BACKEND_ERROR",
            });
            expect(mockRemove).toHaveBeenCalledOnce();
            expect(consoleSpy).toHaveBeenCalled();
        } finally {
            consoleSpy.mockRestore();
        }
    });
});