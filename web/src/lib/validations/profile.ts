import { z } from "zod";

export const profileSchema = z.object({
    full_name: z
        .string()
        .trim()
        .min(1)
        .max(100),
    bio: z
        .string()
        .max(1000)
        .transform((val) => (val.trim() === "" ? null : val))
        .nullable(),
    location: z
        .string()
        .trim()
        .max(150)
        .transform((val) => (val === "" ? null : val))
        .nullable(),
    contact_email: z.preprocess((val) => {
            if (typeof val !== 'string') return val;
            if (val.trim() === "") return null;
            return val.trim();
        }, z.email().nullable())
});