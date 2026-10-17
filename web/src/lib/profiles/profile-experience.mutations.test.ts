import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    addCurrentExperience,
    updateCurrentExperience,
    deleteCurrentExperience,
} from "./profile-experience";

const {
    mockCreateClient,
    mockGetUser,
    mockFrom,
    mockInsert,
    mockUpdate,
    mockDelete,
    mockEq,
    mockSelect,
    mockSingle,
    mockMaybeSingle,
} = vi.hoisted(() => ({
    mockCreateClient: vi.fn(),
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockInsert: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
    mockEq: vi.fn(),
    mockSelect: vi.fn(),
    mockSingle: vi.fn(),
    mockMaybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
    createClient: mockCreateClient,
}));

const experienceId = "11111111-1111-4111-8111-111111111111";
const otherExperienceId = "22222222-2222-4222-8222-222222222222";
const userId = "test-user-id";

const validInput = {
    company_name: "Example Company",
    job_role: "Software Developer",
    start_date: "2024-01-01",
    end_date: "2024-12-31",
    description: "Built useful features.",
};

const savedExperience = {
    id: experienceId,
    profile_id: userId,
    ...validInput,
    created_at: "2026-10-16T12:00:00Z",
};

beforeEach(() => {
    vi.resetAllMocks();

    mockCreateClient.mockResolvedValue({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    });

    mockGetUser.mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
    });

    mockFrom.mockReturnValue({
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
    });

    mockInsert.mockReturnValue({ select: mockSelect });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockDelete.mockReturnValue({ eq: mockEq });

    // Both update and delete call eq twice.
    mockEq.mockReturnValue({
        eq: mockEq,
        select: mockSelect,
    });

    mockSelect.mockReturnValue({
        single: mockSingle,
        maybeSingle: mockMaybeSingle,
    });

    mockSingle.mockResolvedValue({
        data: savedExperience,
        error: null,
    });

    mockMaybeSingle.mockResolvedValue({
        data: savedExperience,
        error: null,
    });
});

describe("addCurrentExperience", () => {
    it("rejects invalid input before creating a client", async () => {
        const result = await addCurrentExperience({
            ...validInput,
            company_name: "   ",
        });

        expect(result).toEqual({
            success: false,
            error: "Please check your profile details.",
        });
        expect(mockCreateClient).not.toHaveBeenCalled();
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("rejects an authentication error before querying", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: new Error("Auth failed"),
        });

        const result = await addCurrentExperience(validInput);

        expect(result).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        });
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("rejects a missing user before querying", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        const result = await addCurrentExperience(validInput);

        expect(result.success).toBe(false);
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("returns a failure when the insert errors", async () => {
        mockSingle.mockResolvedValue({
            data: null,
            error: new Error("Insert failed"),
        });

        const result = await addCurrentExperience(validInput);

        expect(result).toEqual({
            success: false,
            error: "Unable to save entry. Please try again.",
        });
    });

    it("returns a failure when no inserted row is returned", async () => {
        mockSingle.mockResolvedValue({
            data: null,
            error: null,
        });

        const result = await addCurrentExperience(validInput);

        expect(result).toEqual({
            success: false,
            error: "Entry was not returned. Please try again.",
        });
    });

    it("inserts one entry owned by the authenticated user", async () => {
        const result = await addCurrentExperience({
            ...validInput,
            profile_id: "someone-else",
            id: otherExperienceId,
        });

        expect(mockFrom).toHaveBeenCalledWith("profile_experience");
        expect(mockInsert).toHaveBeenCalledWith({
            profile_id: userId,
            ...validInput,
        });
        expect(result).toEqual({
            success: true,
            experience: savedExperience,
        });
    });

    it("stores omitted optional fields as null", async () => {
        await addCurrentExperience({
            company_name: "Example Company",
            job_role: "Software Developer",
            start_date: "2024-01-01",
        });

        expect(mockInsert).toHaveBeenCalledWith({
            profile_id: userId,
            company_name: "Example Company",
            job_role: "Software Developer",
            start_date: "2024-01-01",
            end_date: null,
            description: null,
        });
    });
});

