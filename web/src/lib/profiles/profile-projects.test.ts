import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import {
    addCurrentProject,
    deleteCurrentProject,
    getCurrentProjects,
    updateCurrentProject,
} from "./profile-projects";

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(),
}));

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const projectId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const validInput = {
    name: "CareerConnect",
    short_description: "A platform for candidates and recruiters.",
};

const savedProject = {
    id: projectId,
    profile_id: userId,
    ...validInput,
    created_at: "2026-10-18T12:00:00Z",
};

type MockResult = {
    data: unknown;
    error: Error | null;
};

function makeQuery(result: MockResult) {
    const query = {
        select: vi.fn(),
        eq: vi.fn(),
        order: vi.fn().mockResolvedValue(result),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        single: vi.fn().mockResolvedValue(result),
        maybeSingle: vi.fn().mockResolvedValue(result),
    };

    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.insert.mockReturnValue(query);
    query.update.mockReturnValue(query);
    query.delete.mockReturnValue(query);

    return query;
}

function setUpClient(
    queries: ReturnType<typeof makeQuery>[] = [],
    authResult: {
        data: { user: { id: string } | null };
        error: Error | null;
    } = {
        data: { user: { id: userId } },
        error: null,
    },
) {
    const remainingQueries = [...queries];

    const mockFrom = vi.fn(() => remainingQueries.shift());

    const mockList = vi.fn().mockResolvedValue({
        data: [],
        error: null,
    });

    const mockRemove = vi.fn().mockResolvedValue({
        data: [],
        error: null,
    });

    const mockStorageFrom = vi.fn(() => ({
        list: mockList,
        remove: mockRemove,
    }));

    const mockGetUser = vi.fn().mockResolvedValue(authResult);

    vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: mockGetUser },
        from: mockFrom,
        storage: { from: mockStorageFrom },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    return {
        mockFrom,
        mockGetUser,
        mockList,
        mockRemove,
        mockStorageFrom,
    };
}

beforeEach(() => {
    vi.resetAllMocks();
});

describe("getCurrentProjects", () => {
    it("stops when authentication fails", async () => {
        const { mockFrom } = setUpClient([], {
            data: { user: null },
            error: new Error("Auth failed"),
        });

        expect(await getCurrentProjects()).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        });
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("returns an empty array for a user with no projects", async () => {
        const query = makeQuery({ data: [], error: null });
        const { mockFrom } = setUpClient([query]);

        expect(await getCurrentProjects()).toEqual({
            success: true,
            projects: [],
        });

        expect(mockFrom).toHaveBeenCalledWith("profile_projects");
        expect(query.eq).toHaveBeenCalledWith("profile_id", userId);
        expect(query.order).toHaveBeenCalledWith("created_at", {
            ascending: false,
        });
    });

    it("returns multiple projects ordered by the query", async () => {
        const older = {
            ...savedProject,
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            name: "Older project",
            created_at: "2026-10-17T12:00:00Z",
        };

        const query = makeQuery({
            data: [savedProject, older],
            error: null,
        });

        setUpClient([query]);

        expect(await getCurrentProjects()).toEqual({
            success: true,
            projects: [savedProject, older],
        });

        expect(query.order).toHaveBeenCalledWith("created_at", {
            ascending: false,
        });
    });

    it("returns a database failure", async () => {
        const query = makeQuery({
            data: null,
            error: new Error("Database failed"),
        });

        setUpClient([query]);

        expect(await getCurrentProjects()).toEqual({
            success: false,
            error: "Unable to load your projects. Please try again.",
        });
    });
});

describe("addCurrentProject", () => {
    it("rejects invalid input before creating a client", async () => {
        expect(
            await addCurrentProject({
                name: "   ",
                short_description: "Description",
            }),
        ).toEqual({
            success: false,
            error: "Please check your project details.",
        });

        expect(createClient).not.toHaveBeenCalled();
    });

    it("stops before querying when signed out", async () => {
        const { mockFrom } = setUpClient([], {
            data: { user: null },
            error: null,
        });

        expect(await addCurrentProject(validInput)).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        });

        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("inserts normalized fields under the authenticated user", async () => {
        const query = makeQuery({
            data: savedProject,
            error: null,
        });

        const { mockFrom } = setUpClient([query]);

        const result = await addCurrentProject({
            name: "  CareerConnect  ",
            short_description:
                "  A platform for candidates and recruiters.  ",
            profile_id: "another-user",
            id: "user-supplied-id",
        });

        expect(result).toEqual({
            success: true,
            project: savedProject,
        });

        expect(mockFrom).toHaveBeenCalledWith("profile_projects");
        expect(query.insert).toHaveBeenCalledWith({
            profile_id: userId,
            ...validInput,
        });
        expect(query.single).toHaveBeenCalledOnce();
    });

    it("handles an insert error", async () => {
        setUpClient([
            makeQuery({
                data: null,
                error: new Error("Insert failed"),
            }),
        ]);

        expect(await addCurrentProject(validInput)).toEqual({
            success: false,
            error: "Unable to add your project. Please try again.",
        });
    });

    it("handles an insert that returns no row", async () => {
        setUpClient([
            makeQuery({
                data: null,
                error: null,
            }),
        ]);

        expect(await addCurrentProject(validInput)).toEqual({
            success: false,
            error: "Project was not returned. Please try again.",
        });
    });
});

