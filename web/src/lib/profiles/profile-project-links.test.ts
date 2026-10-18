import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import {
    addProjectLink,
    deleteProjectLink,
    getCurrentProjectLinks,
    updateProjectLink,
} from "./profile-project-links";

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(),
}));

const userId = "fee295f1-dfe8-451e-b378-d07e355dc525";
const projectId = "11111111-1111-4111-8111-111111111111";
const linkId = "22222222-2222-4222-8222-222222222222";

const linkInput = {
    label: "Source code",
    url: "https://github.com/example/project",
};

const storedLink = {
    id: linkId,
    project_id: projectId,
    ...linkInput,
    created_at: "2026-10-18T12:00:00Z",
};

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

function singleQuery(data: unknown, error: unknown = null) {
    const query = {
        select: vi.fn(),
        eq: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    };

    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.insert.mockReturnValue(query);
    query.update.mockReturnValue(query);
    query.delete.mockReturnValue(query);

    return query;
}

function listQuery(data: unknown, error: unknown = null) {
    const query = {
        select: vi.fn(),
        eq: vi.fn(),
        order: vi.fn().mockResolvedValue({ data, error }),
    };

    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);

    return query;
}

/**
 * Supply queries in the order each table is used.
 * Unexpected or extra database calls fail the test.
 */
function queueQueries(
    projects: Array<ReturnType<typeof singleQuery>> = [],
    links: Array<
        ReturnType<typeof singleQuery> | ReturnType<typeof listQuery>
    > = [],
) {
    const projectQueue = [...projects];
    const linkQueue = [...links];

    mockFrom.mockImplementation((table: string) => {
        if (table === "profile_projects") {
            const next = projectQueue.shift();
            if (!next) throw new Error("Unexpected project query");
            return next;
        }

        if (table === "profile_project_links") {
            const next = linkQueue.shift();
            if (!next) throw new Error("Unexpected link query");
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

    vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    } as never);
});

