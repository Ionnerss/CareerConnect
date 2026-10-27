import { describe, expect, it } from "vitest";
import { profileEducationSchema } from "./profile-education";

describe("Profile education sections validations", () => {
    const validEducation = {
        school: "Concordia University",
        degree: "Bachelor of Engineering",
        field_of_study: "Software Engineering",
        start_date: "2022-09-01",
        end_date: "2026-05-31",
        description: "Studied software engineering.",
    };

    it("accepts a complete education entry", () => {
        const result = profileEducationSchema.safeParse(validEducation);

        expect(result.success).toBe(true);
    });

    it("trims surrounding spaces from school, degree, and field of study", () => {
        const result = profileEducationSchema.safeParse({
            ...validEducation,
            school: "  Concordia University  ",
            degree: "  Bachelor of Engineering  ",
            field_of_study: "  Software Engineering  ",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.school).toBe("Concordia University");
            expect(result.data.degree).toBe("Bachelor of Engineering");
            expect(result.data.field_of_study).toBe("Software Engineering");
        }
    });

    it.each(["school", "degree"] as const)(
        "rejects a blank required %s",
        (field) => {
            const result = profileEducationSchema.safeParse({
                ...validEducation,
                [field]: "   ",
            });

            expect(result.success).toBe(false);
        },
    );

    it.each(["school", "degree", "field_of_study"] as const)(
        "accepts 200 characters and rejects 201 for %s",
        (field) => {
            const atLimit = profileEducationSchema.safeParse({
                ...validEducation,
                [field]: "a".repeat(200),
            });

            const overLimit = profileEducationSchema.safeParse({
                ...validEducation,
                [field]: "a".repeat(201),
            });

            expect(atLimit.success).toBe(true);
            expect(overLimit.success).toBe(false);
        },
    );

    it("accepts blank optional fields and converts them to null", () => {
        const result = profileEducationSchema.safeParse({
            ...validEducation,
            field_of_study: "   ",
            end_date: "",
            description: " \n ",
        });
        
        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.field_of_study).toBeNull();
            expect(result.data.end_date).toBeNull();
            expect(result.data.description).toBeNull();
        }
    });

    it("accepts null optional fields", () => {
        const result = profileEducationSchema.safeParse({
            ...validEducation,
            field_of_study: null,
            end_date: null,
            description: null,
        });

        expect(result.success).toBe(true);
    });

    it("accepts omitted optional fields", () => {
        const result = profileEducationSchema.safeParse({
            school: validEducation.school,
            degree: validEducation.degree,
            start_date: validEducation.start_date,
        });

        expect(result.success).toBe(true);
    });

    it("accepts exactly 500 words and rejects 501 words", () => {
        const atLimit = profileEducationSchema.safeParse({
            ...validEducation,
            description: "word ".repeat(500),
        });

        const overLimit = profileEducationSchema.safeParse({
            ...validEducation,
            description: "word ".repeat(501),
        });

        expect(atLimit.success).toBe(true);
        expect(overLimit.success).toBe(false);
    });

    it("counts words separated by spaces, tabs, and paragraph breaks", () => {
        const result = profileEducationSchema.safeParse({
            ...validEducation,
            description: "  First\tparagraph.\n\nSecond paragraph.  ",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.description).toBe(
                "First\tparagraph.\n\nSecond paragraph.",
            );
        }
    });

    it("rejects a missing start date", () => {
        const withoutStartDate = {
            school: validEducation.school,
            degree: validEducation.degree,
            field_of_study: validEducation.field_of_study,
            end_date: validEducation.end_date,
            description: validEducation.description,
        };

        expect(
            profileEducationSchema.safeParse(withoutStartDate).success,
        ).toBe(false);
    });

    it.each([
        "2026-1-01",
        "2026-02-30",
        "not-a-date",
        "",
    ])("rejects invalid start date %s", (start_date) => {
        expect(
            profileEducationSchema.safeParse({
                ...validEducation,
                start_date,
            }).success,
        ).toBe(false);
    });

    it("rejects an invalid end date", () => {
        expect(
            profileEducationSchema.safeParse({
                ...validEducation,
                end_date: "2026-02-30",
            }).success,
        ).toBe(false);
    });

    it("rejects an end date before the start date", () => {
        const result = profileEducationSchema.safeParse({
            ...validEducation,
            start_date: "2024-09-01",
            end_date: "2024-08-31",
        });

        expect(result.success).toBe(false);

        if (!result.success) {
            expect(result.error.issues.some(
                (issue) => issue.path.includes("end_date"),
            )).toBe(true);
        }
    });

    it("accepts an end date equal to the start date", () => {
        expect(
            profileEducationSchema.safeParse({
                ...validEducation,
                start_date: "2024-09-01",
                end_date: "2024-09-01",
            }).success,
        ).toBe(true);
    });

    it("rejects wrong field types", () => {
        expect(
            profileEducationSchema.safeParse({
                ...validEducation,
                school: 123,
            }).success,
        ).toBe(false);

        expect(
            profileEducationSchema.safeParse({
                ...validEducation,
                description: 123,
            }).success,
        ).toBe(false);

        expect(
            profileEducationSchema.safeParse({
                ...validEducation,
                start_date: new Date(),
            }).success,
        ).toBe(false);
    });

    it("does not pass user-supplied ownership or generated fields through", () => {
        const result = profileEducationSchema.safeParse({
            ...validEducation,
            id: "another-entry-id",
            profile_id: "another-user-id",
            created_at: "2020-01-01",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data).not.toHaveProperty("id");
            expect(result.data).not.toHaveProperty("profile_id");
            expect(result.data).not.toHaveProperty("created_at");
        }
    });
});