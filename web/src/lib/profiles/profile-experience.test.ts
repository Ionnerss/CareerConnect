import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentExperience } from "./profile-experience";

const {
    mockGetUser,
    mockFrom,
    mockSelect,
    mockEq,
    mockOrder,
} = vi.hoisted(() => ({
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

describe("getCurrentExperience", () => {
    beforeEach(() => {
        vi.resetAllMocks();

        mockGetUser.mockResolvedValue({
            data: { user: { id: "test-user-id" } },
            error: null,
        });

        mockFrom.mockReturnValue({ select: mockSelect });
        mockSelect.mockReturnValue({ eq: mockEq });
        mockEq.mockReturnValue({ order: mockOrder });

        mockOrder.mockResolvedValue({
            data: [],
            error: null,
        });
    });

    it("stops when authentication fails", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: new Error("Auth failed"),
        });

        const result = await getCurrentExperience();

        expect(result).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        });
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("returns an empty array when the user has no experience", async () => {
        const result = await getCurrentExperience();

        expect(mockFrom).toHaveBeenCalledWith("profile_experience");
        expect(mockEq).toHaveBeenCalledWith(
            "profile_id",
            "test-user-id",
        );
        expect(mockOrder).toHaveBeenCalledWith(
            "start_date",
            { ascending: false },
        );
        expect(result).toEqual({
            success: true,
            profileExperience: [],
        });
    });

    it("returns multiple entries ordered by newest start date", async () => {
        const newer = {
            id: "newer-id",
            profile_id: "test-user-id",
            company_name: "Newer Company",
            job_role: "Engineer",
            start_date: "2025-01-01",
            end_date: null,
            description: null,
            created_at: "2025-01-01T00:00:00Z",
        };

        const older = {
            id: "older-id",
            profile_id: "test-user-id",
            company_name: "Older Company",
            job_role: "Intern",
            start_date: "2023-01-01",
            end_date: "2023-12-31",
            description: "Worked on applications.",
            created_at: "2023-01-01T00:00:00Z",
        };

        mockOrder.mockResolvedValue({
            data: [newer, older],
            error: null,
        });

        const result = await getCurrentExperience();

        expect(mockSelect).toHaveBeenCalledWith(
            "id, profile_id, company_name, job_role, start_date, end_date, description, created_at",
        );
        expect(mockEq).toHaveBeenCalledWith(
            "profile_id",
            "test-user-id",
        );
        expect(mockOrder).toHaveBeenCalledWith(
            "start_date",
            { ascending: false },
        );
        expect(result).toEqual({
            success: true,
            profileExperience: [newer, older],
        });
    });

    it("returns a failure when the database query errors", async () => {
        mockOrder.mockResolvedValue({
            data: null,
            error: new Error("Database unavailable"),
        });

        const result = await getCurrentExperience();

        expect(result).toEqual({
            success: false,
            error: "Unable to load your experience entries. Please try again.",
        });
    });
});