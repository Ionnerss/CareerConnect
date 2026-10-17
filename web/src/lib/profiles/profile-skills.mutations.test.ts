import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    addCurrentSkill,
    updateCurrentSkill,
    deleteCurrentSkill,
} from "./profile-skills";

const {
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
    createClient: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    })),
}));

const skillId = "550e8400-e29b-41d4-a716-446655440000";
const userId = "test-user-id";

const validInput = {
    name: "TypeScript",
    proficiency: "Advanced",
};

const savedSkill = {
    id: skillId,
    profile_id: userId,
    name: "TypeScript",
    proficiency: "Advanced",
    created_at: "2026-10-17T00:00:00Z",
};

describe("profile skill mutations", () => {
    beforeEach(() => {
        vi.clearAllMocks();

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

        // Both update and delete call eq twice before select.
        mockEq.mockReturnValue({
            eq: mockEq,
            select: mockSelect,
        });

        mockSelect.mockReturnValue({
            single: mockSingle,
            maybeSingle: mockMaybeSingle,
        });

        mockSingle.mockResolvedValue({
            data: savedSkill,
            error: null,
        });
        mockMaybeSingle.mockResolvedValue({
            data: savedSkill,
            error: null,
        });
    });

    describe("addCurrentSkill", () => {
        it("inserts a skill for the authenticated user", async () => {
            const result = await addCurrentSkill(validInput);

            expect(mockFrom).toHaveBeenCalledWith("profile_skills");
            expect(mockInsert).toHaveBeenCalledWith({
                profile_id: userId,
                name: "TypeScript",
                proficiency: "Advanced",
            });
            expect(mockSelect).toHaveBeenCalledWith(
                "id, profile_id, name, proficiency, created_at",
            );
            expect(result).toEqual({
                success: true,
                skill: savedSkill,
            });
        });

        it("inserts the trimmed name from the validator", async () => {
            await addCurrentSkill({
                name: "  TypeScript  ",
                proficiency: "Advanced",
                id: "client-supplied-id",
                profile_id: "another-user-id",
            });

            expect(mockInsert).toHaveBeenCalledWith({
                profile_id: userId,
                name: "TypeScript",
                proficiency: "Advanced",
            });
        });

        it("rejects invalid input before authentication or database access", async () => {
            const result = await addCurrentSkill({
                name: "   ",
                proficiency: "Advanced",
            });

            expect(result).toEqual({
                success: false,
                error: "Please check your skill details.",
            });
            expect(mockGetUser).not.toHaveBeenCalled();
            expect(mockFrom).not.toHaveBeenCalled();
        });

        it("rejects a signed-out user before database access", async () => {
            mockGetUser.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            expect(await addCurrentSkill(validInput)).toEqual({
                success: false,
                error: "Unable to authenticate. Please sign in again.",
            });
            expect(mockFrom).not.toHaveBeenCalled();
        });

        it("reports a duplicate skill name", async () => {
            mockSingle.mockResolvedValue({
                data: null,
                error: { code: "23505", message: "Unique violation" },
            });

            expect(await addCurrentSkill(validInput)).toEqual({
                success: false,
                error: "You already have a skill with that name.",
            });
        });

        it("reports another database error", async () => {
            mockSingle.mockResolvedValue({
                data: null,
                error: { code: "XX000", message: "Database failed" },
            });

            expect(await addCurrentSkill(validInput)).toEqual({
                success: false,
                error: "Unable to add your skill. Please try again.",
            });
        });

        it("fails if the insert returns no skill", async () => {
            mockSingle.mockResolvedValue({
                data: null,
                error: null,
            });

            expect(await addCurrentSkill(validInput)).toEqual({
                success: false,
                error: "Skill was not returned. Please try again.",
            });
        });
    });

    describe("updateCurrentSkill", () => {
        it("updates only the authenticated user's matching skill", async () => {
            const result = await updateCurrentSkill(skillId, {
                name: "  TypeScript  ",
                proficiency: "Expert",
            });

            expect(mockFrom).toHaveBeenCalledWith("profile_skills");
            expect(mockUpdate).toHaveBeenCalledWith({
                name: "TypeScript",
                proficiency: "Expert",
            });
            expect(mockEq).toHaveBeenCalledWith("id", skillId);
            expect(mockEq).toHaveBeenCalledWith("profile_id", userId);
            expect(mockSelect).toHaveBeenCalledWith(
                "id, profile_id, name, proficiency, created_at",
            );
            expect(result).toEqual({
                success: true,
                skill: savedSkill,
            });
        });

        it("rejects an invalid ID before database access", async () => {
            expect(
                await updateCurrentSkill("not-a-uuid", validInput),
            ).toEqual({
                success: false,
                error: "Please check your skill details.",
            });
            expect(mockGetUser).not.toHaveBeenCalled();
            expect(mockFrom).not.toHaveBeenCalled();
        });

        it("rejects invalid skill details before database access", async () => {
            expect(
                await updateCurrentSkill(skillId, {
                    name: "",
                    proficiency: "Advanced",
                }),
            ).toEqual({
                success: false,
                error: "Please check your skill details.",
            });
            expect(mockFrom).not.toHaveBeenCalled();
        });

        it("rejects a signed-out user before database access", async () => {
            mockGetUser.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            expect(
                await updateCurrentSkill(skillId, validInput),
            ).toEqual({
                success: false,
                error: "Unable to authenticate. Please sign in again.",
            });
            expect(mockFrom).not.toHaveBeenCalled();
        });

        it("returns not found when no owned skill matches", async () => {
            mockMaybeSingle.mockResolvedValue({
                data: null,
                error: null,
            });

            expect(
                await updateCurrentSkill(skillId, validInput),
            ).toEqual({
                success: false,
                error: "Skill not found.",
            });
            expect(mockEq).toHaveBeenCalledWith("profile_id", userId);
        });

        it("reports a duplicate name on update", async () => {
            mockMaybeSingle.mockResolvedValue({
                data: null,
                error: { code: "23505", message: "Unique violation" },
            });

            expect(
                await updateCurrentSkill(skillId, validInput),
            ).toEqual({
                success: false,
                error: "You already have a skill with that name.",
            });
        });

        it("reports another update error", async () => {
            mockMaybeSingle.mockResolvedValue({
                data: null,
                error: { code: "XX000", message: "Database failed" },
            });

            expect(
                await updateCurrentSkill(skillId, validInput),
            ).toEqual({
                success: false,
                error: "Unable to update your skill. Please try again.",
            });
        });
    });

    describe("deleteCurrentSkill", () => {
        it("deletes only the authenticated user's matching skill", async () => {
            mockMaybeSingle.mockResolvedValue({
                data: { id: skillId },
                error: null,
            });

            expect(await deleteCurrentSkill(skillId)).toEqual({
                success: true,
                skillId,
            });

            expect(mockFrom).toHaveBeenCalledWith("profile_skills");
            expect(mockDelete).toHaveBeenCalledOnce();
            expect(mockEq).toHaveBeenCalledWith("id", skillId);
            expect(mockEq).toHaveBeenCalledWith("profile_id", userId);
            expect(mockSelect).toHaveBeenCalledWith("id");
        });

        it("rejects an invalid ID before database access", async () => {
            expect(await deleteCurrentSkill("not-a-uuid")).toEqual({
                success: false,
                error: "Invalid skill ID.",
            });
            expect(mockGetUser).not.toHaveBeenCalled();
            expect(mockFrom).not.toHaveBeenCalled();
        });

        it("rejects a signed-out user before database access", async () => {
            mockGetUser.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            expect(await deleteCurrentSkill(skillId)).toEqual({
                success: false,
                error: "Unable to authenticate. Please sign in again.",
            });
            expect(mockFrom).not.toHaveBeenCalled();
        });

        it("returns not found when no owned skill matches", async () => {
            mockMaybeSingle.mockResolvedValue({
                data: null,
                error: null,
            });

            expect(await deleteCurrentSkill(skillId)).toEqual({
                success: false,
                error: "Skill not found.",
            });
            expect(mockEq).toHaveBeenCalledWith("profile_id", userId);
        });

        it("reports a deletion error", async () => {
            mockMaybeSingle.mockResolvedValue({
                data: null,
                error: { message: "Database failed" },
            });

            expect(await deleteCurrentSkill(skillId)).toEqual({
                success: false,
                error: "Unable to delete your skill. Please try again.",
            });
        });
    });
});