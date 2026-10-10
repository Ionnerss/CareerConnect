import { describe, expect, it } from "vitest";
import { assert } from 'vitest';
import { profileSchema } from "./profile";

describe("Profile validation", () => {
    const validProfile = {
        full_name: "Test User",
        bio: `Software Engineering Student.`,
        location: "Montreal",
        contact_email: "test@example.com"
    };
    
    it("accepts valid profile details", () => {
        expect(profileSchema.safeParse(validProfile).success).toBe(true);
    });

    it("whitespace-fields test", () => {
        const result = profileSchema.safeParse({
            ...validProfile,
            bio: "    ",
            location: "   ",
            contact_email: "   "
        });

        expect(result.success).toBe(true);
        
        if (result.success) {
            assert.isNull(result.data.bio);
            assert.isNull(result.data.location);
            assert.isNull(result.data.contact_email);
        }
    });

    it("Name: 100 / 101 characters test", () => {
        const result = profileSchema.safeParse({
            ...validProfile,
            full_name: "A".repeat(100)
        });

        const resultPlusOne = profileSchema.safeParse({
            ...validProfile,
            full_name: "A".repeat(101)
        });

        expect(result.success).toBe(true);
        expect(resultPlusOne.success).toBe(false);
    });

    it("Bio: 1,000 / 1,001 characters", () => {
        const result = profileSchema.safeParse({
            ...validProfile,
            bio: "A".repeat(1000)
        });

        const resultPlusOne = profileSchema.safeParse({
            ...validProfile,
            bio: "A".repeat(1001)
        });

        expect(result.success).toBe(true);
        expect(resultPlusOne.success).toBe(false);
    });

    it("Location: 150 / 151 characters", () => {
        const result = profileSchema.safeParse({
            ...validProfile,
            location: "A".repeat(150)
        });

        const resultPlusOne = profileSchema.safeParse({
            ...validProfile,
            location: "A".repeat(151)
        });

        expect(result.success).toBe(true);
        expect(resultPlusOne.success).toBe(false);
    });

    it("Optional fields contain null", () => {
        const result = profileSchema.safeParse({
            ...validProfile,
            bio: null,
            location: null,
            contact_email: null
        });
        expect(result.success).toBe(true);
    });

    it("blank-fields test", () => {
        const resultEmpty = profileSchema.safeParse({
            ...validProfile,
            bio: "",
            location: "",
            contact_email: ""
        });

        const resultSpaces = profileSchema.safeParse({
            ...validProfile,
            bio: "    ",
            location: "   ",
            contact_email: "   "
        });

        expect(resultEmpty.success).toBe(true);
        expect(resultSpaces.success).toBe(true);

        if (resultEmpty.success) {
            assert.isNull(resultEmpty.data.bio);
            assert.isNull(resultEmpty.data.location);
            assert.isNull(resultEmpty.data.contact_email);
        }
        
        if (resultSpaces.success) {
            assert.isNull(resultSpaces.data.bio);
            assert.isNull(resultSpaces.data.location);
            assert.isNull(resultSpaces.data.contact_email);
        }
    });

    it("Name, location, email have surrounding spaces", () => {
        const result = profileSchema.safeParse({
            ...validProfile,
            full_name: " Test User ",
            location: " Montreal ",
            contact_email: " test@example.com "
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.full_name).toBe("Test User");
            expect(result.data.location).toBe("Montreal");
            expect(result.data.contact_email).toBe("test@example.com");
        }
    });

    it("Nonblank bio contains paragraph breaks", () => {
        const result = profileSchema.safeParse({
            ...validProfile,
            bio: "  First paragraph.\n\nSecond paragraph.  "
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.bio).toBe("  First paragraph.\n\nSecond paragraph.  ");
        }
    });

    it("Invalid contact email", () => {
        const result = profileSchema.safeParse({
            ...validProfile,
            contact_email: "not-an-email"
        });

        expect(result.success).toBe(false);
    });

    it("Missing field keys", () => {
        const result1 = profileSchema.safeParse({
            full_name: "Test User",
            location: "Montreal",
            contact_email: "test@example.com"
        });

        const result2 = profileSchema.safeParse({
            full_name: "Test User",
            bio: "smth",
            contact_email: "test@example.com"
        });

        const result3 = profileSchema.safeParse({
            full_name: "Test User",
            bio: "smth",
            location: "Montreal"
        });

        const result4 = profileSchema.safeParse({
            bio: "smth",
            location: "Montreal",
            contact_email: "test@example.com"
        });

        expect(result1.success).toBe(false);
        expect(result2.success).toBe(false);
        expect(result3.success).toBe(false);
        expect(result4.success).toBe(false);
    });

    it("Wrong value types", () => {
        const resultName = profileSchema.safeParse({
            ...validProfile,
            full_name: 123
        });

        const resultBio = profileSchema.safeParse({
            ...validProfile,
            bio: true
        });

        const resultLocation = profileSchema.safeParse({
            ...validProfile,
            location: []
        });

        const resultEmail = profileSchema.safeParse({
            ...validProfile,
            contact_email: 123
        });

        expect(resultName.success).toBe(false);
        expect(resultBio.success).toBe(false);
        expect(resultLocation.success).toBe(false);
        expect(resultEmail.success).toBe(false);
    });

    it("full name cases", () => {
        const result1 = profileSchema.safeParse({
            ...validProfile,
            full_name: ""
        });

        const result2 = profileSchema.safeParse({
            ...validProfile,
            full_name: "   "
        });

        const result3 = profileSchema.safeParse({
            ...validProfile,
            full_name: null
        });

        expect(result1.success).toBe(false);
        expect(result2.success).toBe(false);
        expect(result3.success).toBe(false);
    });
});