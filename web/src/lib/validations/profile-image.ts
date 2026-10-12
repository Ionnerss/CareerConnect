import { z } from "zod";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set<string>([
    "image/jpeg",
    "image/png",
    "image/webp",
]);
enum Type {
    avatar = "avatar",
    background = "background"
}

export const profileImageSchema = z.object({
    kind: z.enum(Type),
    file: z
        .instanceof(File)
        .refine(
            (file) => file.size > 0,
            { message: "File cannot be empty." }
        )
        .refine(
            (file) => file.size <= MAX_FILE_SIZE,
            { message: "File cannot exceed 5MiB." }
        )
        .refine(
            (file) => ALLOWED_MIME_TYPES.has(file.type),
            { message: "Invalid file type. Only JPEG, PNG, and WEBP are allowed." }
        )
});
