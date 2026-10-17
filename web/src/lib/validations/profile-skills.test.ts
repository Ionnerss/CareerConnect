import { describe, expect, it } from "vitest";
import { profileSkillSchema } from "./profile-skills";

describe("Profile skill validation", () => {
    const validSkill = {
        name: "TypeScript",
        proficiency: "Intermediate",
    };

    it("accepts a valid skill and trims its name", () => {
        const result = profileSkillSchema.safeParse({
            name: "  TypeScript  ",
            proficiency: "Intermediate",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data).toEqual(validSkill);
        }
    });

    it.each(["Beginner", "Intermediate", "Advanced", "Expert"])(
        "accepts the %s proficiency level",
        (proficiency) => {
            const result = profileSkillSchema.safeParse({
                ...validSkill,
                proficiency,
            });

            expect(result.success).toBe(true);
        },
    );

    it.each(["", "   ", "\t\n"])(
        "rejects a blank skill name",
        (name) => {
            expect(
                profileSkillSchema.safeParse({
                    ...validSkill,
                    name,
                }).success,
            ).toBe(false);
        },
    );

    it("accepts 100 characters and rejects 101", () => {
        expect(
            profileSkillSchema.safeParse({
                ...validSkill,
                name: "a".repeat(100),
            }).success,
        ).toBe(true);

        expect(
            profileSkillSchema.safeParse({
                ...validSkill,
                name: "a".repeat(101),
            }).success,
        ).toBe(false);
    });

    it("checks the name length after trimming", () => {
        const result = profileSkillSchema.safeParse({
            ...validSkill,
            name: `  ${"a".repeat(100)}  `,
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.name).toBe("a".repeat(100));
        }
    });

    it.each(["Novice", "expert", "", null, 3])(
        "rejects an invalid proficiency value",
        (proficiency) => {
            expect(
                profileSkillSchema.safeParse({
                    ...validSkill,
                    proficiency,
                }).success,
            ).toBe(false);
        },
    );

    it.each([123, null, [], {}])(
        "rejects a non-string skill name",
        (name) => {
            expect(
                profileSkillSchema.safeParse({
                    ...validSkill,
                    name,
                }).success,
            ).toBe(false);
        },
    );

    it("rejects missing required fields", () => {
        expect(
            profileSkillSchema.safeParse({
                proficiency: "Beginner",
            }).success,
        ).toBe(false);

        expect(
            profileSkillSchema.safeParse({
                name: "TypeScript",
            }).success,
        ).toBe(false);
    });

    it("does not pass user-supplied ownership or generated fields through", () => {
        const result = profileSkillSchema.safeParse({
            ...validSkill,
            id: "someone-elses-entry",
            profile_id: "someone-elses-profile",
            created_at: "2020-01-01T00:00:00Z",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data).toEqual(validSkill);
        }
    });
});