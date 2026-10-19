import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    addPreferenceLanguage,
    deleteCurrentPreferences,
    deletePreferenceLanguage,
    getCurrentPreferenceLanguages,
    getCurrentPreferences,
    saveCurrentPreferences,
    updatePreferenceLanguage,
} from "./profile-preferences";

const { mockCreateClient } = vi.hoisted(() => ({
    mockCreateClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
    createClient: mockCreateClient,
}));

const userId = "22222222-2222-4222-8222-222222222222";
const languageId = "11111111-1111-4111-8111-111111111111";

const input = {
    desired_role: "Backend Developer",
    desired_position: "full_time",
    desired_salary: "85000.50",
    work_mode: "hybrid",
};

const savedPreferences = {
    profile_id: userId,
    desired_role: "Backend Developer",
    desired_position: "full_time",
    desired_salary: 85000.5,
    work_mode: "hybrid",
    created_at: "2026-10-18T00:00:00Z",
};

const savedLanguage = {
    id: languageId,
    profile_id: userId,
    name: "French",
    created_at: "2026-10-18T00:00:00Z",
};

function setup(options?: {
    user?: { id: string } | null;
    authError?: Error | null;
}) {
    const query = {
        select: vi.fn(),
        eq: vi.fn(),
        order: vi.fn(),
        upsert: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        single: vi.fn(),
        maybeSingle: vi.fn(),
    };

    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.upsert.mockReturnValue(query);
    query.insert.mockReturnValue(query);
    query.update.mockReturnValue(query);
    query.delete.mockReturnValue(query);

    query.order.mockResolvedValue({ data: [], error: null });
    query.single.mockResolvedValue({ data: null, error: null });
    query.maybeSingle.mockResolvedValue({ data: null, error: null });

    const getUser = vi.fn().mockResolvedValue({
        data: { user: options?.user === undefined ? { id: userId } : options.user },
        error: options?.authError ?? null,
    });

    const from = vi.fn().mockReturnValue(query);

    mockCreateClient.mockResolvedValue({
        auth: { getUser },
        from,
    });

    return { query, getUser, from };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("getCurrentPreferences", () => {
    it("stops when authentication fails", async () => {
        const { from } = setup({ user: null });

        expect(await getCurrentPreferences()).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        });
        expect(from).not.toHaveBeenCalled();
    });

    it("returns null when no preferences have been saved", async () => {
        const { query, from } = setup();

        expect(await getCurrentPreferences()).toEqual({
            success: true,
            preferences: null,
        });
        expect(from).toHaveBeenCalledWith("profile_preferences");
        expect(query.eq).toHaveBeenCalledWith("profile_id", userId);
    });

    it("returns the saved preferences", async () => {
        const { query } = setup();
        query.maybeSingle.mockResolvedValue({
            data: savedPreferences,
            error: null,
        });

        expect(await getCurrentPreferences()).toEqual({
            success: true,
            preferences: savedPreferences,
        });
    });

    it("reports database errors", async () => {
        const { query } = setup();
        query.maybeSingle.mockResolvedValue({
            data: null,
            error: { message: "Database unavailable" },
        });

        expect(await getCurrentPreferences()).toEqual({
            success: false,
            error: "Unable to load your preferences. Please try again.",
        });
    });
});

describe("saveCurrentPreferences", () => {
    it("rejects invalid input before creating a client", async () => {
        expect(
            await saveCurrentPreferences({
                ...input,
                desired_salary: "-5",
            }),
        ).toEqual({
            success: false,
            error: "Please check your preference details.",
        });

        expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it("stops before the database call when signed out", async () => {
        const { from } = setup({ user: null });

        expect(await saveCurrentPreferences(input)).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        });
        expect(from).not.toHaveBeenCalled();
    });

    it("creates a preference row using the authenticated user's ID", async () => {
        const { query, from } = setup();
        query.single.mockResolvedValue({
            data: savedPreferences,
            error: null,
        });

        const result = await saveCurrentPreferences({
            ...input,
            desired_role: "  Backend Developer  ",
            profile_id: "someone-else",
            created_at: "fake",
        });

        expect(result).toEqual({
            success: true,
            preferences: savedPreferences,
        });

        expect(from).toHaveBeenCalledWith("profile_preferences");
        expect(query.upsert).toHaveBeenCalledWith(
            {
                profile_id: userId,
                desired_role: "Backend Developer",
                desired_position: "full_time",
                desired_salary: 85000.5,
                work_mode: "hybrid",
            },
            { onConflict: "profile_id" },
        );
        expect(query.single).toHaveBeenCalledOnce();
    });

    it("uses the same upsert to update an existing row", async () => {
        const { query } = setup();
        const updated = {
            ...savedPreferences,
            desired_role: "Software Engineer",
        };

        query.single.mockResolvedValue({
            data: updated,
            error: null,
        });

        expect(
            await saveCurrentPreferences({
                ...input,
                desired_role: "Software Engineer",
            }),
        ).toEqual({
            success: true,
            preferences: updated,
        });

        expect(query.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                profile_id: userId,
                desired_role: "Software Engineer",
            }),
            { onConflict: "profile_id" },
        );
    });

    it("reports a database failure", async () => {
        const { query } = setup();
        query.single.mockResolvedValue({
            data: null,
            error: { message: "Upsert failed" },
        });

        expect(await saveCurrentPreferences(input)).toEqual({
            success: false,
            error: "Unable to save your preferences. Please try again.",
        });
    });

    it("fails when the save returns no row", async () => {
        setup();

        expect(await saveCurrentPreferences(input)).toEqual({
            success: false,
            error: "Unable to save your preferences. Please try again.",
        });
    });
});