describe("updateCurrentExperience", () => {
    it("rejects an invalid entry ID without querying", async () => {
        const result = await updateCurrentExperience(
            "not-a-uuid",
            validInput,
        );

        expect(result).toEqual({
            success: false,
            error: "Please check your experience details.",
        });
        expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it("rejects invalid details without querying", async () => {
        const result = await updateCurrentExperience(experienceId, {
            ...validInput,
            start_date: "not-a-date",
        });

        expect(result.success).toBe(false);
        expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it("rejects a missing user without updating", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        const result = await updateCurrentExperience(
            experienceId,
            validInput,
        );

        expect(result.success).toBe(false);
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("returns a failure when the update errors", async () => {
        mockMaybeSingle.mockResolvedValue({
            data: null,
            error: new Error("Update failed"),
        });

        const result = await updateCurrentExperience(
            experienceId,
            validInput,
        );

        expect(result).toEqual({
            success: false,
            error: "Unable to update your experience entry. Please try again.",
        });
    });

    it("returns not found when no owned entry matches", async () => {
        mockMaybeSingle.mockResolvedValue({
            data: null,
            error: null,
        });

        const result = await updateCurrentExperience(
            otherExperienceId,
            validInput,
        );

        expect(result).toEqual({
            success: false,
            error: "Experience entry not found.",
        });
        expect(mockEq).toHaveBeenCalledWith(
            "id",
            otherExperienceId,
        );
        expect(mockEq).toHaveBeenCalledWith(
            "profile_id",
            userId,
        );
    });

    it("updates only the requested entry owned by the user", async () => {
        const result = await updateCurrentExperience(
            experienceId,
            {
                ...validInput,
                company_name: "  Example Company  ",
                end_date: "",
                description: "   ",
                profile_id: "someone-else",
            },
        );

        expect(mockFrom).toHaveBeenCalledWith("profile_experience");
        expect(mockUpdate).toHaveBeenCalledWith({
            company_name: "Example Company",
            job_role: "Software Developer",
            start_date: "2024-01-01",
            end_date: null,
            description: null,
        });
        expect(mockEq).toHaveBeenCalledWith("id", experienceId);
        expect(mockEq).toHaveBeenCalledWith("profile_id", userId);
        expect(result).toEqual({
            success: true,
            experience: savedExperience,
        });
    });
});

describe("deleteCurrentExperience", () => {
    it("rejects an invalid entry ID without querying", async () => {
        const result = await deleteCurrentExperience("not-a-uuid");

        expect(result).toEqual({
            success: false,
            error: "Invalid experience entry ID.",
        });
        expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it("rejects an authentication error without deleting", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: new Error("Auth failed"),
        });

        const result = await deleteCurrentExperience(experienceId);

        expect(result).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        });
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("returns a failure when the delete errors", async () => {
        mockMaybeSingle.mockResolvedValue({
            data: null,
            error: new Error("Delete failed"),
        });

        const result = await deleteCurrentExperience(experienceId);

        expect(result).toEqual({
            success: false,
            error: "Unable to delete your experience entry. Please try again.",
        });
    });

    it("returns not found when no owned entry matches", async () => {
        mockMaybeSingle.mockResolvedValue({
            data: null,
            error: null,
        });

        const result = await deleteCurrentExperience(
            otherExperienceId,
        );

        expect(result).toEqual({
            success: false,
            error: "Experience entry not found.",
        });
        expect(mockEq).toHaveBeenCalledWith(
            "id",
            otherExperienceId,
        );
        expect(mockEq).toHaveBeenCalledWith(
            "profile_id",
            userId,
        );
    });

    it("deletes only the requested entry owned by the user", async () => {
        mockMaybeSingle.mockResolvedValue({
            data: { id: experienceId },
            error: null,
        });

        const result = await deleteCurrentExperience(experienceId);

        expect(mockFrom).toHaveBeenCalledWith("profile_experience");
        expect(mockDelete).toHaveBeenCalledOnce();
        expect(mockEq).toHaveBeenCalledWith("id", experienceId);
        expect(mockEq).toHaveBeenCalledWith("profile_id", userId);
        expect(mockSelect).toHaveBeenCalledWith("id");
        expect(result).toEqual({
            success: true,
            expId: experienceId,
        });
    });
});