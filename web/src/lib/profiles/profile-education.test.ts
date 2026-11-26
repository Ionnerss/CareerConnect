import { beforeEach, describe, expect, it, vi } from "vitest";
import { addCurrentEducation, getCurrentEducation } from "./profile-education";

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mocks.getUser },
        from: mocks.from,
    })),
}));

describe("getCurrentEducation", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.from.mockReturnValue({ select: mocks.select });
        mocks.select.mockReturnValue({ eq: mocks.eq });
        mocks.eq.mockReturnValue({ order: mocks.order });

        mocks.getUser.mockResolvedValue({
            data: { user: { id: "test-user-id" } },
            error: null,
        });
    });

    it("rejects a signed-out user without querying education", async () => {
        mocks.getUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        const result = await getCurrentEducation();

        expect(result).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        });
        expect(mocks.from).not.toHaveBeenCalled();
    });

    it("returns an empty array when the user has no education entries", async () => {
        mocks.order.mockResolvedValue({
            data: [],
            error: null,
        });

        const result = await getCurrentEducation();

        expect(result).toEqual({
            success: true,
            profileEducation: [],
        });
        expect(mocks.from).toHaveBeenCalledWith("profile_education");
        expect(mocks.eq).toHaveBeenCalledWith(
            "profile_id",
            "test-user-id",
        );
        expect(mocks.order).toHaveBeenCalledWith(
            "start_date",
            { ascending: false },
        );
    });

    it("returns multiple education entries for the current user", async () => {
        const entries = [
            {
                id: "education-2",
                profile_id: "test-user-id",
                school: "Second University",
                degree: "Master's",
                field_of_study: "Computer Science",
                start_date: "2025-09-01",
                end_date: null,
                description: null,
                created_at: "2025-09-01T12:00:00Z",
            },
            {
                id: "education-1",
                profile_id: "test-user-id",
                school: "First University",
                degree: "Bachelor's",
                field_of_study: "Software Engineering",
                start_date: "2021-09-01",
                end_date: "2025-05-31",
                description: "Completed degree.",
                created_at: "2021-09-01T12:00:00Z",
            },
        ];

        mocks.order.mockResolvedValue({
            data: entries,
            error: null,
        });

        const result = await getCurrentEducation();

        expect(result).toEqual({
            success: true,
            profileEducation: entries,
        });
        expect(mocks.from).toHaveBeenCalledWith("profile_education");
        expect(mocks.eq).toHaveBeenCalledWith(
            "profile_id",
            "test-user-id",
        );

        // Supabase performs the sorting; this mock returns the rows as given.
        expect(mocks.order).toHaveBeenCalledWith(
            "start_date",
            { ascending: false },
        );
    });

    it("returns a failure when the education query errors", async () => {
        mocks.order.mockResolvedValue({
            data: null,
            error: new Error("Database unavailable"),
        });

        const result = await getCurrentEducation();

        expect(result).toEqual({
            success: false,
            error: "Unable to load your education entries. Please try again.",
        });
        expect(mocks.from).toHaveBeenCalledWith("profile_education");
    });
});

describe("addCurrentEducation", () => {
    const valid = {
        school: "  Concordia University ",
        degree: "Bachelor's",
        start_date: "2023-09-01",
        field_of_study: "",
        end_date: "",
        description: "  Software engineering  ",
    };

    const insert = vi.fn();
    const insertSelect = vi.fn();
    const single = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.from.mockReturnValue({ insert });
        insert.mockReturnValue({ select: insertSelect });
        insertSelect.mockReturnValue({ single });
        mocks.getUser.mockResolvedValue({
            data: { user: { id: "test-user-id" } },
            error: null,
        });
    });

    it("rejects invalid details without signing in or saving", async () => {
        const result = await addCurrentEducation({ ...valid, school: "   " });

        expect(result).toEqual({ success: false, error: "Please check your profile details." });
        expect(mocks.getUser).not.toHaveBeenCalled();
        expect(insert).not.toHaveBeenCalled();
    });

    it("rejects an end date before the start date", async () => {
        const result = await addCurrentEducation({ ...valid, end_date: "2022-01-01" });

        expect(result.success).toBe(false);
        expect(insert).not.toHaveBeenCalled();
    });

    it("rejects a signed-out user without saving", async () => {
        mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

        expect(await addCurrentEducation(valid)).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        });
        expect(insert).not.toHaveBeenCalled();
    });

    it("saves the cleaned entry for the signed-in user", async () => {
        const saved = { id: "edu-1", profile_id: "test-user-id", school: "Concordia University" };
        single.mockResolvedValue({ data: saved, error: null });

        expect(await addCurrentEducation(valid)).toEqual({ success: true, education: saved });
        expect(mocks.from).toHaveBeenCalledWith("profile_education");
        expect(insert).toHaveBeenCalledWith({
            profile_id: "test-user-id",
            school: "Concordia University",
            degree: "Bachelor's",
            start_date: "2023-09-01",
            field_of_study: null,
            end_date: null,
            description: "Software engineering",
        });
    });

    it("returns a failure when the database refuses the entry", async () => {
        single.mockResolvedValue({ data: null, error: { message: "boom" } });

        expect(await addCurrentEducation(valid)).toEqual({
            success: false,
            error: "Unable to save entry Please try again.",
        });
    });

    it("returns a failure when no entry comes back", async () => {
        single.mockResolvedValue({ data: null, error: null });

        expect(await addCurrentEducation(valid)).toEqual({
            success: false,
            error: "Entry was not returned. Please try again.",
        });
    });
});