describe("deleteCurrentPreferences", () => {
    it("deletes only the authenticated user's row", async () => {
        const { query } = setup();
        query.maybeSingle.mockResolvedValue({
            data: { profile_id: userId },
            error: null,
        });

        expect(await deleteCurrentPreferences()).toEqual({
            success: true,
            profileId: userId,
        });

        expect(query.delete).toHaveBeenCalledOnce();
        expect(query.eq).toHaveBeenCalledWith("profile_id", userId);
    });

    it("does not query when signed out", async () => {
        const { from } = setup({ user: null });

        expect(await deleteCurrentPreferences()).toMatchObject({
            success: false,
        });
        expect(from).not.toHaveBeenCalled();
    });

    it("distinguishes a missing row from a database error", async () => {
        const { query } = setup();

        expect(await deleteCurrentPreferences()).toEqual({
            success: false,
            error: "Preferences not found.",
        });

        query.maybeSingle.mockResolvedValue({
            data: null,
            error: { message: "Delete failed" },
        });

        expect(await deleteCurrentPreferences()).toEqual({
            success: false,
            error: "Unable to delete your preferences. Please try again.",
        });
    });
});

describe("getCurrentPreferenceLanguages", () => {
    it("returns an empty list for a user with no languages", async () => {
        const { query } = setup();

        expect(await getCurrentPreferenceLanguages()).toEqual({
            success: true,
            languages: [],
        });

        expect(query.eq).toHaveBeenCalledWith("profile_id", userId);
        expect(query.order).toHaveBeenCalledWith("name", {
            ascending: true,
        });
    });

    it("returns the listed languages", async () => {
        const { query } = setup();
        const languages = [
            { ...savedLanguage, name: "English" },
            savedLanguage,
        ];

        query.order.mockResolvedValue({
            data: languages,
            error: null,
        });

        expect(await getCurrentPreferenceLanguages()).toEqual({
            success: true,
            languages,
        });
    });

    it("handles authentication and database errors", async () => {
        const signedOut = setup({ user: null });

        expect(await getCurrentPreferenceLanguages()).toMatchObject({
            success: false,
        });
        expect(signedOut.from).not.toHaveBeenCalled();

        const { query } = setup();
        query.order.mockResolvedValue({
            data: null,
            error: { message: "Query failed" },
        });

        expect(await getCurrentPreferenceLanguages()).toEqual({
            success: false,
            error: "Unable to load your languages. Please try again.",
        });
    });
});