describe("getCurrentProjectLinks", () => {
    it("rejects an invalid project ID before creating a client", async () => {
        expect(await getCurrentProjectLinks("bad-id")).toEqual({
            success: false,
            error: "Invalid project ID.",
        });
        expect(createClient).not.toHaveBeenCalled();
    });

    it("stops when the user is signed out", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        expect(await getCurrentProjectLinks(projectId)).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        });
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("returns not found for an unowned or missing project", async () => {
        const projectQuery = singleQuery(null);
        queueQueries([projectQuery]);

        expect(await getCurrentProjectLinks(projectId)).toEqual({
            success: false,
            error: "Project not found.",
        });
        expect(projectQuery.eq).toHaveBeenCalledWith(
            "profile_id",
            userId,
        );
        expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it("returns an empty array for a project without links", async () => {
        const projectQuery = singleQuery({ id: projectId });
        const linksQuery = listQuery([]);
        queueQueries([projectQuery], [linksQuery]);

        expect(await getCurrentProjectLinks(projectId)).toEqual({
            success: true,
            links: [],
        });
        expect(linksQuery.eq).toHaveBeenCalledWith(
            "project_id",
            projectId,
        );
        expect(linksQuery.order).toHaveBeenCalledWith(
            "created_at",
            { ascending: false },
        );
    });

    it("returns multiple links", async () => {
        const links = [
            storedLink,
            {
                ...storedLink,
                id: "33333333-3333-4333-8333-333333333333",
                label: "Live demo",
                url: "https://example.com",
            },
        ];
        queueQueries(
            [singleQuery({ id: projectId })],
            [listQuery(links)],
        );

        expect(await getCurrentProjectLinks(projectId)).toEqual({
            success: true,
            links,
        });
    });

    it("reports a link query error", async () => {
        queueQueries(
            [singleQuery({ id: projectId })],
            [listQuery(null, new Error("Database unavailable"))],
        );

        expect(await getCurrentProjectLinks(projectId)).toEqual({
            success: false,
            error: "Unable to load project links. Please try again.",
        });
    });
});

describe("addProjectLink", () => {
    it("rejects an invalid URL before authentication or database access", async () => {
        expect(
            await addProjectLink(projectId, {
                label: "Bad link",
                url: "javascript:alert(1)",
            }),
        ).toEqual({
            success: false,
            error: "Please check your project link details.",
        });

        expect(createClient).not.toHaveBeenCalled();
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("does not insert a link for another user's project", async () => {
        queueQueries([singleQuery(null)]);

        expect(await addProjectLink(projectId, linkInput)).toEqual({
            success: false,
            error: "Project not found.",
        });
        expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it("inserts only validated fields into the owned project", async () => {
        const projectQuery = singleQuery({ id: projectId });
        const insertQuery = singleQuery(storedLink);
        queueQueries([projectQuery], [insertQuery]);

        const result = await addProjectLink(projectId, {
            ...linkInput,
            label: "  Source code  ",
            id: "attacker-supplied-id",
            project_id: "attacker-supplied-project",
            created_at: "2000-01-01",
        });

        expect(result).toEqual({ success: true, link: storedLink });
        expect(projectQuery.eq).toHaveBeenCalledWith(
            "profile_id",
            userId,
        );
        expect(insertQuery.insert).toHaveBeenCalledWith({
            project_id: projectId,
            label: "Source code",
            url: linkInput.url,
        });
    });

    it("reports a failed insert", async () => {
        queueQueries(
            [singleQuery({ id: projectId })],
            [singleQuery(null, new Error("Insert failed"))],
        );

        expect(await addProjectLink(projectId, linkInput)).toEqual({
            success: false,
            error: "Unable to add your project link. Please try again.",
        });
    });
});

describe("updateProjectLink", () => {
    it("rejects invalid details before database access", async () => {
        expect(
            await updateProjectLink(linkId, {
                label: "",
                url: "https://example.com",
            }),
        ).toEqual({
            success: false,
            error: "Please check your project link details.",
        });

        expect(createClient).not.toHaveBeenCalled();
    });

    it("returns not found when the link does not exist", async () => {
        queueQueries([], [singleQuery(null)]);

        expect(await updateProjectLink(linkId, linkInput)).toEqual({
            success: false,
            error: "Project link not found.",
        });
        expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it("does not update a readable link owned by someone else", async () => {
        queueQueries(
            [singleQuery(null)],
            [singleQuery({ id: linkId, project_id: projectId })],
        );

        expect(await updateProjectLink(linkId, linkInput)).toEqual({
            success: false,
            error: "Project link not found.",
        });
        expect(mockFrom).toHaveBeenCalledTimes(2);
    });

    it("updates only the intended link in an owned project", async () => {
        const updated = {
            ...storedLink,
            label: "Live project",
            url: "https://example.com/demo",
        };
        const updateQuery = singleQuery(updated);

        queueQueries(
            [singleQuery({ id: projectId })],
            [
                singleQuery({ id: linkId, project_id: projectId }),
                updateQuery,
            ],
        );

        expect(
            await updateProjectLink(linkId, {
                label: "  Live project  ",
                url: "https://example.com/demo",
                project_id: "attacker-value",
            }),
        ).toEqual({ success: true, link: updated });

        expect(updateQuery.update).toHaveBeenCalledWith({
            label: "Live project",
            url: "https://example.com/demo",
        });
        expect(updateQuery.eq).toHaveBeenCalledWith("id", linkId);
        expect(updateQuery.eq).toHaveBeenCalledWith(
            "project_id",
            projectId,
        );
    });

    it("reports a database update error", async () => {
        queueQueries(
            [singleQuery({ id: projectId })],
            [
                singleQuery({ id: linkId, project_id: projectId }),
                singleQuery(null, new Error("Update failed")),
            ],
        );

        expect(
            await updateProjectLink(linkId, linkInput),
        ).toEqual({
            success: false,
            error: "Unable to update your project link. Please try again.",
        });
    });
});

describe("deleteProjectLink", () => {
    it("rejects an invalid link ID before database access", async () => {
        expect(await deleteProjectLink("bad-id")).toEqual({
            success: false,
            error: "Invalid project link ID.",
        });
        expect(createClient).not.toHaveBeenCalled();
    });

    it("stops when authentication fails", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: new Error("Session expired"),
        });

        expect(await deleteProjectLink(linkId)).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        });
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("does not delete another user's link", async () => {
        queueQueries(
            [singleQuery(null)],
            [singleQuery({ id: linkId, project_id: projectId })],
        );

        expect(await deleteProjectLink(linkId)).toEqual({
            success: false,
            error: "Project link not found.",
        });
        expect(mockFrom).toHaveBeenCalledTimes(2);
    });

    it("deletes the selected link from an owned project", async () => {
        const deleteQuery = singleQuery({ id: linkId });

        queueQueries(
            [singleQuery({ id: projectId })],
            [
                singleQuery({ id: linkId, project_id: projectId }),
                deleteQuery,
            ],
        );

        expect(await deleteProjectLink(linkId)).toEqual({
            success: true,
            linkId,
        });
        expect(deleteQuery.delete).toHaveBeenCalledOnce();
        expect(deleteQuery.eq).toHaveBeenCalledWith("id", linkId);
        expect(deleteQuery.eq).toHaveBeenCalledWith(
            "project_id",
            projectId,
        );
    });

    it("reports a delete error", async () => {
        queueQueries(
            [singleQuery({ id: projectId })],
            [
                singleQuery({ id: linkId, project_id: projectId }),
                singleQuery(null, new Error("Delete failed")),
            ],
        );

        expect(await deleteProjectLink(linkId)).toEqual({
            success: false,
            error: "Unable to delete your project link. Please try again.",
        });
    });
});