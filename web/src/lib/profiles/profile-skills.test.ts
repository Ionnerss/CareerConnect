import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentSkills } from "./profile-skills";

const { mockGetUser, mockFrom, mockSelect, mockEq, mockOrder } =
    vi.hoisted(() => ({
        mockGetUser: vi.fn(),
        mockFrom: vi.fn(),
        mockSelect: vi.fn(),
        mockEq: vi.fn(),
        mockOrder: vi.fn(),
    }));

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    })),
}));

describe("getCurrentSkills", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockGetUser.mockResolvedValue({
            data: { user: { id: "test-user-id" } },
            error: null,
        });

        mockFrom.mockReturnValue({ select: mockSelect });
        mockSelect.mockReturnValue({ eq: mockEq });
        mockEq.mockReturnValue({ order: mockOrder });
        mockOrder.mockResolvedValue({ data: [], error: null });
    });

    it("stops before querying when authentication fails", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: new Error("Auth failed"),
        });

        expect(await getCurrentSkills()).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        });
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("stops before querying when there is no authenticated user", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        expect(await getCurrentSkills()).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        });
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("returns an empty list when the user has no skills", async () => {
        expect(await getCurrentSkills()).toEqual({
            success: true,
            skills: [],
        });

        expect(mockFrom).toHaveBeenCalledWith("profile_skills");
        expect(mockSelect).toHaveBeenCalledWith(
            "id, profile_id, name, proficiency, created_at",
        );
        expect(mockEq).toHaveBeenCalledWith(
            "profile_id",
            "test-user-id",
        );
        expect(mockOrder).toHaveBeenCalledWith(
            "name",
            { ascending: true },
        );
    });

    it("returns multiple skills and requests alphabetical ordering", async () => {
        const skills = [
            {
                id: "skill-1",
                profile_id: "test-user-id",
                name: "Python",
                proficiency: "Intermediate",
                created_at: "2026-01-01T00:00:00Z",
            },
            {
                id: "skill-2",
                profile_id: "test-user-id",
                name: "TypeScript",
                proficiency: "Advanced",
                created_at: "2026-01-02T00:00:00Z",
            },
        ];

        mockOrder.mockResolvedValue({ data: skills, error: null });

        expect(await getCurrentSkills()).toEqual({
            success: true,
            skills,
        });
        expect(mockOrder).toHaveBeenCalledWith(
            "name",
            { ascending: true },
        );
    });

    it("returns a failure when the database query fails", async () => {
        mockOrder.mockResolvedValue({
            data: null,
            error: new Error("Database unavailable"),
        });

        expect(await getCurrentSkills()).toEqual({
            success: false,
            error: "Unable to load your skills. Please try again.",
        });
    });
});