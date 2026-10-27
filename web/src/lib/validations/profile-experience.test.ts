import { describe, expect, it } from "vitest";
import { profileExperienceSchema } from "./profile-experience";

describe("Profile experience validation", () => {
    const validExperience = {
        company_name: "Example Company",
        job_role: "Software Engineer",
        start_date: "2024-01-01",
        end_date: "2025-01-01",
        description: "Built and maintained applications.",
    };

    it("accepts a complete experience entry", () => {
        const result = profileExperienceSchema.safeParse(validExperience);

        expect(result.success).toBe(true);
    });

    it("trims company name and job role", () => {
        const result = profileExperienceSchema.safeParse({
            ...validExperience,
            company_name: "  Example Company  ",
            job_role: "  Software Engineer  ",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.company_name).toBe("Example Company");
            expect(result.data.job_role).toBe("Software Engineer");
        }
    });

    it.each(["company_name", "job_role"] as const)(
        "rejects a blank %s",
        (field) => {
            const result = profileExperienceSchema.safeParse({
                ...validExperience,
                [field]: "   ",
            });

            expect(result.success).toBe(false);
        },
    );

    it.each(["company_name", "job_role"] as const)(
        "accepts 200 characters and rejects 201 for %s",
        (field) => {
            const atLimit = profileExperienceSchema.safeParse({
                ...validExperience,
                [field]: "a".repeat(200),
            });

            const overLimit = profileExperienceSchema.safeParse({
                ...validExperience,
                [field]: "a".repeat(201),
            });

            expect(atLimit.success).toBe(true);
            expect(overLimit.success).toBe(false);
        },
    );

    it("converts blank optional fields to null", () => {
        const result = profileExperienceSchema.safeParse({
            ...validExperience,
            end_date: "   ",
            description: " \n\t ",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.end_date).toBeNull();
            expect(result.data.description).toBeNull();
        }
    });

    it("accepts null optional fields", () => {
        const result = profileExperienceSchema.safeParse({
            ...validExperience,
            end_date: null,
            description: null,
        });

        expect(result.success).toBe(true);
    });

    it("accepts omitted optional fields", () => {
        const result = profileExperienceSchema.safeParse({
            company_name: "Example Company",
            job_role: "Software Engineer",
            start_date: "2024-01-01",
        });

        expect(result.success).toBe(true);
    });

    it("trims a nonblank description", () => {
        const result = profileExperienceSchema.safeParse({
            ...validExperience,
            description: "  First paragraph.\n\nSecond paragraph.  ",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.description).toBe(
                "First paragraph.\n\nSecond paragraph.",
            );
        }
    });

    it("accepts 500 description words and rejects 501", () => {
        const atLimit = profileExperienceSchema.safeParse({
            ...validExperience,
            description: Array(500).fill("word").join(" "),
        });

        const overLimit = profileExperienceSchema.safeParse({
            ...validExperience,
            description: Array(501).fill("word").join(" "),
        });

        expect(atLimit.success).toBe(true);
        expect(overLimit.success).toBe(false);
    });

    it("counts words separated by tabs and paragraph breaks", () => {
        const result = profileExperienceSchema.safeParse({
            ...validExperience,
            description: Array(501).fill("word").join("\t\n"),
        });

        expect(result.success).toBe(false);
    });

    it("rejects a missing start date", () => {
        const result = profileExperienceSchema.safeParse({
            company_name: "Example Company",
            job_role: "Software Engineer",
        });

        expect(result.success).toBe(false);
    });

    it.each(["2026-1-01", "2026-02-30", "not-a-date", ""])(
        "rejects invalid start date %s",
        (start_date) => {
            const result = profileExperienceSchema.safeParse({
                ...validExperience,
                start_date,
            });

            expect(result.success).toBe(false);
        },
    );

    it("rejects an invalid nonblank end date", () => {
        const result = profileExperienceSchema.safeParse({
            ...validExperience,
            end_date: "2026-02-30",
        });

        expect(result.success).toBe(false);
    });

    it("rejects an end date before the start date", () => {
        const result = profileExperienceSchema.safeParse({
            ...validExperience,
            start_date: "2025-01-01",
            end_date: "2024-12-31",
        });

        expect(result.success).toBe(false);
    });

    it("accepts an end date equal to the start date", () => {
        const result = profileExperienceSchema.safeParse({
            ...validExperience,
            start_date: "2025-01-01",
            end_date: "2025-01-01",
        });

        expect(result.success).toBe(true);
    });

    it("rejects wrong field types", () => {
        for (const input of [
            { ...validExperience, company_name: 123 },
            { ...validExperience, job_role: true },
            { ...validExperience, start_date: 20240101 },
            { ...validExperience, end_date: 20250101 },
            { ...validExperience, description: ["text"] },
        ]) {
            expect(profileExperienceSchema.safeParse(input).success).toBe(
                false,
            );
        }
    });

    it("does not pass ownership or generated fields through", () => {
        const result = profileExperienceSchema.safeParse({
            ...validExperience,
            id: "someone-else-entry",
            profile_id: "someone-else-profile",
            created_at: "2000-01-01",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data).toEqual(validExperience);
            expect(result.data).not.toHaveProperty("id");
            expect(result.data).not.toHaveProperty("profile_id");
            expect(result.data).not.toHaveProperty("created_at");
        }
    });
});