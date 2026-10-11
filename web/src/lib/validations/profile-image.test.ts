import { describe, expect, it } from "vitest";
import { profileImageSchema } from "./profile-image";

describe("Profile image (avatar/background) validations", () => {
    const fileBits: BlobPart[] = [new Uint8Array([1, 2, 3])];

    it("JPEG succeeds as image for both avatar & background", () => {
        const fileName: string = "test.jpg";
        const options: FilePropertyBag = { type: "image/jpeg" };
        const file: File = new File(fileBits, fileName, options);

        const validAvatar = profileImageSchema.safeParse({
            kind: "avatar",
            file: file
        });

        const validBackground = profileImageSchema.safeParse({
            kind: "background",
            file: file
        });

        expect(validAvatar.success).toBe(true);
        expect(validBackground.success).toBe(true);
    });

    it("PNG succeeds as image for both avatar & background", () => {
        const fileName: string = "test.png";
        const options: FilePropertyBag = { type: "image/png" };
        const file: File = new File(fileBits, fileName, options);

        const validAvatar = profileImageSchema.safeParse({
            kind: "avatar",
            file: file
        });

        const validBackground = profileImageSchema.safeParse({
            kind: "background",
            file: file
        });

        expect(validAvatar.success).toBe(true);
        expect(validBackground.success).toBe(true);
    });

    it("WEBP succeeds as image for both avatar & background", () => {
        const fileName: string = "test.webp";
        const options: FilePropertyBag = { type: "image/webp" };
        const file: File = new File(fileBits, fileName, options);

        const validAvatar = profileImageSchema.safeParse({
            kind: "avatar",
            file: file
        });

        const validBackground = profileImageSchema.safeParse({
            kind: "background",
            file: file
        });

        expect(validAvatar.success).toBe(true);
        expect(validBackground.success).toBe(true);
    });

    it("FIle exactly 5MiB succeeds", () => {
        const fileBitsExact: BlobPart[] = [new Uint8Array(5 * 1024 * 1024)];
        const fileName: string = "test.jpg";
        const options: FilePropertyBag = { type: "image/jpeg" };
        const file: File = new File(fileBitsExact, fileName, options);

        const validAvatar = profileImageSchema.safeParse({
            kind: "avatar",
            file: file
        });

        const validBackground = profileImageSchema.safeParse({
            kind: "background",
            file: file
        });

        expect(validAvatar.success).toBe(true);
        expect(validBackground.success).toBe(true);
    });

    it("FIle over 5MiB fails", () => {
        const fileBitsExact: BlobPart[] = [new Uint8Array(5 * 1024 * 1024 + 1)];
        const fileName: string = "test.jpg";
        const options: FilePropertyBag = { type: "image/jpeg" };
        const file: File = new File(fileBitsExact, fileName, options);

        const validAvatar = profileImageSchema.safeParse({
            kind: "avatar",
            file: file
        });

        const validBackground = profileImageSchema.safeParse({
            kind: "background",
            file: file
        });

        expect(validAvatar.success).toBe(false);
        expect(validBackground.success).toBe(false);
    });

    it("File with empty contents fails", () => {
        const fileBitsEmpty: BlobPart[] = [];
        const fileName: string = "test.jpg";
        const options: FilePropertyBag = { type: "image/jpeg" };
        const file: File = new File(fileBitsEmpty, fileName, options);

        const validAvatar = profileImageSchema.safeParse({
            kind: "avatar",
            file: file
        });

        const validBackground = profileImageSchema.safeParse({
            kind: "background",
            file: file
        });

        expect(validAvatar.success).toBe(false);
        expect(validBackground.success).toBe(false);
    });

    it("Unsupported type fails", () => {
        const fileName: string = "test.pdf";
        const options: FilePropertyBag = { type: "application/pdf" };
        const file: File = new File(fileBits, fileName, options);

        const validAvatar = profileImageSchema.safeParse({
            kind: "avatar",
            file: file
        });

        const validBackground = profileImageSchema.safeParse({
            kind: "background",
            file: file
        });

        expect(validAvatar.success).toBe(false);
        expect(validBackground.success).toBe(false);
    });

    it("Missing file fails", () => {
        const validAvatar = profileImageSchema.safeParse({
            kind: "avatar"
        });

        const validBackground = profileImageSchema.safeParse({
            kind: "background"
        });

        expect(validAvatar.success).toBe(false);
        expect(validBackground.success).toBe(false);
    });

    it("Null file fails", () => {
        const validAvatar = profileImageSchema.safeParse({
            kind: "avatar",
            file: null
        });

        const validBackground = profileImageSchema.safeParse({
            kind: "background",
            file: null
        });

        expect(validAvatar.success).toBe(false);
        expect(validBackground.success).toBe(false);
    });

    it("Invalid kind fails", () => {
        const fileName: string = "test.png";
        const options: FilePropertyBag = { type: "image/png" };
        const file: File = new File(fileBits, fileName, options);

        const validAvatar = profileImageSchema.safeParse({
            kind: "cover",
            file: file
        });

        const validBackground = profileImageSchema.safeParse({
            kind: "fullscreen",
            file: file
        });

        expect(validAvatar.success).toBe(false);
        expect(validBackground.success).toBe(false);
    });
});