import { z } from "zod";

export const profileProjectSchema = z.object({
    name: z.string().trim().min(1).max(150),
    short_description: z.string().trim().min(1).max(500),
});

export const profileProjectLinkSchema = z.object({
    label: z.string().trim().min(1).max(100),
    url: z
        .string()
        .trim()
        .min(1)
        .max(2048)
        .url()
        .refine(
            (value) =>
                /^https?:\/\/[^/\s]+([/?#][^\s]*)?$/i.test(value),
            "Use a valid HTTP or HTTPS URL.",
        ),
});