import { describe, expect, it } from "vitest";
import {
    profileProjectLinkSchema,
    profileProjectSchema,
} from "./profile-projects";

describe("profileProjectSchema", () => {
    const validProject = {
        name: "CareerConnect",
        short_description: "A platform connecting candidates and recruiters.",
    };

    it("accepts valid details and trims surrounding spaces", () => {
        const result = profileProjectSchema.safeParse({
            name: "  CareerConnect  ",
            short_description: "  A project description.  ",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data).toEqual({
                name: "CareerConnect",
                short_description: "A project description.",
            });
        }
    });

    it.each(["", "   ", "\n\t"])(
        "rejects a blank name",
        (name) => {
            expect(
                profileProjectSchema.safeParse({
                    ...validProject,
                    name,
                }).success,
            ).toBe(false);
        },
    );

    it.each(["", "   ", "\n\t"])(
        "rejects a blank description",
        (short_description) => {
            expect(
                profileProjectSchema.safeParse({
                    ...validProject,
                    short_description,
                }).success,
            ).toBe(false);
        },
    );

    it("accepts 150 name characters and rejects 151", () => {
        expect(
            profileProjectSchema.safeParse({
                ...validProject,
                name: "a".repeat(150),
            }).success,
        ).toBe(true);

        expect(
            profileProjectSchema.safeParse({
                ...validProject,
                name: "a".repeat(151),
            }).success,
        ).toBe(false);
    });

    it("accepts 500 description characters and rejects 501", () => {
        expect(
            profileProjectSchema.safeParse({
                ...validProject,
                short_description: "a".repeat(500),
            }).success,
        ).toBe(true);

        expect(
            profileProjectSchema.safeParse({
                ...validProject,
                short_description: "a".repeat(501),
            }).success,
        ).toBe(false);
    });

    it("rejects missing fields and wrong types", () => {
        expect(
            profileProjectSchema.safeParse({
                name: validProject.name,
            }).success,
        ).toBe(false);

        expect(
            profileProjectSchema.safeParse({
                ...validProject,
                name: 123,
            }).success,
        ).toBe(false);

        expect(
            profileProjectSchema.safeParse({
                ...validProject,
                short_description: [],
            }).success,
        ).toBe(false);
    });

    it("does not pass ownership or generated fields through", () => {
        const result = profileProjectSchema.safeParse({
            ...validProject,
            id: "supplied-id",
            profile_id: "another-user-id",
            created_at: "supplied-date",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data).toEqual(validProject);
        }
    });
});

describe("profileProjectLinkSchema", () => {
    const validLink = {
        label: "Source code",
        url: "https://example.com/project",
    };

    it("accepts valid HTTP and HTTPS links", () => {
        expect(
            profileProjectLinkSchema.safeParse({
                label: "Website",
                url: "http://example.com",
            }).success,
        ).toBe(true);

        expect(profileProjectLinkSchema.safeParse(validLink).success)
            .toBe(true);
    });

    it("trims label and URL", () => {
        const result = profileProjectLinkSchema.safeParse({
            label: "  Source code  ",
            url: "  https://example.com/project  ",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data).toEqual(validLink);
        }
    });

    it("rejects blank labels and URLs", () => {
        expect(
            profileProjectLinkSchema.safeParse({
                ...validLink,
                label: "   ",
            }).success,
        ).toBe(false);

        expect(
            profileProjectLinkSchema.safeParse({
                ...validLink,
                url: "   ",
            }).success,
        ).toBe(false);
    });

    it("accepts 100 label characters and rejects 101", () => {
        expect(
            profileProjectLinkSchema.safeParse({
                ...validLink,
                label: "a".repeat(100),
            }).success,
        ).toBe(true);

        expect(
            profileProjectLinkSchema.safeParse({
                ...validLink,
                label: "a".repeat(101),
            }).success,
        ).toBe(false);
    });

    it("accepts 2048 URL characters and rejects 2049", () => {
        const prefix = "https://example.com/";

        expect(
            profileProjectLinkSchema.safeParse({
                ...validLink,
                url: prefix + "a".repeat(2048 - prefix.length),
            }).success,
        ).toBe(true);

        expect(
            profileProjectLinkSchema.safeParse({
                ...validLink,
                url: prefix + "a".repeat(2049 - prefix.length),
            }).success,
        ).toBe(false);
    });

    it.each([
        "ftp://example.com",
        "javascript:alert(1)",
        "not-a-url",
        "https://example.com/path with spaces",
    ])("rejects invalid or unsupported URL %s", (url) => {
        expect(
            profileProjectLinkSchema.safeParse({
                ...validLink,
                url,
            }).success,
        ).toBe(false);
    });

    it("rejects missing fields and wrong types", () => {
        expect(
            profileProjectLinkSchema.safeParse({
                label: validLink.label,
            }).success,
        ).toBe(false);

        expect(
            profileProjectLinkSchema.safeParse({
                ...validLink,
                label: 123,
            }).success,
        ).toBe(false);

        expect(
            profileProjectLinkSchema.safeParse({
                ...validLink,
                url: null,
            }).success,
        ).toBe(false);
    });

    it("does not pass ownership or generated fields through", () => {
        const result = profileProjectLinkSchema.safeParse({
            ...validLink,
            id: "supplied-id",
            project_id: "another-project-id",
            created_at: "supplied-date",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data).toEqual(validLink);
        }
    });
});