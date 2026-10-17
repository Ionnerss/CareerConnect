import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    deleteCurrentEducation,
    updateCurrentEducation,
} from "./profile-education";

const {
    mockGetUser,
    mockFrom,
    mockUpdate,
    mockDelete,
    mockEq,
    mockSelect,
    mockMaybeSingle,
} = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
    mockEq: vi.fn(),
    mockSelect: vi.fn(),
    mockMaybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    })),
}));

const userId = "test-user-id";
const educationId = "11111111-1111-4111-8111-111111111111";

const validInput = {
    school: "Concordia University",
    degree: "Bachelor of Engineering",
    field_of_study: "Software Engineering",
    start_date: "2024-09-01",
    end_date: "2028-05-01",
    description: "Studying software engineering.",
};

const savedEducation = {
    id: educationId,
    profile_id: userId,
    created_at: "2026-10-15T00:00:00Z",
    ...validInput,
};

describe("updateCurrentEducation", () => {
    beforeEach(() => {
        vi.resetAllMocks();

        const query = {
            eq: mockEq,
            select: mockSelect,
            maybeSingle: mockMaybeSingle,
        };

        mockFrom.mockReturnValue({
            update: mockUpdate,
            delete: mockDelete,
        });
        mockUpdate.mockReturnValue(query);
        mockDelete.mockReturnValue(query);
        mockEq.mockReturnValue(query);
        mockSelect.mockReturnValue(query);

        mockGetUser.mockResolvedValue({
            data: { user: { id: userId } },
            error: null,
        });

        mockMaybeSingle.mockResolvedValue({
            data: savedEducation,
            error: null,
        });
    });

    it("rejects an invalid entry ID before querying the database", async () => {
        const result = await updateCurrentEducation("not-a-uuid", validInput);

        expect(result).toEqual({
            success: false,
            error: "Please check your education details.",
        });
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("rejects invalid input before querying the database", async () => {
        const result = await updateCurrentEducation(educationId, {
            ...validInput,
            school: "",
        });

        expect(result).toEqual({
            success: false,
            error: "Please check your education details.",
        });
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("stops when authentication fails", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: new Error("Auth failed"),
        });

        const result = await updateCurrentEducation(
            educationId,
            validInput,
        );

        expect(result).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        });
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("stops when no user is authenticated", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        const result = await updateCurrentEducation(
            educationId,
            validInput,
        );

        expect(result.success).toBe(false);
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("returns a failure when the update errors", async () => {
        mockMaybeSingle.mockResolvedValue({
            data: null,
            error: new Error("Database error"),
        });

        const result = await updateCurrentEducation(
            educationId,
            validInput,
        );

        expect(result).toEqual({
            success: false,
            error: "Unable to update your education entry. Please try again.",
        });
    });

    it("returns not found when no entry matches", async () => {
        mockMaybeSingle.mockResolvedValue({
            data: null,
            error: null,
        });

        const result = await updateCurrentEducation(
            educationId,
            validInput,
        );

        expect(result).toEqual({
            success: false,
            error: "Education entry not found.",
        });
    });

    it("updates only the selected entry belonging to the current user", async () => {
        const result = await updateCurrentEducation(
            educationId,
            validInput,
        );

        expect(mockFrom).toHaveBeenCalledWith("profile_education");
        expect(mockUpdate).toHaveBeenCalledWith(validInput);
        expect(mockEq).toHaveBeenNthCalledWith(1, "id", educationId);
        expect(mockEq).toHaveBeenNthCalledWith(
            2,
            "profile_id",
            userId,
        );
        expect(result).toEqual({
            success: true,
            education: savedEducation,
        });
    });

    it("sends null for omitted optional fields", async () => {
        const input = {
            school: "Concordia University",
            degree: "Bachelor of Engineering",
            start_date: "2024-09-01",
        };

        mockMaybeSingle.mockResolvedValue({
            data: {
                ...savedEducation,
                ...input,
                field_of_study: null,
                end_date: null,
                description: null,
            },
            error: null,
        });

        const result = await updateCurrentEducation(
            educationId,
            input,
        );

        expect(result.success).toBe(true);
        expect(mockUpdate).toHaveBeenCalledWith({
            ...input,
            field_of_study: null,
            end_date: null,
            description: null,
        });
    });
});

describe("deleteCurrentEducation", () => {
    beforeEach(() => {
        vi.resetAllMocks();

        const query = {
            eq: mockEq,
            select: mockSelect,
            maybeSingle: mockMaybeSingle,
        };

        mockFrom.mockReturnValue({ delete: mockDelete });
        mockDelete.mockReturnValue(query);
        mockEq.mockReturnValue(query);
        mockSelect.mockReturnValue(query);

        mockGetUser.mockResolvedValue({
            data: { user: { id: userId } },
            error: null,
        });

        mockMaybeSingle.mockResolvedValue({
            data: { id: educationId },
            error: null,
        });
    });

    it("rejects an invalid entry ID before querying the database", async () => {
        const result = await deleteCurrentEducation("not-a-uuid");

        expect(result).toEqual({
            success: false,
            error: "Invalid education entry ID.",
        });
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("stops when authentication fails", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: new Error("Auth failed"),
        });

        const result = await deleteCurrentEducation(educationId);

        expect(result).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        });
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("stops when no user is authenticated", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        const result = await deleteCurrentEducation(educationId);

        expect(result.success).toBe(false);
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("returns a failure when deletion errors", async () => {
        mockMaybeSingle.mockResolvedValue({
            data: null,
            error: new Error("Database error"),
        });

        const result = await deleteCurrentEducation(educationId);

        expect(result).toEqual({
            success: false,
            error: "Unable to delete your education entry. Please try again.",
        });
    });

    it("returns not found when no entry matches", async () => {
        mockMaybeSingle.mockResolvedValue({
            data: null,
            error: null,
        });

        const result = await deleteCurrentEducation(educationId);

        expect(result).toEqual({
            success: false,
            error: "Education entry not found.",
        });
    });

    it("deletes only the selected entry belonging to the current user", async () => {
        const result = await deleteCurrentEducation(educationId);

        expect(mockFrom).toHaveBeenCalledWith("profile_education");
        expect(mockDelete).toHaveBeenCalledOnce();
        expect(mockEq).toHaveBeenNthCalledWith(1, "id", educationId);
        expect(mockEq).toHaveBeenNthCalledWith(
            2,
            "profile_id",
            userId,
        );
        expect(mockSelect).toHaveBeenCalledWith("id");
        expect(result).toEqual({
            success: true,
            educationId,
        });
    });
});