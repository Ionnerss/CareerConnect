import { z } from "zod";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
] as const;

export const profileProjectImageSchema = z.object({
    projectId: z.uuid(),

    file: z
        .instanceof(File, { error: "Choose an image file." })
        .refine((file) => file.size > 0, {
            error: "The image cannot be empty.",
        })
        .refine((file) => file.size <= MAX_IMAGE_SIZE, {
            error: "The image must be 5 MiB or smaller.",
        })
        .refine(
            (file) =>
                allowedMimeTypes.some((type) => type === file.type),
            {
                error: "Choose a JPEG, PNG, or WebP image.",
            },
        ),

    alt_text: z
        .string()
        .trim()
        .max(200, "Alt text must be 200 characters or fewer.")
        .nullish()
        .transform((value) => value || null),
});