describe("updateCurrentProject", () => {
    it("rejects an invalid ID or details before creating a client", async () => {
        expect(
            (await updateCurrentProject("bad-id", validInput)).success,
        ).toBe(false);

        expect(
            (
                await updateCurrentProject(projectId, {
                    ...validInput,
                    name: " ",
                })
            ).success,
        ).toBe(false);

        expect(createClient).not.toHaveBeenCalled();
    });

    it("stops before querying when signed out", async () => {
        const { mockFrom } = setUpClient([], {
            data: { user: null },
            error: null,
        });

        expect(
            await updateCurrentProject(projectId, validInput),
        ).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        });

        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("updates only the authenticated user's matching project", async () => {
        const query = makeQuery({
            data: savedProject,
            error: null,
        });

        const { mockFrom } = setUpClient([query]);

        expect(
            await updateCurrentProject(projectId, {
                name: "  CareerConnect  ",
                short_description:
                    "  A platform for candidates and recruiters.  ",
                profile_id: "another-user",
            }),
        ).toEqual({
            success: true,
            project: savedProject,
        });

        expect(mockFrom).toHaveBeenCalledWith("profile_projects");
        expect(query.update).toHaveBeenCalledWith(validInput);
        expect(query.eq).toHaveBeenCalledWith("id", projectId);
        expect(query.eq).toHaveBeenCalledWith("profile_id", userId);
    });

    it("returns not found when no owned row matches", async () => {
        setUpClient([
            makeQuery({ data: null, error: null }),
        ]);

        expect(
            await updateCurrentProject(projectId, validInput),
        ).toEqual({
            success: false,
            error: "Project not found.",
        });
    });

    it("handles a database error", async () => {
        setUpClient([
            makeQuery({
                data: null,
                error: new Error("Update failed"),
            }),
        ]);

        expect(
            await updateCurrentProject(projectId, validInput),
        ).toEqual({
            success: false,
            error: "Unable to update your project. Please try again.",
        });
    });
});

