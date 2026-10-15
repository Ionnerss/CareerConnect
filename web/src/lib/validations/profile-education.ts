import { z } from "zod";

export const profileEducationSchema = z.object({
    school: z
        .string()
        .trim()
        .min(1)
        .max(200),
    degree: z
        .string()
        .trim()
        .min(1)
        .max(200),
    start_date: z.iso.date(),
    field_of_study: z
        .string()
        .trim()
        .max(200)
        .transform((val) => (val.trim() === "" ? null : val))
        .nullable()
        .optional(),
    end_date: z
    .preprocess(
        (value) =>
            typeof value === "string" && value.trim() === ""
                ? null
                : value,
        z.iso.date().nullable().optional()
    ),
    description: z.preprocess(
        (value) => {
            if (typeof value !== "string") return value;
            const trimmed = value.trim();
            return trimmed === "" ? null : trimmed;
        },
        z.string()
            .refine(
                (value) => value.split(/\s+/).length <= 500,
                { message: "Description must be 500 words or fewer." }
            )
            .nullable()
            .optional()
    ),
}).refine(
    (data) =>
        data.end_date === null ||
        data.end_date === undefined ||
        data.end_date >= data.start_date,
    {
        path: ["end_date"],
        message: "End date must be on or after the start date.",
    }
);