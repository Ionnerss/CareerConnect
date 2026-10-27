import { describe, expect, it } from "vitest";
import {
    profilePreferenceLanguageSchema,
    profilePreferencesSchema,
} from "./profile-preferences";

describe("profilePreferencesSchema", () => {
    const validPreferences = {
        desired_role: "Backend Developer",
        desired_position: "full_time",
        desired_salary: 85000.5,
        work_mode: "hybrid",
    };

    it("accepts and normalizes valid preferences", () => {
        const result = profilePreferencesSchema.safeParse({
            desired_role: "  Backend Developer  ",
            desired_position: "full_time",
            desired_salary: " 85000.50 ",
            work_mode: "hybrid",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data).toEqual({
                desired_role: "Backend Developer",
                desired_position: "full_time",
                desired_salary: 85000.5,
                work_mode: "hybrid",
            });
        }
    });

    it("converts blank and omitted optional fields to null", () => {
        const blank = profilePreferencesSchema.safeParse({
            desired_role: " \t ",
            desired_position: "",
            desired_salary: "  ",
            work_mode: "",
        });

        const omitted = profilePreferencesSchema.safeParse({});

        expect(blank.success).toBe(true);
        expect(omitted.success).toBe(true);

        const expected = {
            desired_role: null,
            desired_position: null,
            desired_salary: null,
            work_mode: null,
        };

        if (blank.success) expect(blank.data).toEqual(expected);
        if (omitted.success) expect(omitted.data).toEqual(expected);
    });

    it("accepts explicit null values", () => {
        const result = profilePreferencesSchema.safeParse({
            desired_role: null,
            desired_position: null,
            desired_salary: null,
            work_mode: null,
        });

        expect(result.success).toBe(true);
    });

    it("accepts 150 characters and rejects 151 for desired_role", () => {
        expect(
            profilePreferencesSchema.safeParse({
                ...validPreferences,
                desired_role: "a".repeat(150),
            }).success,
        ).toBe(true);

        expect(
            profilePreferencesSchema.safeParse({
                ...validPreferences,
                desired_role: "a".repeat(151),
            }).success,
        ).toBe(false);
    });

    it.each(["full_time", "part_time", "internship", "contract"])(
        "accepts desired_position %s",
        (desired_position) => {
            expect(
                profilePreferencesSchema.safeParse({
                    ...validPreferences,
                    desired_position,
                }).success,
            ).toBe(true);
        },
    );

    it.each(["remote", "hybrid", "on_site", "no_preference"])(
        "accepts work_mode %s",
        (work_mode) => {
            expect(
                profilePreferencesSchema.safeParse({
                    ...validPreferences,
                    work_mode,
                }).success,
            ).toBe(true);
        },
    );

    it("rejects invalid enum values", () => {
        expect(
            profilePreferencesSchema.safeParse({
                ...validPreferences,
                desired_position: "permanent",
            }).success,
        ).toBe(false);

        expect(
            profilePreferencesSchema.safeParse({
                ...validPreferences,
                work_mode: "physical",
            }).success,
        ).toBe(false);
    });

    it.each([
        0,
        -1,
        "0",
        "-100",
        "100.123",
        "100.00.00",
        "not a number",
        "10000000000",
        10000000000,
        Number.POSITIVE_INFINITY,
    ])("rejects invalid salary %s", (desired_salary) => {
        expect(
            profilePreferencesSchema.safeParse({
                ...validPreferences,
                desired_salary,
            }).success,
        ).toBe(false);
    });

    it("accepts the maximum numeric(12,2) salary", () => {
        const result = profilePreferencesSchema.safeParse({
            ...validPreferences,
            desired_salary: "9999999999.99",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.desired_salary).toBe(9999999999.99);
        }
    });

    it("rejects wrong field types", () => {
        expect(
            profilePreferencesSchema.safeParse({
                ...validPreferences,
                desired_role: 123,
            }).success,
        ).toBe(false);

        expect(
            profilePreferencesSchema.safeParse({
                ...validPreferences,
                desired_position: true,
            }).success,
        ).toBe(false);

        expect(
            profilePreferencesSchema.safeParse({
                ...validPreferences,
                desired_salary: {},
            }).success,
        ).toBe(false);

        expect(
            profilePreferencesSchema.safeParse({
                ...validPreferences,
                work_mode: [],
            }).success,
        ).toBe(false);
    });

    it("removes submitted ownership and generated fields", () => {
        const result = profilePreferencesSchema.safeParse({
            ...validPreferences,
            profile_id: "someone-else",
            id: "fake-id",
            created_at: "2026-01-01",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data).toEqual(validPreferences);
            expect(result.data).not.toHaveProperty("profile_id");
            expect(result.data).not.toHaveProperty("id");
            expect(result.data).not.toHaveProperty("created_at");
        }
    });
});

describe("profilePreferenceLanguageSchema", () => {
    it("trims a valid language name", () => {
        const result = profilePreferenceLanguageSchema.safeParse({
            name: "  English  ",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.name).toBe("English");
        }
    });

    it("rejects blank, missing, and wrong-type names", () => {
        expect(
            profilePreferenceLanguageSchema.safeParse({
                name: " \t ",
            }).success,
        ).toBe(false);

        expect(
            profilePreferenceLanguageSchema.safeParse({}).success,
        ).toBe(false);

        expect(
            profilePreferenceLanguageSchema.safeParse({
                name: 123,
            }).success,
        ).toBe(false);
    });

    it("accepts 100 characters and rejects 101", () => {
        expect(
            profilePreferenceLanguageSchema.safeParse({
                name: "a".repeat(100),
            }).success,
        ).toBe(true);

        expect(
            profilePreferenceLanguageSchema.safeParse({
                name: "a".repeat(101),
            }).success,
        ).toBe(false);
    });

    it("removes submitted ownership and generated fields", () => {
        const result = profilePreferenceLanguageSchema.safeParse({
            name: "French",
            profile_id: "someone-else",
            id: "fake-id",
            created_at: "2026-01-01",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data).toEqual({ name: "French" });
        }
    });
});