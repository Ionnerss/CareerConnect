import { describe, expect, it } from "vitest";
import { profileProjectImageSchema } from "./profile-project-image";

const projectId = "11111111-1111-4111-8111-111111111111";

function imageFile(
    size: number,
    type = "image/png",
    name = "test.png",
) {
    return new File([new ArrayBuffer(size)], name, { type });
}

describe("Project image validation", () => {
    it.each([
        ["JPEG", "image/jpeg", "test.jpg"],
        ["PNG", "image/png", "test.png"],
        ["WebP", "image/webp", "test.webp"],
    ])("accepts a nonempty %s file", (_format, type, name) => {
        const result = profileProjectImageSchema.safeParse({
            projectId,
            file: imageFile(12, type, name),
            alt_text: "Screenshot of my project",
        });

        expect(result.success).toBe(true);
    });

    it("accepts a file of exactly 5 MiB", () => {
        const result = profileProjectImageSchema.safeParse({
            projectId,
            file: imageFile(5 * 1024 * 1024),
        });

        expect(result.success).toBe(true);
    });

    it("rejects a file one byte over 5 MiB", () => {
        const result = profileProjectImageSchema.safeParse({
            projectId,
            file: imageFile(5 * 1024 * 1024 + 1),
        });

        expect(result.success).toBe(false);
    });

    it("rejects an empty file", () => {
        const result = profileProjectImageSchema.safeParse({
            projectId,
            file: imageFile(0),
        });

        expect(result.success).toBe(false);
    });

    it("rejects an unsupported MIME type", () => {
        const result = profileProjectImageSchema.safeParse({
            projectId,
            file: imageFile(12, "application/pdf", "test.pdf"),
        });

        expect(result.success).toBe(false);
    });

    it("rejects a missing file", () => {
        const result = profileProjectImageSchema.safeParse({
            projectId,
        });

        expect(result.success).toBe(false);
    });

    it("rejects a null file", () => {
        const result = profileProjectImageSchema.safeParse({
            projectId,
            file: null,
        });

        expect(result.success).toBe(false);
    });

    it("rejects an invalid project ID", () => {
        const result = profileProjectImageSchema.safeParse({
            projectId: "not-a-uuid",
            file: imageFile(12),
        });

        expect(result.success).toBe(false);
    });

    it("normalizes omitted, null, and blank alt text to null", () => {
        for (const altText of [undefined, null, "", "   "]) {
            const result = profileProjectImageSchema.safeParse({
                projectId,
                file: imageFile(12),
                alt_text: altText,
            });

            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.alt_text).toBeNull();
            }
        }
    });

    it("trims nonblank alt text", () => {
        const result = profileProjectImageSchema.safeParse({
            projectId,
            file: imageFile(12),
            alt_text: "  Project dashboard  ",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.alt_text).toBe(
                "Project dashboard",
            );
        }
    });

    it("accepts 200 alt-text characters and rejects 201", () => {
        const valid = profileProjectImageSchema.safeParse({
            projectId,
            file: imageFile(12),
            alt_text: "a".repeat(200),
        });

        const invalid = profileProjectImageSchema.safeParse({
            projectId,
            file: imageFile(12),
            alt_text: "a".repeat(201),
        });

        expect(valid.success).toBe(true);
        expect(invalid.success).toBe(false);
    });

    it("rejects an alt-text value of the wrong type", () => {
        const result = profileProjectImageSchema.safeParse({
            projectId,
            file: imageFile(12),
            alt_text: 123,
        });

        expect(result.success).toBe(false);
    });

    it("does not pass through submitted ownership or Storage paths", () => {
        const result = profileProjectImageSchema.safeParse({
            projectId,
            file: imageFile(12),
            alt_text: "Demo",
            id: "attacker-id",
            profile_id: "attacker-profile",
            storage_path: "someone-elses-image",
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(Object.keys(result.data).sort()).toEqual(
                ["alt_text", "file", "projectId"].sort(),
            );
        }
    });
});