describe("addPreferenceLanguage", () => {
    it("rejects invalid input without creating a client", async () => {
        expect(await addPreferenceLanguage({ name: "  " })).toMatchObject({
            success: false,
        });

        expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it("stops when signed out", async () => {
        const { from } = setup({ user: null });

        expect(await addPreferenceLanguage({ name: "French" })).toMatchObject({
            success: false,
        });
        expect(from).not.toHaveBeenCalled();
    });

    it("inserts a trimmed name with the current user's ID", async () => {
        const { query, from } = setup();
        query.single.mockResolvedValue({
            data: savedLanguage,
            error: null,
        });

        expect(
            await addPreferenceLanguage({
                name: "  French  ",
                profile_id: "someone-else",
            }),
        ).toEqual({
            success: true,
            language: savedLanguage,
        });

        expect(from).toHaveBeenCalledWith(
            "profile_preference_languages",
        );
        expect(query.insert).toHaveBeenCalledWith({
            profile_id: userId,
            name: "French",
        });
    });

    it("reports a case-insensitive duplicate clearly", async () => {
        const { query } = setup();
        query.single.mockResolvedValue({
            data: null,
            error: { code: "23505" },
        });

        expect(
            await addPreferenceLanguage({ name: "french" }),
        ).toEqual({
            success: false,
            error: "You already added that language.",
        });
    });

    it("handles other database errors and a missing returned row", async () => {
        const { query } = setup();

        expect(
            await addPreferenceLanguage({ name: "French" }),
        ).toMatchObject({
            success: false,
        });

        query.single.mockResolvedValue({
            data: null,
            error: { code: "XX000" },
        });

        expect(
            await addPreferenceLanguage({ name: "French" }),
        ).toEqual({
            success: false,
            error: "Unable to add your language. Please try again.",
        });
    });
});

describe("updatePreferenceLanguage", () => {
    it("rejects a bad ID or name before creating a client", async () => {
        expect(
            await updatePreferenceLanguage("bad-id", { name: "French" }),
        ).toMatchObject({ success: false });

        expect(
            await updatePreferenceLanguage(languageId, { name: " " }),
        ).toMatchObject({ success: false });

        expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it("updates only the current user's matching language", async () => {
        const { query } = setup();
        query.maybeSingle.mockResolvedValue({
            data: savedLanguage,
            error: null,
        });

        expect(
            await updatePreferenceLanguage(languageId, {
                name: "  French  ",
                profile_id: "someone-else",
            }),
        ).toEqual({
            success: true,
            language: savedLanguage,
        });

        expect(query.update).toHaveBeenCalledWith({ name: "French" });
        expect(query.eq).toHaveBeenCalledWith("id", languageId);
        expect(query.eq).toHaveBeenCalledWith("profile_id", userId);
    });

    it("returns not found for a missing or other user's language", async () => {
        setup();

        expect(
            await updatePreferenceLanguage(languageId, {
                name: "French",
            }),
        ).toEqual({
            success: false,
            error: "Language not found.",
        });
    });

    it("handles duplicate and other database errors", async () => {
        const { query } = setup();
        query.maybeSingle.mockResolvedValue({
            data: null,
            error: { code: "23505" },
        });

        expect(
            await updatePreferenceLanguage(languageId, {
                name: "French",
            }),
        ).toEqual({
            success: false,
            error: "You already added that language.",
        });

        query.maybeSingle.mockResolvedValue({
            data: null,
            error: { code: "XX000" },
        });

        expect(
            await updatePreferenceLanguage(languageId, {
                name: "French",
            }),
        ).toEqual({
            success: false,
            error: "Unable to update your language. Please try again.",
        });
    });

    it("does not query when signed out", async () => {
        const { from } = setup({ user: null });

        expect(
            await updatePreferenceLanguage(languageId, {
                name: "French",
            }),
        ).toMatchObject({ success: false });

        expect(from).not.toHaveBeenCalled();
    });
});

describe("deletePreferenceLanguage", () => {
    it("rejects a bad ID before creating a client", async () => {
        expect(
            await deletePreferenceLanguage("bad-id"),
        ).toMatchObject({ success: false });

        expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it("deletes only the current user's matching language", async () => {
        const { query } = setup();
        query.maybeSingle.mockResolvedValue({
            data: { id: languageId },
            error: null,
        });

        expect(await deletePreferenceLanguage(languageId)).toEqual({
            success: true,
            languageId,
        });

        expect(query.delete).toHaveBeenCalledOnce();
        expect(query.eq).toHaveBeenCalledWith("id", languageId);
        expect(query.eq).toHaveBeenCalledWith("profile_id", userId);
    });

    it("returns not found for a missing or other user's language", async () => {
        setup();

        expect(await deletePreferenceLanguage(languageId)).toEqual({
            success: false,
            error: "Language not found.",
        });
    });

    it("handles authentication and database errors", async () => {
        const signedOut = setup({ user: null });

        expect(
            await deletePreferenceLanguage(languageId),
        ).toMatchObject({ success: false });
        expect(signedOut.from).not.toHaveBeenCalled();

        const { query } = setup();
        query.maybeSingle.mockResolvedValue({
            data: null,
            error: { message: "Delete failed" },
        });

        expect(await deletePreferenceLanguage(languageId)).toEqual({
            success: false,
            error: "Unable to delete your language. Please try again.",
        });
    });
});