describe("deleteCurrentProject", () => {
    it("rejects an invalid ID before creating a client", async () => {
        expect(await deleteCurrentProject("bad-id")).toEqual({
            success: false,
            error: "Invalid project ID.",
        });

        expect(createClient).not.toHaveBeenCalled();
    });

    it("stops before querying when signed out", async () => {
        const { mockFrom } = setUpClient([], {
            data: { user: null },
            error: null,
        });

        expect(await deleteCurrentProject(projectId)).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        });

        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("returns not found without deleting anything", async () => {
        const readQuery = makeQuery({
            data: null,
            error: null,
        });

        const { mockFrom, mockStorageFrom } =
            setUpClient([readQuery]);

        expect(await deleteCurrentProject(projectId)).toEqual({
            success: false,
            error: "Project not found.",
        });

        expect(readQuery.eq).toHaveBeenCalledWith(
            "profile_id",
            userId,
        );
        expect(mockFrom).toHaveBeenCalledTimes(1);
        expect(mockStorageFrom).not.toHaveBeenCalled();
    });

    it("stops if the ownership read fails", async () => {
        const readQuery = makeQuery({
            data: null,
            error: new Error("Read failed"),
        });

        const { mockFrom, mockStorageFrom } =
            setUpClient([readQuery]);

        expect(await deleteCurrentProject(projectId)).toEqual({
            success: false,
            error: "Unable to load your project. Please try again.",
        });

        expect(mockFrom).toHaveBeenCalledTimes(1);
        expect(mockStorageFrom).not.toHaveBeenCalled();
    });

    it("deletes the owned row, then removes its stored images", async () => {
        const readQuery = makeQuery({
            data: { id: projectId },
            error: null,
        });

        const deleteQuery = makeQuery({
            data: { id: projectId },
            error: null,
        });

        const {
            mockFrom,
            mockList,
            mockRemove,
            mockStorageFrom,
        } = setUpClient([readQuery, deleteQuery]);

        const fileName =
            "dddddddd-dddd-4ddd-8ddd-dddddddddddd.jpg";

        mockList
            .mockResolvedValueOnce({
                data: [{ id: "storage-object-id", name: fileName }],
                error: null,
            })
            .mockResolvedValueOnce({
                data: [],
                error: null,
            });

        expect(await deleteCurrentProject(projectId)).toEqual({
            success: true,
            projectId,
            cleanupPending: false,
        });

        expect(mockFrom).toHaveBeenCalledTimes(2);
        expect(deleteQuery.delete).toHaveBeenCalledOnce();
        expect(deleteQuery.eq).toHaveBeenCalledWith("id", projectId);
        expect(deleteQuery.eq).toHaveBeenCalledWith(
            "profile_id",
            userId,
        );

        expect(mockStorageFrom).toHaveBeenCalledWith(
            "project-images",
        );
        expect(mockList).toHaveBeenCalledWith(
            `${userId}/${projectId}`,
            { limit: 100, offset: 0 },
        );
        expect(mockRemove).toHaveBeenCalledWith([
            `${userId}/${projectId}/${fileName}`,
        ]);
    });

    it("succeeds without removal when the folder is empty", async () => {
        const { mockRemove } = setUpClient([
            makeQuery({ data: { id: projectId }, error: null }),
            makeQuery({ data: { id: projectId }, error: null }),
        ]);

        expect(await deleteCurrentProject(projectId)).toEqual({
            success: true,
            projectId,
            cleanupPending: false,
        });

        expect(mockRemove).not.toHaveBeenCalled();
    });

    it("keeps Storage untouched if a failed DELETE left the row", async () => {
        const { mockStorageFrom } = setUpClient([
            makeQuery({ data: { id: projectId }, error: null }),
            makeQuery({
                data: null,
                error: new Error("Delete response failed"),
            }),
            makeQuery({ data: { id: projectId }, error: null }),
        ]);

        expect(await deleteCurrentProject(projectId)).toEqual({
            success: false,
            error: "Unable to delete your project. Please try again.",
        });

        expect(mockStorageFrom).not.toHaveBeenCalled();
    });

    it("keeps Storage untouched when deletion cannot be confirmed", async () => {
        const { mockStorageFrom } = setUpClient([
            makeQuery({ data: { id: projectId }, error: null }),
            makeQuery({
                data: null,
                error: new Error("Delete response failed"),
            }),
            makeQuery({
                data: null,
                error: new Error("Recovery read failed"),
            }),
        ]);

        expect(await deleteCurrentProject(projectId)).toEqual({
            success: false,
            error:
                "Could not confirm whether your project was deleted. " +
                "Please refresh before trying again.",
        });

        expect(mockStorageFrom).not.toHaveBeenCalled();
    });

    it("cleans up when recovery confirms the row is gone", async () => {
        const { mockList } = setUpClient([
            makeQuery({ data: { id: projectId }, error: null }),
            makeQuery({
                data: null,
                error: new Error("Delete response failed"),
            }),
            makeQuery({ data: null, error: null }),
        ]);

        expect(await deleteCurrentProject(projectId)).toEqual({
            success: true,
            projectId,
            cleanupPending: false,
        });

        expect(mockList).toHaveBeenCalledOnce();
    });

    it("reports pending cleanup if Storage listing fails", async () => {
        const { mockList } = setUpClient([
            makeQuery({ data: { id: projectId }, error: null }),
            makeQuery({ data: { id: projectId }, error: null }),
        ]);

        mockList.mockResolvedValueOnce({
            data: null,
            error: new Error("Storage list failed"),
        });

        const consoleSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        try {
            expect(await deleteCurrentProject(projectId)).toEqual({
                success: true,
                projectId,
                cleanupPending: true,
            });
        } finally {
            consoleSpy.mockRestore();
        }
    });

    it("reports pending cleanup if Storage removal fails", async () => {
        const { mockList, mockRemove } = setUpClient([
            makeQuery({ data: { id: projectId }, error: null }),
            makeQuery({ data: { id: projectId }, error: null }),
        ]);

        mockList.mockResolvedValueOnce({
            data: [
                {
                    id: "storage-object-id",
                    name: "dddddddd-dddd-4ddd-8ddd-dddddddddddd.jpg",
                },
            ],
            error: null,
        });

        mockRemove.mockResolvedValueOnce({
            data: null,
            error: new Error("Storage remove failed"),
        });

        const consoleSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        try {
            expect(await deleteCurrentProject(projectId)).toEqual({
                success: true,
                projectId,
                cleanupPending: true,
            });
        } finally {
            consoleSpy.mockRestore();
        }
    });
});